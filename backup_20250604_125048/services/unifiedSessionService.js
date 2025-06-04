// services/unifiedSessionService.js
import { v4 as uuidv4 } from 'uuid';
import { 
  updateCall, 
  endCall as storageEndCall, 
  addCallTranscription,
  registerCall 
} from './callStorageService.js';

/**
 * Servicio unificado para gestión de sesiones
 * Mantiene el aislamiento completo entre sesiones/llamadas
 */
class UnifiedSessionService {
  constructor() {
    // Mapa principal de sesiones - cada sesión completamente aislada
    this.sessions = new Map();

    // Configuración
    this.config = {
      SESSION_TIMEOUT: 30 * 60 * 1000, // 30 minutos
      CLEANUP_INTERVAL: 5 * 60 * 1000, // 5 minutos
      MAX_TRANSCRIPTIONS: 1000 // Límite por sesión para evitar memory leaks
    };

    // Iniciar limpieza periódica
    this.cleanupInterval = setInterval(() => this.cleanupInactiveSessions(), this.config.CLEANUP_INTERVAL);
    this.cleanupInterval.unref();
  }

  /**
   * Crea una nueva sesión con estructura completa
   * @param {string} specificSessionId - ID específico opcional
   * @returns {Object} Sesión creada
   */
  createSession(specificSessionId = null) {
    const sessionId = specificSessionId || `session_${uuidv4()}`;

    // Si ya existe, devolver la existente (idempotente)
    if (this.sessions.has(sessionId)) {
      console.log(`[UnifiedSession] Sesión ${sessionId} ya existe`);
      return this.getSession(sessionId);
    }

    // Crear estructura de sesión completa y aislada
    const session = {
      // Identificación
      id: sessionId,
      createdAt: Date.now(),
      lastActivity: Date.now(),

      // Estado de la llamada
      call: {
        sid: null,
        status: 'idle', // idle, starting, active, ended
        phoneNumber: null,
        userName: null,
        voiceId: null,
        voiceName: null,
        startTime: null,
        endTime: null,
        isRealCall: false, // Diferencia entre sesión de prueba y llamada real
        clientIp: null
      },

      // Conexiones - cada sesión tiene sus propias conexiones
      connections: {
        twilioWs: null,
        twilioStreamSid: null,
        elevenLabsConversation: null,
        logClients: new Set(), // Set de WebSockets de logs para ESTA sesión
        agentWs: null
      },

      // Estado del agente
      agent: {
        isActive: false,
        takeoverCount: 0,
        lastTakeoverTime: null
      },

      // Transcripciones - Array propio para cada sesión
      transcriptions: [],

      // Métricas específicas de esta sesión
      metrics: {
        audioChunksReceived: 0,
        audioChunksSent: 0,
        lastAudioReceived: null,
        lastAudioSent: null,
        latencyHistory: []
      }
    };

    // Almacenar la sesión
    this.sessions.set(sessionId, session);

    console.log(`[UnifiedSession] Nueva sesión creada: ${sessionId}`);

    // Registrar en callStorageService si no es sesión del dashboard
    if (!sessionId.startsWith('session_dashboard_')) {
      updateCall(sessionId, { 
        sessionId, 
        isSessionOnly: true,
        isRealCall: false
      });
    }

    return session;
  }

  /**
   * Obtiene una sesión específica
   * @param {string} sessionId 
   * @returns {Object|null} Sesión o null si no existe
   */
  getSession(sessionId) {
    if (!sessionId || !this.sessions.has(sessionId)) {
      return null;
    }

    const session = this.sessions.get(sessionId);
    // Actualizar última actividad
    session.lastActivity = Date.now();
    return session;
  }

  /**
   * Verifica si una sesión existe
   * @param {string} sessionId 
   * @returns {boolean}
   */
  sessionExists(sessionId) {
    return sessionId && this.sessions.has(sessionId);
  }

  // ========== GESTIÓN DE CONEXIONES ==========

  /**
   * Registra un cliente de logs para una sesión específica
   * @param {string} sessionId 
   * @param {WebSocket} ws 
   */
  addLogClient(sessionId, ws) {
    const session = this.getSession(sessionId);
    if (!session) {
      // Si no existe, la creamos
      this.createSession(sessionId);
      const newSession = this.getSession(sessionId);
      if (newSession) {
        newSession.connections.logClients.add(ws);
        ws.sessionId = sessionId; // Marcar el WS con su sessionId
        console.log(`[UnifiedSession] Cliente de logs agregado a nueva sesión ${sessionId}`);
      }
      return;
    }

    session.connections.logClients.add(ws);
    ws.sessionId = sessionId;
    console.log(`[UnifiedSession] Cliente de logs agregado a sesión ${sessionId}, total: ${session.connections.logClients.size}`);
  }

