// src/services/elevenlabs/twilioHandler.js
import WebSocket from "ws";
import { amplifyAudio, processAudioForSpeechRecognition } from "../../utils/audioProcessor.js";
import { twilioClient } from "../twilioService.js";
import { broadcastToSession, getSession } from "../../utils/sessionManager.js";

// Variable para controlar la frecuencia de los logs
let mediaLogCounter = 0;
const MEDIA_LOG_FREQUENCY = 50; // Loguear solo 1 de cada 50 mensajes de media

/**
 * Maneja los mensajes recibidos desde el WebSocket de Twilio
 * @param {Object} msg - Mensaje recibido desde Twilio
 * @param {WebSocket} twilioWs - WebSocket de conexión con Twilio
 * @param {WebSocket} elevenLabsWs - WebSocket de conexión con ElevenLabs
 * @param {Object} state - Estado de la conexión a actualizar
 * @param {Function} onStreamStart - Callback a ejecutar cuando inicia el stream
 */
export const handleTwilioMessage = async (msg, twilioWs, elevenLabsWs, state, onStreamStart) => {
  try {
    switch (msg.event) {
      case "start":
        state.streamSid = msg.start.streamSid;
        state.callSid = msg.start.callSid;

        // Asegurarse de que el streamSid se guarde en el objeto WebSocket para uso por el agente
        twilioWs.streamSid = state.streamSid;

        // Extraer y guardar los parámetros personalizados
        if (msg.start.customParameters) {
          state.customParameters = msg.start.customParameters;
          console.log("[Twilio] Parámetros personalizados recibidos", 
            { sessionId: state.sessionId });
        }

        console.log(`[Twilio] Stream iniciado - StreamSid: ${state.streamSid}`, 
          { sessionId: state.sessionId });

        // Ejecutar callback de inicio de stream (para conectar con ElevenLabs)
        if (onStreamStart && typeof onStreamStart === 'function') {
          try {
            await onStreamStart();
          } catch (error) {
            console.error("[Twilio] Error en callback onStreamStart:", error, { sessionId: state.sessionId });
          }
        } else {
          console.log("[Twilio] No se proporcionó callback onStreamStart o no es una función", { sessionId: state.sessionId });
        }
        break;

      case "media":
        // Enviar audio del cliente a la sesión correcta
        await handleMediaMessage(msg, elevenLabsWs, state.sessionId);
        break;

      case "stop":
        console.log(`[Twilio] Stream ${state.streamSid} finalizado`, 
          { sessionId: state.sessionId });
        if (elevenLabsWs?.readyState === WebSocket.OPEN) {
          elevenLabsWs.close();
        }
        break;

      default:
        console.log(`[Twilio] Evento no manejado: ${msg.event}`, 
          { sessionId: state.sessionId });
        break;
    }
  } catch (error) {
    console.error("[Twilio] Error procesando mensaje de Twilio:", error, 
      { sessionId: state.sessionId });
  }
};

/**
 * Maneja específicamente los mensajes de media desde Twilio
 * @param {Object} msg - Mensaje de media recibido
 * @param {WebSocket} elevenLabsWs - WebSocket de conexión con ElevenLabs
 * @param {string} sessionId - ID de la sesión
 */
async function handleMediaMessage(msg, elevenLabsWs, sessionId) {
  // Incrementar contador para logging reducido
  mediaLogCounter++;
  const shouldLog = (mediaLogCounter % MEDIA_LOG_FREQUENCY === 0);

  // Verificar si hay un agente activo antes de enviar audio a ElevenLabs
  const session = getSession(sessionId);
  const isAgentActive = session && session.isAgentActive && session.agentWs;

  // Si hay un agente activo, no enviamos el audio del cliente a ElevenLabs
  // Esto evita que ElevenLabs procese y responda mientras el agente está hablando
  if (!isAgentActive && elevenLabsWs?.readyState === WebSocket.OPEN) {
    try {
      // Procesar el audio para mejorar la transcripción
      const processedPayload = processAudioForSpeechRecognition(msg.media.payload);

      const audioMessage = {
        user_audio_chunk: Buffer.from(processedPayload, "base64").toString("base64"),
      };

      elevenLabsWs.send(JSON.stringify(audioMessage));

      // Log reducido para monitoreo
      if (shouldLog) {
        console.log("[AudioProcessor] Audio procesado y enviado a ElevenLabs", { sessionId });
      }
    } catch (error) {
      console.error(
        "[Twilio] Error al procesar audio:",
        error,
        { sessionId }
      );
      // Si ocurre un error en el procesamiento, intentamos enviar el audio original
      try {
        const originalAudioMessage = {
          user_audio_chunk: Buffer.from(msg.media.payload, "base64").toString("base64"),
        };
        elevenLabsWs.send(JSON.stringify(originalAudioMessage));
        if (shouldLog) {
          console.log("[AudioProcessor] Fallback: Audio original enviado", { sessionId });
        }
      } catch (fallbackError) {
        console.error("[Twilio] Error en fallback de audio:", fallbackError, { sessionId });
      }
    }
  }

  // Generar un ID único para este fragmento de audio del cliente
  const clientAudioId = Date.now() + Math.random().toString(36).substr(2, 9);

  // Enviar el audio a los clientes de logs de esta sesión específica para monitoreo
  if (sessionId) {
    broadcastToSession(sessionId, {
      type: "client_audio",
      id: clientAudioId,
      payload: msg.media.payload
    });
  }
}

/**
 * Finaliza la llamada de Twilio cuando se cierra la conexión con ElevenLabs
 * @param {string} callSid - SID de la llamada de Twilio a finalizar
 */
export const endTwilioCall = async (callSid) => {
  if (callSid) {
    try {
      // Verificar estado actual de la llamada
      const call = await twilioClient.calls(callSid).fetch();

      if (call.status !== "completed" && call.status !== "canceled") {
        await twilioClient.calls(callSid).update({ status: "completed" });
        console.log(`[ElevenLabs] Llamada ${callSid} finalizada correctamente via twilioService`);
      } else {
        console.log(`[ElevenLabs] Llamada ${callSid} ya estaba finalizada (estado: ${call.status})`);
      }
    } catch (error) {
      console.error("[ElevenLabs] Error al verificar/finalizar la llamada:", error);
    }
  }
};