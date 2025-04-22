// src/services/elevenlabs/mediaStreamService.js
import WebSocket from "ws";
import { setupElevenLabsConnection, closeElevenLabsConnection } from "./connectionManager.js";
import { handleTwilioMessage } from "./twilioHandler.js";
import { 
  registerTwilioConnection, 
  removeTwilioConnection,
} from "../../utils/sessionManager.js";
import { getSession, createSession } from "../../services/sessionService.js";

// Variable para controlar la frecuencia de los logs
let messageLogCounter = 0;
const MESSAGE_LOG_FREQUENCY = 50; // Registrar solo 1 de cada 50 mensajes

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

  // Asegurarnos de que la sesión existe
  const session = getSession(sessionId);
  if (!session) {
    console.log(`[Server] Creando sesión nueva para ${sessionId} durante setupMediaStream`);
    createSession(sessionId);
  }

  console.info(
    "[Server] WebSocket connection established for outbound media stream",
    { sessionId }
  );

  // Registrar la conexión de Twilio en el gestor de sesiones
  registerTwilioConnection(sessionId, ws);

  // Variables para mantener el estado
  const state = {
    streamSid: null,
    callSid: null,
    customParameters: {},
    sessionId: sessionId // Agregar sessionId al estado
  };

  let elevenLabsWs = null;

  // Manejador de errores
  ws.on("error", (error) => {
    console.error("[WebSocket Error]", error, { sessionId });
  });

  // Procesar mensajes de Twilio
  ws.on("message", async (message) => {
    try {
      // Intentar parsear el mensaje como JSON
      let msg;
      try {
        msg = JSON.parse(message);
      } catch (e) {
        console.error("[Twilio] Error parseando mensaje:", e, message.toString().substring(0, 100));
        return;
      }

      // Log reducido - solo para eventos específicos o con baja frecuencia
      messageLogCounter++;
      if (messageLogCounter % MESSAGE_LOG_FREQUENCY === 0 || msg.event !== 'media') {
        console.log("[Twilio] Evento:", msg.event, { sessionId });
      }

      // Si tenemos un evento 'start', verificar los parámetros personalizados para el sessionId
      if (msg.event === 'start' && msg.start) {
        // Log completo para diagnóstico
        console.log("[Twilio] Mensaje start completo:", JSON.stringify(msg.start));

        // Si tenemos un streamSid, guardarlo en el objeto ws Y en el estado para que el agente pueda usarlo
        if (msg.start.streamSid) {
          state.streamSid = msg.start.streamSid;
          ws.streamSid = msg.start.streamSid; // IMPORTANTE: Guardar en el objeto WebSocket
          console.log(`[Twilio] Guardando streamSid ${ws.streamSid} en el WebSocket`, 
            { sessionId });
        }

        // Si tenemos un callSid, guardarlo también
        if (msg.start.callSid) {
          state.callSid = msg.start.callSid;
          console.log(`[Twilio] Guardando callSid ${state.callSid}`, { sessionId });
        }

        // Extraer y guardar los parámetros personalizados
        if (msg.start.customParameters) {
          state.customParameters = msg.start.customParameters;
          console.log("[Twilio] Parámetros personalizados recibidos:", 
            JSON.stringify(state.customParameters),
            { sessionId });

          // Si hay un sessionId en los parámetros personalizados y no coincide con el actual,
          // actualizar el sessionId - podemos usar cualquiera de los dos nombres de parámetro
          const paramSessionId = msg.start.customParameters.sessionId || msg.start.customParameters.session_id;

          if (paramSessionId && paramSessionId !== sessionId) {
            const newSessionId = paramSessionId;
            console.log(`[Twilio] Actualizando sessionId de ${sessionId} a ${newSessionId}`);

            // Actualizar sessionId en el estado
            state.sessionId = newSessionId;
            ws.sessionId = newSessionId;

            // Re-registrar la conexión con el nuevo sessionId
            removeTwilioConnection(ws);
            registerTwilioConnection(newSessionId, ws);

            // Actualizar la referencia para logs futuros
            sessionId = newSessionId;
          }

          // Iniciar la conexión con ElevenLabs inmediatamente después de procesar 
          // el mensaje start con los parámetros
          try {
            elevenLabsWs = await setupElevenLabsConnection(state, ws);
          } catch (elevenlabsError) {
            console.error("[Twilio] Error iniciando ElevenLabs:", elevenlabsError, { sessionId });
          }
        }

        // Imprimir un mensaje detallado al iniciar el stream
        console.log(`[Twilio] Stream iniciado - StreamSid: ${state.streamSid}, SessionId: ${sessionId}`, 
          { sessionId });
      }

      // Si no hay elevenLabsWs aún e intentamos procesar audio, reintentar la conexión
      if (msg.event === 'media' && !elevenLabsWs && state.customParameters) {
        // Solo intentar una vez cada cierto número de mensajes para no sobrecargar
        if (messageLogCounter % 20 === 0) {
          console.log("[Twilio] Intentando reconectar con ElevenLabs", { sessionId });
          try {
            elevenLabsWs = await setupElevenLabsConnection(state, ws);
          } catch (retryError) {
            console.error("[Twilio] Error en reintento de conexión con ElevenLabs:", retryError, { sessionId });
          }
        }
      }

      // Usar la función de manejo de mensajes de Twilio
      handleTwilioMessage(
        msg, 
        ws, 
        elevenLabsWs, 
        state, 
        // Callback para iniciar ElevenLabs después de recibir parámetros
        async () => {
          // Solo iniciar si aún no se ha iniciado
          if (!elevenLabsWs) {
            try {
              elevenLabsWs = await setupElevenLabsConnection(state, ws);
            } catch (callbackError) {
              console.error("[Twilio] Error en callback de inicialización de ElevenLabs:", callbackError, { sessionId });
            }
          }
        }
      );
    } catch (error) {
      console.error("[Twilio] Error procesando mensaje de Twilio:", error, { sessionId });
    }
  });

  // Manejar cierre de conexión
  ws.on("close", () => {
    console.log("[Twilio] Cliente desconectado", { sessionId });
    closeElevenLabsConnection(elevenLabsWs);
    removeTwilioConnection(ws);
  });
};