  /**
   * Elimina un cliente de logs
   * @param {WebSocket} ws 
   */
  removeLogClient(ws) {
    if (!ws.sessionId) return;

    const session = this.getSession(ws.sessionId);
    if (!session) return;

    session.connections.logClients.delete(ws);
    console.log(`[UnifiedSession] Cliente de logs eliminado de sesión ${ws.sessionId}, quedan: ${session.connections.logClients.size}`);
  }

  /**
   * Establece la conexión Twilio para una sesión
   * @param {string} sessionId 
   * @param {WebSocket} ws 
   * @param {string} streamSid 
   */
  setTwilioConnection(sessionId, ws, streamSid = null) {
    const session = this.getSession(sessionId);
    if (!session) {
      console.error(`[UnifiedSession] No se puede establecer conexión Twilio para sesión inexistente: ${sessionId}`);
      return false;
    }

    session.connections.twilioWs = ws;
    session.connections.twilioStreamSid = streamSid;
    ws.sessionId = sessionId;

    console.log(`[UnifiedSession] Conexión Twilio establecida para sesión ${sessionId}`);
    return true;
  }

  /**
   * Elimina la conexión Twilio
   * @param {string} sessionId 
   */
  removeTwilioConnection(sessionId) {
    const session = this.getSession(sessionId);
    if (!session) return;

    session.connections.twilioWs = null;
    session.connections.twilioStreamSid = null;
    console.log(`[UnifiedSession] Conexión Twilio eliminada de sesión ${sessionId}`);
  }

  /**
   * Establece la conversación de ElevenLabs
   * @param {string} sessionId 
   * @param {Object} conversation 
   */
  setElevenLabsConversation(sessionId, conversation) {
    const session = this.getSession(sessionId);
    if (!session) {
      console.error(`[UnifiedSession] No se puede establecer conversación ElevenLabs para sesión inexistente: ${sessionId}`);
      return false;
    }

    session.connections.elevenLabsConversation = conversation;
    console.log(`[UnifiedSession] Conversación ElevenLabs establecida para sesión ${sessionId}`);
    return true;
  }

  /**
   * Obtiene la conversación de ElevenLabs
   * @param {string} sessionId 
   * @returns {Object|null}
   */
  getElevenLabsConversation(sessionId) {
    const session = this.getSession(sessionId);
    return session ? session.connections.elevenLabsConversation : null;
  }

  // ========== GESTIÓN DE LLAMADAS ==========

  /**
   * Actualiza el estado de la llamada
   * @param {string} sessionId 
   * @param {Object} callData 
   */
  updateCallInfo(sessionId, callData) {
    const session = this.getSession(sessionId);
    if (!session) return false;

    // Actualizar datos de la llamada
    Object.assign(session.call, callData);

    // Si ahora tenemos un callSid, es una llamada real
    if (callData.sid && !session.call.isRealCall) {
      session.call.isRealCall = true;
      session.call.startTime = session.call.startTime || Date.now();
    }

    // Actualizar en storage si no es sesión del dashboard
    if (!sessionId.startsWith('session_dashboard_')) {
      updateCall(sessionId, callData);
    }

    console.log(`[UnifiedSession] Información de llamada actualizada para sesión ${sessionId}`, callData);
    return true;
  }

  /**
   * Finaliza una llamada
   * @param {string} sessionId 
   * @param {Object} endData 
   */
  endCall(sessionId, endData = {}) {
    const session = this.getSession(sessionId);
    if (!session) return false;

    session.call.status = 'ended';
    session.call.endTime = Date.now();

    // Cerrar conversación de ElevenLabs si existe
    if (session.connections.elevenLabsConversation) {
      try {
        session.connections.elevenLabsConversation.endSession();
      } catch (error) {
        console.error(`[UnifiedSession] Error cerrando conversación ElevenLabs:`, error);
      }
    }

    // Notificar a storage si es una llamada real
    if (session.call.isRealCall && !sessionId.startsWith('session_dashboard_')) {
      storageEndCall(sessionId, {
        ...endData,
        callSid: session.call.sid
      });
    }

    console.log(`[UnifiedSession] Llamada finalizada para sesión ${sessionId}`);
    return true;
  }

  // ========== GESTIÓN DE TRANSCRIPCIONES ==========

