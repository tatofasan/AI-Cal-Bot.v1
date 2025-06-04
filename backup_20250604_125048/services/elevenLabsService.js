// services/elevenLabsService.js
import { ElevenLabsClient } from "elevenlabs";
import unifiedSessionService from "./unifiedSessionService.js";

// Configuración
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_AGENT_ID = process.env.ELEVENLABS_AGENT_ID;

// Cliente de ElevenLabs
const client = new ElevenLabsClient({
  apiKey: ELEVENLABS_API_KEY
});

/**
 * Configura el stream de medios para la comunicación entre Twilio y ElevenLabs usando el SDK
 * @param {WebSocket} twilioWs - WebSocket de conexión con Twilio
 * @param {string} sessionId - ID de sesión para asociar con esta conexión
 * @param {Object} customParameters - Parámetros personalizados (user_name, voice_id, etc.)
 */
export async function setupMediaStream(twilioWs, sessionId, customParameters = {}) {
  try {
    console.log("[ElevenLabs SDK] Iniciando conversación para sesión:", sessionId);

    // Obtener la sesión del servicio unificado
    const session = unifiedSessionService.getSession(sessionId);
    if (!session) {
      throw new Error(`Sesión ${sessionId} no encontrada`);
    }

    // Verificar si ya hay una conversación activa para esta sesión
    const existingConversation = unifiedSessionService.getElevenLabsConversation(sessionId);
    if (existingConversation) {
      console.warn(`[ElevenLabs SDK] Ya existe una conversación activa para sesión ${sessionId}`);
      await existingConversation.endSession();
    }

    // Crear nueva conversación usando el SDK
    const conversation = await client.conversationalAi.createConversation({
      agentId: ELEVENLABS_AGENT_ID,

      // Callback cuando se conecta
      onConnect: () => {
        console.log("[ElevenLabs SDK] Conversación conectada", { sessionId });

        // Registrar la conversación en el servicio unificado
        unifiedSessionService.setElevenLabsConversation(sessionId, conversation);

        // Actualizar estado de la llamada
        unifiedSessionService.updateCallInfo(sessionId, {
          elevenLabsConnected: true
        });

        // Notificar a los clientes de ESTA sesión
        unifiedSessionService.broadcastToSession(sessionId, JSON.stringify({
          type: 'conversation_connected',
          sessionId: sessionId
        }));
      },

      // Callback para mensajes/eventos
      onMessage: (message) => {
        handleConversationMessage(message, sessionId, twilioWs);
      },

      // Callback para audio
      onAudio: (audioData) => {
        handleAudioData(audioData, sessionId, twilioWs);
      },

      // Callback para transcripciones
      onTranscript: (transcript) => {
        handleTranscript(transcript, sessionId);
      },

      // Callback para errores
      onError: (error) => {
        console.error("[ElevenLabs SDK] Error en conversación:", error, { sessionId });
        unifiedSessionService.broadcastToSession(sessionId, JSON.stringify({
          type: 'conversation_error',
          error: error.message
        }));
      },

      // Callback cuando se desconecta
      onDisconnect: () => {
        console.log("[ElevenLabs SDK] Conversación desconectada", { sessionId });

        // Limpiar del servicio unificado
        unifiedSessionService.setElevenLabsConversation(sessionId, null);

        // Actualizar estado
        unifiedSessionService.updateCallInfo(sessionId, {
          elevenLabsConnected: false
        });
      }
    });

    // Configurar parámetros iniciales si se proporcionan
    if (customParameters) {
      // Establecer variables dinámicas
      if (customParameters.user_name) {
        await conversation.setVariable('user_name', customParameters.user_name);
      }

      // Si hay un voice_id específico, configurarlo
      if (customParameters.voice_id && customParameters.voice_id !== 'random') {
        await conversation.setVoice(customParameters.voice_id);
      }
    }

    // Manejar mensajes de Twilio
    setupTwilioHandlers(twilioWs, conversation, sessionId);

    return conversation;
  } catch (error) {
    console.error("[ElevenLabs SDK] Error configurando conversación:", error, { sessionId });
    throw error;
  }
}

/**
 * Configura los manejadores para el WebSocket de Twilio
 */
