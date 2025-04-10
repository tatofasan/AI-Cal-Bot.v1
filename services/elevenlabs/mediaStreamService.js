// src/services/elevenlabs/mediaStreamService.js
import WebSocket from "ws";
import { orchestrator } from "../orchestrator/index.js";
import { broadcastToSession } from "../../utils/sessionManager.js";
import { registerTwilioConnection } from "../../utils/sessionManager.js";

// Variable para controlar la frecuencia de los logs
let messageLogCounter = 0;
const MESSAGE_LOG_FREQUENCY = 200; // Aumentado: Registrar solo 1 de cada 200 mensajes

/**
 * Configura el stream de medios para la comunicación entre Twilio y ElevenLabs
 * @param {WebSocket} ws - WebSocket de conexión con Twilio
 * @param {string} sessionId - ID de sesión para asociar con esta conexión
 */
export const setupMediaStream = async (ws, sessionId) => {
  // Validar que tenemos un sessionId
  if (!sessionId) {
    console.error("[Server] ERROR: setupMediaStream llamado sin sessionId");
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    console.info("[Server] Generado sessionId de emergencia:", sessionId);
  }

  console.info(
    "[Server] WebSocket connection established for outbound media stream",
    { sessionId }
  );

  // Variables para mantener el estado
  const state = {
    streamSid: null,
    callSid: null,
    customParameters: {},
    sessionId: sessionId // Agregar sessionId al estado
  };

  // Registrar la conexión de Twilio en el gestor de sesiones
  registerTwilioConnection(sessionId, ws);

  // Registrar la conexión de Twilio en el orquestador
  orchestrator.registerTwilioWebSocket(ws, sessionId, state);

  // Manejador de errores
  ws.on("error", (error) => {
    console.error("[WebSocket Error]", error, { sessionId });
  });

  // Procesar mensajes de Twilio
  ws.on("message", (message) => {
    try {
      const msg = JSON.parse(message);

      // Log reducido - solo para eventos específicos o con baja frecuencia
      messageLogCounter++;
      if (messageLogCounter % MESSAGE_LOG_FREQUENCY === 0 || msg.event !== 'media') {
        // Se reduce aún más la frecuencia de los logs para evitar spam
        console.log("[Twilio] Evento:", msg.event, { sessionId });
      }

      // Si tenemos un evento 'start', verificar los parámetros personalizados para el sessionId
      if (msg.event === 'start' && msg.start && msg.start.customParameters) {
        // Si hay un sessionId en los parámetros personalizados y no coincide con el actual,
        // actualizar el sessionId
        if (msg.start.customParameters.sessionId && 
            msg.start.customParameters.sessionId !== sessionId) {
          const newSessionId = msg.start.customParameters.sessionId;
          console.log(`[Twilio] Actualizando sessionId de ${sessionId} a ${newSessionId}`);

          // Actualizar sessionId en el estado
          state.sessionId = newSessionId;
          ws.sessionId = newSessionId;

          // Actualizar la referencia para logs futuros
          sessionId = newSessionId;

          // Re-registrar la conexión con el nuevo sessionId
          orchestrator.streamManager.removeConnection(ws);
          orchestrator.registerTwilioWebSocket(ws, newSessionId, state);
        }
      }

      // Usar el orquestador para manejar mensajes de Twilio
      orchestrator.handleTwilioMessage(
        msg, 
        state, 
        // Callback para iniciar ElevenLabs después de recibir parámetros
        async () => {
          try {
            // Verificamos que la conexión Twilio siga registrada correctamente
            if (!orchestrator.streamManager.connections.twilio.has(state.sessionId)) {
              console.log("[MediaStreamService] Re-registrando conexión Twilio antes de iniciar ElevenLabs", 
                        { sessionId: state.sessionId });
              orchestrator.registerTwilioWebSocket(ws, state.sessionId, state);
            }

            // Iniciar ElevenLabs a través del orquestador
            await orchestrator.elevenLabsProvider.initialize(state.customParameters, state.sessionId);

            // Verificación de depuración después de configuración
            // Disminuir verbosidad de logs
            /*const hasTwilioConn = orchestrator.streamManager.connections.twilio.has(state.sessionId);
            const hasElevenLabsConn = orchestrator.streamManager.connections.elevenlabs.has(state.sessionId);
            console.log(`[MediaStreamService] Estado de conexiones después de inicialización: Twilio (${hasTwilioConn}), ElevenLabs (${hasElevenLabsConn})`, 
                      { sessionId: state.sessionId });*/
          } catch (error) {
            console.error("[Orchestrator] Error inicializando ElevenLabs:", error, { sessionId: state.sessionId });
          }
        }
      );
    } catch (error) {
      console.error("[Twilio] Error procesando mensaje de Twilio:", error, { sessionId });
    }
  });

  // Manejar cierre de conexión
  ws.on("close", () => {
    // Reducir este log para evitar spam
    if (messageLogCounter % MESSAGE_LOG_FREQUENCY === 0) {
      console.log("[Twilio] Cliente desconectado", { sessionId });
    }

    // Finalizar la conexión de ElevenLabs a través del orquestador
    if (orchestrator.elevenLabsProvider.isActiveForSession(sessionId)) {
      orchestrator.elevenLabsProvider.terminate(sessionId);
    } else {
      // Este log también se muestra con menor frecuencia
      if (messageLogCounter % MESSAGE_LOG_FREQUENCY === 0) {
        console.log("[MediaStreamService] No hay conexión ElevenLabs activa para finalizar", { sessionId });
      }
    }
  });
};