  /**
   * Añade una transcripción a una sesión específica
   * CRÍTICO: Solo añade a la sesión especificada
   * @param {string} sessionId 
   * @param {string} text 
   * @param {string} speakerType - 'client', 'bot', 'agent', 'system'
   */
  addTranscription(sessionId, text, speakerType) {
    const session = this.getSession(sessionId);
    if (!session) {
      console.error(`[UnifiedSession] Intento de añadir transcripción a sesión inexistente: ${sessionId}`);
      return false;
    }

    const transcription = {
      text,
      speakerType,
      timestamp: Date.now()
    };

    // Añadir SOLO al array de esta sesión específica
    session.transcriptions.push(transcription);

    // Limitar el tamaño para evitar memory leaks
    if (session.transcriptions.length > this.config.MAX_TRANSCRIPTIONS) {
      session.transcriptions.shift();
    }

    // También guardar en storage si no es sesión del dashboard
    if (!sessionId.startsWith('session_dashboard_')) {
      addCallTranscription(sessionId, text, speakerType);

      // Marcar como llamada real cuando hay transcripciones
      if (!session.call.isRealCall) {
        this.updateCallInfo(sessionId, { isRealCall: true });
      }
    }

    // Notificar SOLO a los clientes de logs de ESTA sesión
    this.broadcastToSession(sessionId, JSON.stringify({
      type: 'transcription',
      sessionId: sessionId,
      text: text,
      speakerType: speakerType,
      timestamp: transcription.timestamp
    }));

    console.log(`[UnifiedSession] Transcripción añadida a sesión ${sessionId}: [${speakerType}] ${text.substring(0, 50)}...`);
    return true;
  }

  /**
   * Obtiene las transcripciones de una sesión específica
   * @param {string} sessionId 
   * @returns {Array|null}
   */
  getTranscriptions(sessionId) {
    const session = this.getSession(sessionId);
    return session ? session.transcriptions : null;
  }

  // ========== GESTIÓN DE AGENTE ==========

  /**
   * Activa el modo agente para una sesión
   * @param {string} sessionId 
   */
  activateAgentMode(sessionId) {
    const session = this.getSession(sessionId);
    if (!session) return false;

    session.agent.isActive = true;
    session.agent.takeoverCount++;
    session.agent.lastTakeoverTime = Date.now();

    // Notificar a los clientes de ESTA sesión
    this.broadcastToSession(sessionId, JSON.stringify({
      type: 'agent_takeover',
      sessionId: sessionId,
      timestamp: Date.now()
    }));

    console.log(`[UnifiedSession] Modo agente activado para sesión ${sessionId}`);
    return true;
  }

  /**
   * Desactiva el modo agente
   * @param {string} sessionId 
   */
  deactivateAgentMode(sessionId) {
    const session = this.getSession(sessionId);
    if (!session) return false;

    session.agent.isActive = false;

    this.broadcastToSession(sessionId, JSON.stringify({
      type: 'agent_release',
      sessionId: sessionId,
      timestamp: Date.now()
    }));

    console.log(`[UnifiedSession] Modo agente desactivado para sesión ${sessionId}`);
    return true;
  }

  // ========== BROADCASTING ==========

  /**
   * Envía un mensaje a todos los clientes de logs de UNA sesión específica
   * CRÍTICO: Solo envía a los clientes de la sesión especificada
   * @param {string} sessionId 
   * @param {string} message 
   */
  broadcastToSession(sessionId, message) {
    const session = this.getSession(sessionId);
    if (!session) return;

    const messageStr = typeof message === 'string' ? message : JSON.stringify(message);

    // Enviar SOLO a los clientes de ESTA sesión
    session.connections.logClients.forEach(client => {
      if (client.readyState === 1) { // WebSocket.OPEN
        try {
          client.send(messageStr);
        } catch (error) {
          console.error(`[UnifiedSession] Error enviando a cliente de sesión ${sessionId}:`, error);
        }
      }
    });
  }

  // ========== ESTADÍSTICAS ==========

  /**
   * Obtiene estadísticas generales
   * @returns {Object}
   */
  getStats() {
    const sessionInfo = [];
    const now = Date.now();

    // Recopilar info de cada sesión
    this.sessions.forEach((session, id) => {
      // Excluir sesiones del dashboard
      if (!id.startsWith('session_dashboard_')) {
        sessionInfo.push({
          id: session.id,
          createdAt: session.createdAt,
          lastActivity: session.lastActivity,
          callStatus: session.call.status,
          callSid: session.call.sid,
          isRealCall: session.call.isRealCall,
          isAgentActive: session.agent.isActive,
          transcriptCount: session.transcriptions.length,
          connections: {
            logClients: session.connections.logClients.size,
            hasTwilioConnection: !!session.connections.twilioWs,
            hasElevenLabsConnection: !!session.connections.elevenLabsConversation
          }
        });
      }
    });

    return {
      totalSessions: sessionInfo.length,
      sessions: sessionInfo.map(s => s.id),
      sessionInfo: sessionInfo
    };
  }

  // ========== LIMPIEZA ==========

  /**
   * Limpia sesiones inactivas
   */
  cleanupInactiveSessions() {
    const now = Date.now();
    const sessionsToRemove = [];

    this.sessions.forEach((session, sessionId) => {
      const inactiveTime = now - session.lastActivity;

      if (inactiveTime > this.config.SESSION_TIMEOUT) {
        // Marcar para eliminación
        sessionsToRemove.push(sessionId);
      }
    });

    // Eliminar sesiones marcadas
    sessionsToRemove.forEach(sessionId => {
      console.log(`[UnifiedSession] Eliminando sesión inactiva: ${sessionId}`);
      this.removeSession(sessionId);
    });
  }

