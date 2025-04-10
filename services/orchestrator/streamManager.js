// services/orchestrator/streamManager.js
import WebSocket from 'ws';

/**
 * Gestiona todas las conexiones de WebSocket y el enrutamiento de mensajes
 * entre los diferentes servicios.
 */
export class StreamManager {
  constructor() {
    // Almacena las conexiones activas por tipo y sessionId
    this.connections = {
      twilio: new Map(),
      elevenlabs: new Map(),
      frontend: new Map()
    };

    // Proveedores registrados (cuando se agreguen nuevos servicios)
    this.providers = new Map();

    // Estado de las sesiones activas
    this.sessionStates = new Map();

    // Contador para reducir frecuencia de logs
    this.logCounter = 0;

    // Configuración de logs
    this.logConfig = {
      routeFrequency: 50,  // Mostrar solo 1 de cada 50 mensajes de enrutamiento
      connectionCheck: false, // Deshabilitar logs de verificación de conexiones
      mediaMessages: false   // Deshabilitar logs de mensajes de media regulares
    };
  }

  /**
   * Registra una nueva conexión WebSocket
   * @param {string} type - Tipo de conexión ('twilio', 'elevenlabs', etc.)
   * @param {WebSocket} ws - Conexión WebSocket
   * @param {string} sessionId - ID de la sesión
   * @param {Object} state - Estado inicial asociado con la conexión
   */
  registerConnection(type, ws, sessionId, state = {}) {
    if (!this.connections[type]) {
      this.connections[type] = new Map();
    }

    // Si ya existe una conexión para este sessionId y tipo, la cerramos primero
    if (this.connections[type].has(sessionId)) {
      const existingWs = this.connections[type].get(sessionId);
      console.log(`[StreamManager] Ya existe una conexión ${type} para sesión ${sessionId}, reemplazando...`, 
                { sessionId });

      // Si la conexión existente aún está abierta, la cerramos
      if (existingWs.readyState === WebSocket.OPEN) {
        try {
          existingWs.close();
        } catch (error) {
          console.error(`[StreamManager] Error cerrando conexión ${type} anterior:`, error, 
                       { sessionId });
        }
      }
    }

    // Almacenar la conexión
    this.connections[type].set(sessionId, ws);

    // Almacenar/actualizar el estado de la sesión
    if (!this.sessionStates.has(sessionId)) {
      this.sessionStates.set(sessionId, {});
    }

    const sessionState = this.sessionStates.get(sessionId);
    const updatedState = { ...sessionState, ...state };
    this.sessionStates.set(sessionId, updatedState);

    // Debug: verificar si tenemos las propiedades clave en el estado (solo si es relevante)
    if (updatedState.streamSid && type === 'twilio') {
      console.log(`[StreamManager] Estado actualizado con streamSid: ${updatedState.streamSid}`, 
                { sessionId });
    }

    // Asociar el sessionId al WebSocket para facilitar la limpieza
    ws.sessionId = sessionId;
    ws.connectionType = type;

    console.log(`[StreamManager] Registrada conexión ${type} para sesión ${sessionId}`, 
                { sessionId });

    // Configurar cierre de la conexión
    ws.on('close', () => this.removeConnection(ws));

    // Verificación posterior al registro (solo si está habilitado)
    if (this.logConfig.connectionCheck) {
      this.checkConnections(sessionId);
    }
  }

  /**
   * Realiza una verificación de las conexiones asociadas a una sesión
   * @param {string} sessionId - ID de la sesión a verificar
   */
  checkConnections(sessionId) {
    if (!this.logConfig.connectionCheck) return;

    const hasTwilio = this.connections.twilio.has(sessionId);
    const hasElevenLabs = this.connections.elevenlabs.has(sessionId);
    const sessionState = this.getSessionState(sessionId);

    console.log(`[StreamManager] Verificación de conexiones para sesión ${sessionId}: 
                Twilio: ${hasTwilio}, 
                ElevenLabs: ${hasElevenLabs}, 
                StreamSid: ${sessionState.streamSid || 'No disponible'}`, 
                { sessionId });
  }