function setupTwilioHandlers(twilioWs, conversation, sessionId) {
  // Variables para el estado
  let streamSid = null;

  // Manejar mensajes de Twilio
  twilioWs.on('message', async (data) => {
    try {
      const msg = JSON.parse(data);

      switch (msg.event) {
        case 'start':
          streamSid = msg.start.streamSid;
          twilioWs.streamSid = streamSid;
          console.log(`[ElevenLabs SDK] Stream iniciado - StreamSid: ${streamSid}`, { sessionId });

          // Actualizar en el servicio unificado
          unifiedSessionService.setTwilioConnection(sessionId, twilioWs, streamSid);

          // Actualizar estado de la llamada
          unifiedSessionService.updateCallInfo(sessionId, {
            streamSid: streamSid,
            status: 'active'
          });
          break;

        case 'media':
          // Enviar audio del cliente a ElevenLabs
          if (msg.media && msg.media.payload) {
            try {
              // El SDK espera audio en formato raw, no base64
              const audioBuffer = Buffer.from(msg.media.payload, 'base64');
              await conversation.sendAudio(audioBuffer);

              // Actualizar métricas
              const session = unifiedSessionService.getSession(sessionId);
              if (session) {
                session.metrics.audioChunksReceived++;
                session.metrics.lastAudioReceived = Date.now();
              }
            } catch (audioError) {
              console.error("[ElevenLabs SDK] Error enviando audio:", audioError, { sessionId });
            }
          }
          break;

        case 'stop':
          console.log(`[ElevenLabs SDK] Stream detenido`, { sessionId });
          await conversation.endSession();
          break;
      }
    } catch (error) {
      console.error("[ElevenLabs SDK] Error procesando mensaje de Twilio:", error, { sessionId });
    }
  });

  // Manejar cierre de Twilio
  twilioWs.on('close', async () => {
    console.log("[ElevenLabs SDK] Conexión Twilio cerrada", { sessionId });
    unifiedSessionService.removeTwilioConnection(sessionId);

    if (conversation) {
      await conversation.endSession();
    }
  });
}

/**
 * Maneja los mensajes de la conversación
 */
function handleConversationMessage(message, sessionId, twilioWs) {
  try {
    // Log para debug
    console.log("[ElevenLabs SDK] Mensaje recibido:", message.type, { sessionId });

    switch (message.type) {
      case 'conversation_initiation_metadata':
        console.log("[ElevenLabs SDK] Metadata de conversación recibida", { sessionId });
        break;

      case 'agent_response':
        // Respuesta del agente (texto)
        if (message.text) {
          console.log(`[ElevenLabs SDK] Respuesta del agente: ${message.text}`, { sessionId });

          // Añadir transcripción SOLO a esta sesión
          unifiedSessionService.addTranscription(sessionId, message.text, 'bot');

          // Broadcast SOLO a esta sesión
          unifiedSessionService.broadcastToSession(sessionId, JSON.stringify({
            type: 'agent_response',
            text: message.text,
            sessionId: sessionId
          }));
        }
        break;

      case 'user_transcript':
        // Transcripción del usuario
        if (message.text) {
          console.log(`[ElevenLabs SDK] Transcripción del usuario: ${message.text}`, { sessionId });

          // Añadir transcripción SOLO a esta sesión
          unifiedSessionService.addTranscription(sessionId, message.text, 'client');

          // Broadcast SOLO a esta sesión
          unifiedSessionService.broadcastToSession(sessionId, JSON.stringify({
            type: 'user_transcript',
            text: message.text,
            sessionId: sessionId
          }));
        }
        break;

      case 'interruption':
        console.log("[ElevenLabs SDK] Interrupción detectada", { sessionId });
        // Limpiar el buffer de Twilio
        if (twilioWs.streamSid) {
          twilioWs.send(JSON.stringify({
            event: "clear",
            streamSid: twilioWs.streamSid
          }));
        }
        break;

      default:
        console.log(`[ElevenLabs SDK] Tipo de mensaje no manejado: ${message.type}`, { sessionId });
    }
  } catch (error) {
    console.error("[ElevenLabs SDK] Error manejando mensaje:", error, { sessionId });
  }
}

/**
 * Maneja el audio recibido de ElevenLabs
 */
