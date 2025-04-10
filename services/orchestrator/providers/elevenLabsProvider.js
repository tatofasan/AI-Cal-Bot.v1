// services/orchestrator/providers/elevenLabsProvider.js
import { AudioProvider } from './audioProvider.js';
import { getSignedUrl } from '../../elevenlabs/elevenLabsApi.js';
import { selectVoice } from '../../elevenlabs/voiceManager.js';
import WebSocket from 'ws';

/**
 * Proveedor para servicios de voz mediante ElevenLabs
 */
export class ElevenLabsProvider extends AudioProvider {
  constructor(orchestrator) {
    super(orchestrator);
    this.providerType = "elevenlabs";
    this.connections = new Map(); // Mapeo de sessionId -> WebSocket
  }

  /**
   * Inicializa una conexión con ElevenLabs
   * @param {Object} params - Parámetros para la conexión
   * @param {string} params.voice_id - ID de la voz a utilizar
   * @param {string} params.voice_name - Nombre de la voz
   * @param {string} params.user_name - Nombre del usuario
   * @param {string} sessionId - ID de la sesión
   * @returns {Promise<Object>} Resultado de la inicialización
   * @override
   */
  async initialize(params, sessionId) {
    try {
      console.log("[ElevenLabsProvider] Iniciando conexión a ElevenLabs", { sessionId });

      // Obtener URL firmada
      const signedUrl = await getSignedUrl();

      // Seleccionar voz si es aleatoria
      if (params.voice_id === "random") {
        const selectedVoice = selectVoice("random");
        params.voice_id = selectedVoice.id;
        params.voice_name = selectedVoice.name;
      }

      // Verificar si ya existe una conexión para esta sesión
      if (this.connections.has(sessionId)) {
        const existingWs = this.connections.get(sessionId);
        if (existingWs.readyState === WebSocket.OPEN) {
          console.log("[ElevenLabsProvider] Ya existe una conexión activa para esta sesión, cerrándola primero", 
                     { sessionId });
          try {
            existingWs.close();
          } catch (error) {
            console.error("[ElevenLabsProvider] Error cerrando conexión existente:", error, { sessionId });
          }
        }
      }

      // Crear WebSocket
      const ws = new WebSocket(signedUrl);

      // Almacenar sessionId en el WebSocket
      ws.sessionId = sessionId;

      // Promesa para esperar a que se establezca la conexión
      const connectionPromise = new Promise((resolve, reject) => {
        // Timeout para evitar que la promesa quede pendiente indefinidamente
        const timeoutId = setTimeout(() => {
          reject(new Error("Timeout al conectar con ElevenLabs"));
        }, 10000);

        // Manejar apertura de conexión
        ws.on("open", () => {
          clearTimeout(timeoutId);
          console.log("[ElevenLabsProvider] WebSocket conectado a ElevenLabs", { sessionId });

          // Enviar configuración inicial a través del adaptador
          this.orchestrator.elevenLabsAdapter.sendInitialConfig(ws, params, sessionId);

          // Registrar la conexión
          this.connections.set(sessionId, ws);

          // Registrar en el StreamManager
          this.orchestrator.registerElevenLabsWebSocket(ws, sessionId, params);

          resolve({
            success: true,
            message: "Conexión con ElevenLabs establecida",
            providerType: this.providerType,
            voice: {
              id: params.voice_id,
              name: params.voice_name
            }
          });
        });

        // Manejar errores
        ws.on("error", (error) => {
          clearTimeout(timeoutId);
          console.error("[ElevenLabsProvider] Error en WebSocket:", error, { sessionId });
          reject(error);
        });

        // Manejar cierre inesperado durante la inicialización
        ws.on("close", (code, reason) => {
          clearTimeout(timeoutId);
          if (!this.connections.has(sessionId)) {
            // El cierre ocurrió antes de que se estableciera la conexión
            reject(new Error(`Conexión cerrada durante inicialización. Código: ${code}, Razón: ${reason || "No especificada"}`));
          }
        });
      });

      // Configurar manejador para mensajes una vez que se establezca la conexión
      ws.on("message", (data) => {
        try {
          const message = JSON.parse(data);

          // Procesar el mensaje a través del adaptador
          this.orchestrator.handleElevenLabsMessage(message, { 
            sessionId, 
            ...params,
            // Incluir información del StreamSid desde el estado general
            streamSid: this.orchestrator.streamManager.getSessionState(sessionId)?.streamSid
          });
        } catch (error) {
          console.error("[ElevenLabsProvider] Error procesando mensaje:", error, { sessionId });
        }
      });

      // Manejar cierre de conexión
      ws.on("close", (code, reason) => {
        console.log(
          `[ElevenLabsProvider] WebSocket cerrado. Código: ${code}, Razón: ${reason || "No especificada"}`,
          { sessionId }
        );

        // Eliminar la conexión
        this.connections.delete(sessionId);

        // Notificar al orquestador del cierre
        const closeMessage = {
          source: 'elevenlabs',
          type: 'control',
          messageType: 'connection',
          action: 'disconnected',
          payload: {
            code,
            reason: reason || "No especificada"
          },
          sessionId
        };

        this.orchestrator.streamManager.routeMessage(closeMessage);
      });

      // Esperar a que se establezca la conexión
      return await connectionPromise;

    } catch (error) {
      console.error("[ElevenLabsProvider] Error inicializando ElevenLabs:", error, { sessionId });
      throw error;
    }
  }