  /**
   * Elimina una conexión cuando se cierra
   * @param {WebSocket} ws - WebSocket a eliminar
   */
  removeConnection(ws) {
    const { sessionId, connectionType } = ws;
    if (sessionId && connectionType && this.connections[connectionType]) {
      // Verificar que sea realmente la misma conexión antes de eliminarla
      const currentWs = this.connections[connectionType].get(sessionId);
      if (currentWs === ws) {
        this.connections[connectionType].delete(sessionId);
        console.log(`[StreamManager] Eliminada conexión ${connectionType} para sesión ${sessionId}`, 
                    { sessionId });
      } else {
        console.log(`[StreamManager] Se intentó eliminar una conexión ${connectionType} desactualizada para sesión ${sessionId}`, 
                   { sessionId });
      }
    }
  }

  /**
   * Enruta un mensaje a su destinatario según el tipo
   * @param {Object} message - Mensaje a enrutar
   * @param {string} message.source - Origen del mensaje ('twilio', 'elevenlabs', etc.)
   * @param {string} message.target - Destino del mensaje (opcional)
   * @param {string} message.type - Tipo general del mensaje
   * @param {string} message.messageType - Subtipo específico del mensaje
   * @param {*} message.payload - Contenido del mensaje
   * @param {string} message.sessionId - ID de la sesión
   */
  routeMessage(message) {
    const { source, target, type, payload, sessionId } = message;

    // Incrementar contador para logs
    this.logCounter++;

    // Si no hay sessionId, no podemos enrutar
    if (!sessionId) {
      console.error('[StreamManager] Error: intento de enrutar mensaje sin sessionId');
      return false;
    }

    // Obtener el estado de la sesión actual
    const sessionState = this.getSessionState(sessionId);

    // Si ya viene con un destino definido, enviar directamente
    if (target && this.connections[target] && this.connections[target].has(sessionId)) {
      // Para mensajes de audio de ElevenLabs a Twilio, asegurarse de que tengan streamSid
      if (source === 'elevenlabs' && type === 'audio' && target === 'twilio') {
        if (!sessionState.streamSid) {
          // Solo mostrar este error de vez en cuando para no saturar los logs
          if (this.logCounter % this.logConfig.routeFrequency === 0) {
            console.log(`[StreamManager] No se puede enrutar audio, no hay streamSid para sesión ${sessionId}`, 
                      { sessionId });
          }
          return false;
        }

        // Enriquecer el payload con el streamSid necesario para Twilio
        const enhancedPayload = {
          event: 'media',
          streamSid: sessionState.streamSid,
          media: {
            payload: payload
          }
        };

        return this.sendToTarget(target, sessionId, enhancedPayload);
      }

      return this.sendToTarget(target, sessionId, payload);
    }

    // Implementación básica temporal basada en el origen
    if (source === 'twilio') {
      // Audio del cliente va a ElevenLabs
      if (this.connections.elevenlabs.has(sessionId)) {
        return this.sendToTarget('elevenlabs', sessionId, payload);
      } else {
        // Solo mostrar este error de vez en cuando para no saturar los logs
        if (this.logCounter % this.logConfig.routeFrequency === 0) {
          console.log(`[StreamManager] No hay conexión ElevenLabs para enviar audio del cliente, sesión ${sessionId}`, 
                    { sessionId });
        }
      }
    } 
    else if (source === 'elevenlabs') {
      // Respuestas de voz van a Twilio
      if (type === 'audio') {
        // Verificar que exista streamSid para poder enrutar el audio
        if (!sessionState.streamSid) {
          // Solo mostrar este error de vez en cuando para no saturar los logs
          if (this.logCounter % this.logConfig.routeFrequency === 0) {
            console.log(`[StreamManager] Recibido audio pero aún no hay streamSid para sesión ${sessionId}`, 
                      { sessionId });
          }
          return false;
        }

        if (this.connections.twilio.has(sessionId)) {
          // Enriquecer el payload con el streamSid necesario para Twilio
          const enhancedPayload = {
            event: 'media',
            streamSid: sessionState.streamSid,
            media: {
              payload: payload
            }
          };

          return this.sendToTarget('twilio', sessionId, enhancedPayload);
        } else {
          // Solo mostrar este error de vez en cuando para no saturar los logs
          if (this.logCounter % this.logConfig.routeFrequency === 0) {
            console.log(`[StreamManager] No hay conexión Twilio para enviar audio del bot, sesión ${sessionId}`, 
                      { sessionId });
          }
        }
      }
      // Las transcripciones se manejan en el ElevenLabsAdapter
      else if (type === 'transcript') {
        // Aquí podríamos enrutar al frontend si tuviéramos esa conexión
      }
    }

    return false;
  }