  /**
   * Elimina completamente una sesión
   * @param {string} sessionId 
   */
  removeSession(sessionId) {
    const session = this.getSession(sessionId);
    if (!session) return false;

    // Cerrar todas las conexiones
    this.closeAllConnections(session);

    // Si hay una llamada activa, finalizarla
    if (session.call.sid && session.call.status !== 'ended') {
      this.endCall(sessionId, { reason: 'session_cleanup' });
    }

    // Eliminar del mapa
    this.sessions.delete(sessionId);

    console.log(`[UnifiedSession] Sesión eliminada completamente: ${sessionId}`);
    return true;
  }

  /**
   * Cierra todas las conexiones de una sesión
   * @param {Object} session 
   */
  closeAllConnections(session) {
    // Cerrar clientes de logs
    session.connections.logClients.forEach(client => {
      try {
        if (client.readyState === 1) {
          client.close(1000, "Sesión finalizada");
        }
      } catch (error) {
        console.error(`[UnifiedSession] Error cerrando cliente de logs:`, error);
      }
    });

    // Cerrar conexión Twilio
    if (session.connections.twilioWs) {
      try {
        if (session.connections.twilioWs.readyState === 1) {
          session.connections.twilioWs.close(1000, "Sesión finalizada");
        }
      } catch (error) {
        console.error(`[UnifiedSession] Error cerrando conexión Twilio:`, error);
      }
    }

    // Cerrar conversación ElevenLabs
    if (session.connections.elevenLabsConversation) {
      try {
        session.connections.elevenLabsConversation.endSession();
      } catch (error) {
        console.error(`[UnifiedSession] Error cerrando conversación ElevenLabs:`, error);
      }
    }
  }

  /**
   * Maneja el stream de media de Twilio
   * @param {WebSocket} ws 
   * @param {string} sessionId 
   */
  async handleMediaStream(ws, sessionId) {
    // Importar elevenLabsService dinámicamente para evitar dependencias circulares
    const { setupMediaStream } = await import('./elevenLabsService.js');

    // Registrar la conexión Twilio
    this.setTwilioConnection(sessionId, ws);

    // Configurar el stream con ElevenLabs
    await setupMediaStream(ws, sessionId);
  }
}

// Crear instancia única (Singleton)
const unifiedSessionService = new UnifiedSessionService();

// Exportar la instancia
export default unifiedSessionService;

// También exportar funciones para compatibilidad
export const {
  createSession,
  getSession,
  sessionExists,
  addLogClient,
  removeLogClient,
  setTwilioConnection,
  removeTwilioConnection,
  setElevenLabsConversation,
  getElevenLabsConversation,
  updateCallInfo,
  endCall,
  addTranscription,
  getTranscriptions,
  activateAgentMode,
  deactivateAgentMode,
  broadcastToSession,
  getStats,
  removeSession,
  handleMediaStream
} = {
  createSession: (id) => unifiedSessionService.createSession(id),
  getSession: (id) => unifiedSessionService.getSession(id),
  sessionExists: (id) => unifiedSessionService.sessionExists(id),
  addLogClient: (id, ws) => unifiedSessionService.addLogClient(id, ws),
  removeLogClient: (ws) => unifiedSessionService.removeLogClient(ws),
  setTwilioConnection: (id, ws, sid) => unifiedSessionService.setTwilioConnection(id, ws, sid),
  removeTwilioConnection: (id) => unifiedSessionService.removeTwilioConnection(id),
  setElevenLabsConversation: (id, conv) => unifiedSessionService.setElevenLabsConversation(id, conv),
  getElevenLabsConversation: (id) => unifiedSessionService.getElevenLabsConversation(id),
  updateCallInfo: (id, data) => unifiedSessionService.updateCallInfo(id, data),
  endCall: (id, data) => unifiedSessionService.endCall(id, data),
  addTranscription: (id, text, speaker) => unifiedSessionService.addTranscription(id, text, speaker),
  getTranscriptions: (id) => unifiedSessionService.getTranscriptions(id),
  activateAgentMode: (id) => unifiedSessionService.activateAgentMode(id),
  deactivateAgentMode: (id) => unifiedSessionService.deactivateAgentMode(id),
  broadcastToSession: (id, msg) => unifiedSessionService.broadcastToSession(id, msg),
  getStats: () => unifiedSessionService.getStats(),
  removeSession: (id) => unifiedSessionService.removeSession(id),
  handleMediaStream: (ws, id) => unifiedSessionService.handleMediaStream(ws, id)
};