function handleAudioData(audioData, sessionId, twilioWs) {
  try {
    if (!twilioWs.streamSid) {
      console.warn("[ElevenLabs SDK] Audio recibido pero no hay streamSid", { sessionId });
      return;
    }

    // Convertir audio a base64 para Twilio
    const base64Audio = Buffer.from(audioData).toString('base64');

    // Enviar a Twilio
    const audioMessage = {
      event: "media",
      streamSid: twilioWs.streamSid,
      media: {
        payload: base64Audio
      }
    };

    twilioWs.send(JSON.stringify(audioMessage));

    // Actualizar métricas
    const session = unifiedSessionService.getSession(sessionId);
    if (session) {
      session.metrics.audioChunksSent++;
      session.metrics.lastAudioSent = Date.now();
    }

    // Broadcast para monitoreo SOLO a esta sesión
    unifiedSessionService.broadcastToSession(sessionId, JSON.stringify({
      type: "audio",
      id: Date.now() + Math.random().toString(36).substr(2, 9),
      payload: base64Audio
    }));
  } catch (error) {
    console.error("[ElevenLabs SDK] Error manejando audio:", error, { sessionId });
  }
}

/**
 * Maneja las transcripciones
 */
function handleTranscript(transcript, sessionId) {
  try {
    const { text, role, confidence } = transcript;

    console.log(`[ElevenLabs SDK] Transcripción [${role}]: ${text} (confianza: ${confidence})`, { sessionId });

    // Guardar transcripción en la sesión específica
    const speakerType = role === 'user' ? 'client' : 'bot';
    unifiedSessionService.addTranscription(sessionId, text, speakerType);

    // Broadcast SOLO a esta sesión
    unifiedSessionService.broadcastToSession(sessionId, JSON.stringify({
      type: 'transcript',
      text: text,
      role: role,
      confidence: confidence,
      sessionId: sessionId
    }));
  } catch (error) {
    console.error("[ElevenLabs SDK] Error manejando transcripción:", error, { sessionId });
  }
}

/**
 * Obtiene una conversación activa por sessionId
 */
export function getActiveConversation(sessionId) {
  return unifiedSessionService.getElevenLabsConversation(sessionId);
}

/**
 * Interrumpe la conversación actual
 */
export async function interruptConversation(sessionId) {
  const conversation = getActiveConversation(sessionId);
  if (conversation) {
    try {
      await conversation.interrupt();
      console.log("[ElevenLabs SDK] Conversación interrumpida", { sessionId });
      return true;
    } catch (error) {
      console.error("[ElevenLabs SDK] Error interrumpiendo conversación:", error, { sessionId });
      return false;
    }
  }
  return false;
}

/**
 * Cambia el modo de la conversación (bot/agent)
 */
export async function setConversationMode(sessionId, mode) {
  const conversation = getActiveConversation(sessionId);
  if (conversation) {
    try {
      await conversation.setMode(mode);
      console.log(`[ElevenLabs SDK] Modo cambiado a: ${mode}`, { sessionId });
      return true;
    } catch (error) {
      console.error("[ElevenLabs SDK] Error cambiando modo:", error, { sessionId });
      return false;
    }
  }
  return false;
}

/**
 * Envía audio del agente
 */
export async function sendAgentAudio(sessionId, audioData) {
  const conversation = getActiveConversation(sessionId);
  if (conversation) {
    try {
      await conversation.sendAudio(audioData);
      return true;
    } catch (error) {
      console.error("[ElevenLabs SDK] Error enviando audio del agente:", error, { sessionId });
      return false;
    }
  }
  return false;
}

/**
 * Finaliza todas las conversaciones activas (para cleanup)
 */
export async function closeAllConversations() {
  console.log(`[ElevenLabs SDK] Cerrando todas las conversaciones activas`);

  const stats = unifiedSessionService.getStats();

  for (const sessionInfo of stats.sessionInfo) {
    const conversation = getActiveConversation(sessionInfo.id);
    if (conversation) {
      try {
        await conversation.endSession();
        console.log(`[ElevenLabs SDK] Conversación cerrada para sesión ${sessionInfo.id}`);
      } catch (error) {
        console.error(`[ElevenLabs SDK] Error cerrando conversación ${sessionInfo.id}:`, error);
      }
    }
  }
}

// Cleanup al salir
process.on('SIGINT', async () => {
  await closeAllConversations();
  process.exit(0);
});