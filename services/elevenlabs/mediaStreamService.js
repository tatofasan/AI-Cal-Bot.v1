// src/services/elevenlabs/mediaStreamService.js
import { setupMediaStream } from "../elevenLabsService.js";
import { 
  registerTwilioConnection, 
  removeTwilioConnection,
} from "../../utils/sessionManager.js";
import { getSession, createSession } from "../sessionService.js";

/**
 * Configura el stream de medios para la comunicación entre Twilio y ElevenLabs
 * Esta es una función de compatibilidad que mapea a la nueva implementación con SDK
 * @param {WebSocket} ws - WebSocket de conexión con Twilio
 * @param {string} sessionId - ID de sesión para asociar con esta conexión
 */
export const setupMediaStreamLegacy = async (ws, sessionId) => {
  // Validar que tenemos un sessionId
  if (!sessionId) {
    console.error("[MediaStream] ERROR: setupMediaStream llamado sin sessionId");
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    console.info("[MediaStream] Generado sessionId de emergencia:", sessionId);
  }

  // Asegurarnos de que la sesión existe
  const session = getSession(sessionId);
  if (!session) {
    console.log(`[MediaStream] Creando sesión nueva para ${sessionId}`);
    createSession(sessionId);
  }

  console.info(
    "[MediaStream] WebSocket connection established for outbound media stream",
    { sessionId }
  );

  // Registrar la conexión de Twilio en el gestor de sesiones
  registerTwilioConnection(sessionId, ws);

  // Variables para mantener el estado
  const state = {
    streamSid: null,
    callSid: null,
    customParameters: {},
    sessionId: sessionId
  };

  let conversationReady = false;

  // Manejador de errores
  ws.on("error", (error) => {
    console.error("[MediaStream Error]", error, { sessionId });
  });

  // Procesar mensajes de Twilio
  ws.on("message", async (message) => {
    try {
      let msg;
      try {
        msg = JSON.parse(message);
      } catch (e) {
        console.error("[MediaStream] Error parseando mensaje:", e);
        return;
      }

      // Log solo para eventos importantes
      if (msg.event !== 'media') {
        console.log("[MediaStream] Evento:", msg.event, { sessionId });
      }

      // Procesar evento start
      if (msg.event === 'start' && msg.start) {
        state.streamSid = msg.start.streamSid;
        state.callSid = msg.start.callSid;
        ws.streamSid = state.streamSid;
        ws.callSid = state.callSid;

        // Extraer parámetros personalizados
        if (msg.start.customParameters) {
          state.customParameters = msg.start.customParameters;

          // Actualizar sessionId si viene en los parámetros
          const paramSessionId = msg.start.customParameters.sessionId || msg.start.customParameters.session_id;
          if (paramSessionId && paramSessionId !== sessionId) {
            const newSessionId = paramSessionId;
            console.log(`[MediaStream] Actualizando sessionId de ${sessionId} a ${newSessionId}`);

            state.sessionId = newSessionId;
            ws.sessionId = newSessionId;

            removeTwilioConnection(ws);
            registerTwilioConnection(newSessionId, ws);

            sessionId = newSessionId;
          }
        }

        console.log(`[MediaStream] Stream iniciado - StreamSid: ${state.streamSid}, SessionId: ${sessionId}`);

        // Iniciar la conversación con ElevenLabs usando el SDK
        try {
          await setupMediaStream(ws, sessionId, state.customParameters);
          conversationReady = true;
        } catch (error) {
          console.error("[MediaStream] Error iniciando conversación con ElevenLabs:", error);
        }
      }

      // Los eventos de media ya son manejados por el nuevo servicio
      // Solo necesitamos asegurarnos de que la conversación esté lista
      if (msg.event === 'media' && !conversationReady) {
        console.log("[MediaStream] Audio recibido pero conversación no está lista", { sessionId });
      }

    } catch (error) {
      console.error("[MediaStream] Error procesando mensaje de Twilio:", error, { sessionId });
    }
  });

  // Manejar cierre de conexión
  ws.on("close", () => {
    console.log("[MediaStream] Cliente desconectado", { sessionId });
    removeTwilioConnection(ws);
  });
};

// Exportar con el nombre esperado para compatibilidad
export { setupMediaStreamLegacy as setupMediaStream };