  /**
   * Finaliza una conexión con ElevenLabs
   * @param {string} sessionId - ID de la sesión
   * @returns {Promise<boolean>} true si se finalizó correctamente
   * @override
   */
  async terminate(sessionId) {
    const ws = this.connections.get(sessionId);

    if (!ws) {
      console.log(`[ElevenLabsProvider] No hay conexión para sesión ${sessionId}`, { sessionId });
      return false;
    }

    try {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
        console.log(`[ElevenLabsProvider] Conexión cerrada para sesión ${sessionId}`, { sessionId });
      }

      // Eliminar del registro de conexiones
      this.connections.delete(sessionId);

      return true;
    } catch (error) {
      console.error(`[ElevenLabsProvider] Error cerrando conexión:`, error, { sessionId });
      return false;
    }
  }

  /**
   * Procesa audio del cliente y lo envía a ElevenLabs
   * @param {Object} audioData - Datos de audio
   * @param {string} sessionId - ID de la sesión
   * @returns {Promise<boolean>} true si se procesó correctamente
   * @override
   */
  async processAudio(audioData, sessionId) {
    const ws = this.connections.get(sessionId);

    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.log(`[ElevenLabsProvider] No hay conexión activa para sesión ${sessionId}`, { sessionId });
      return false;
    }

    try {
      // Convertir al formato esperado por ElevenLabs
      const message = {
        user_audio_chunk: Buffer.from(audioData, 'base64').toString('base64')
      };

      // Enviar directamente a través del WebSocket
      ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error(`[ElevenLabsProvider] Error enviando audio:`, error, { sessionId });
      return false;
    }
  }

  /**
   * Envía un comando específico a ElevenLabs
   * @param {string} command - Comando a enviar
   * @param {Object} params - Parámetros del comando
   * @param {string} sessionId - ID de la sesión
   * @returns {Promise<Object>} Resultado del comando
   * @override
   */
  async sendCommand(command, params, sessionId) {
    const ws = this.connections.get(sessionId);

    if (!ws || ws.readyState !== WebSocket.OPEN) {
      throw new Error(`No hay conexión activa para sesión ${sessionId}`);
    }

    try {
      switch (command) {
        case "disconnect":
          return await this.terminate(sessionId);

        case "change_voice":
          if (!params.voice_id) {
            throw new Error("Se requiere voice_id para cambiar la voz");
          }

          // Crear mensaje para cambiar la voz
          const voiceChangeMessage = {
            type: "conversation_config_update",
            conversation_config_override: {
              tts: {
                voice_id: params.voice_id
              }
            }
          };

          ws.send(JSON.stringify(voiceChangeMessage));
          return {
            success: true,
            message: `Voz cambiada a ${params.voice_id}`
          };

        default:
          throw new Error(`Comando desconocido: ${command}`);
      }
    } catch (error) {
      console.error(`[ElevenLabsProvider] Error ejecutando comando ${command}:`, error, { sessionId });
      throw error;
    }
  }

  /**
   * Verifica si hay una conexión activa para la sesión
   * @param {string} sessionId - ID de la sesión
   * @returns {boolean} true si hay una conexión activa
   * @override
   */
  isActiveForSession(sessionId) {
    const ws = this.connections.get(sessionId);
    return ws && ws.readyState === WebSocket.OPEN;
  }

  /**
   * Obtiene información del proveedor ElevenLabs
   * @returns {Object} Información del proveedor
   * @override
   */
  getProviderInfo() {
    return {
      type: this.providerType,
      capabilities: [
        "text_to_speech",
        "speech_to_text",
        "voice_selection",
        "audio_streaming"
      ],
      activeSessions: this.connections.size
    };
  }
}