  /**
   * Envía un mensaje a un destino específico
   * @param {string} targetType - Tipo de destino ('twilio', 'elevenlabs', etc.)
   * @param {string} sessionId - ID de la sesión
   * @param {*} payload - Contenido del mensaje
   * @returns {boolean} - true si se envió correctamente, false en caso contrario
   */
  sendToTarget(targetType, sessionId, payload) {
    if (!this.connections[targetType] || !this.connections[targetType].has(sessionId)) {
      // Solo mostrar este error de vez en cuando para no saturar los logs
      if (this.logCounter % this.logConfig.routeFrequency === 0) {
        console.log(`[StreamManager] No hay conexión ${targetType} para la sesión ${sessionId}`, 
                    { sessionId });
      }
      return false;
    }

    const ws = this.connections[targetType].get(sessionId);

    // Verificar si la conexión está abierta
    if (ws.readyState !== WebSocket.OPEN) {
      console.log(`[StreamManager] La conexión ${targetType} para sesión ${sessionId} no está abierta`, 
                  { sessionId });
      return false;
    }

    try {
      // Convertir a string si no lo es ya
      const message = typeof payload === 'string' ? payload : JSON.stringify(payload);
      ws.send(message);

      // Reducir logs para mensajes de media
      const isMediaMessage = payload && payload.event === 'media';
      if (!isMediaMessage || (this.logCounter % this.logConfig.routeFrequency === 0 && this.logConfig.mediaMessages)) {
        console.log(`[StreamManager] Mensaje enviado a ${targetType} para sesión ${sessionId}`, 
                   { sessionId });
      }

      return true;
    } catch (error) {
      console.error(`[StreamManager] Error enviando mensaje a ${targetType}:`, error, 
                    { sessionId });
      return false;
    }
  }

  /**
   * Obtiene el estado de una sesión
   * @param {string} sessionId - ID de la sesión
   * @returns {Object} Estado de la sesión
   */
  getSessionState(sessionId) {
    return this.sessionStates.get(sessionId) || {};
  }

  /**
   * Actualiza el estado de una sesión
   * @param {string} sessionId - ID de la sesión
   * @param {Object} updates - Actualizaciones al estado
   */
  updateSessionState(sessionId, updates) {
    const currentState = this.getSessionState(sessionId);
    const newState = { ...currentState, ...updates };
    this.sessionStates.set(sessionId, newState);

    // Si hay un cambio en streamSid, registrarlo para depuración
    if (updates.streamSid && updates.streamSid !== currentState.streamSid) {
      console.log(`[StreamManager] streamSid actualizado para sesión ${sessionId}: ${updates.streamSid}`, 
                 { sessionId });
    }
  }

  /**
   * Registra un nuevo proveedor de servicios
   * @param {string} providerType - Tipo de proveedor
   * @param {Object} provider - Instancia del proveedor
   */
  registerProvider(providerType, provider) {
    this.providers.set(providerType, provider);
    console.log(`[StreamManager] Proveedor ${providerType} registrado`);
  }

  /**
   * Obtiene un proveedor registrado
   * @param {string} providerType - Tipo de proveedor
   * @returns {Object} Instancia del proveedor
   */
  getProvider(providerType) {
    return this.providers.get(providerType);
  }
}