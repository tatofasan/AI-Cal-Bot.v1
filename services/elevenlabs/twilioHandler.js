// src/services/elevenlabs/twilioHandler.js
import WebSocket from "ws";
import { amplifyAudio } from "../../utils/audioAmplifier.js";

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

        // Extraer y guardar los parámetros personalizados
        if (msg.start.customParameters) {
          state.customParameters = msg.start.customParameters;
          console.log("[Twilio] Parámetros personalizados recibidos");
        }

        console.log(`[Twilio] Stream iniciado - StreamSid: ${state.streamSid}`);

        // Ejecutar callback de inicio de stream (para conectar con ElevenLabs)
        if (onStreamStart) {
          onStreamStart();
        }
        break;

      case "media":
        await handleMediaMessage(msg, elevenLabsWs);
        break;

      case "stop":
        console.log(`[Twilio] Stream ${state.streamSid} finalizado`);
        if (elevenLabsWs?.readyState === WebSocket.OPEN) {
          elevenLabsWs.close();
        }
        break;

      default:
        console.log(`[Twilio] Evento no manejado: ${msg.event}`);
        break;
    }
  } catch (error) {
    console.error("[Twilio] Error procesando mensaje de Twilio:", error);
  }
};

/**
 * Maneja específicamente los mensajes de media desde Twilio
 * @param {Object} msg - Mensaje de media recibido
 * @param {WebSocket} elevenLabsWs - WebSocket de conexión con ElevenLabs
 */
async function handleMediaMessage(msg, elevenLabsWs) {
  if (elevenLabsWs?.readyState === WebSocket.OPEN) {
    try {
      // Amplificar el audio antes de enviarlo a ElevenLabs
      const gainFactor = 2.0; // Factor de amplificación
      const amplifiedPayload = amplifyAudio(msg.media.payload, gainFactor);
      const audioMessage = {
        user_audio_chunk: Buffer.from(amplifiedPayload, "base64").toString("base64"),
      };
      elevenLabsWs.send(JSON.stringify(audioMessage));
    } catch (error) {
      console.error(
        "[Twilio] Error al amplificar o enviar audio a ElevenLabs:",
        error
      );
      // Si ocurre un error en la amplificación, intentamos enviar el audio original
      try {
        const originalAudioMessage = {
          user_audio_chunk: Buffer.from(msg.media.payload, "base64").toString("base64"),
        };
        elevenLabsWs.send(JSON.stringify(originalAudioMessage));
        console.log("[AudioAmplifier] Fallback: Audio original enviado sin amplificar");
      } catch (fallbackError) {
        console.error("[Twilio] Error en fallback de audio:", fallbackError);
      }
    }
  }

  // Reenviar el audio del cliente a los log clients para monitoreo con un ID único
  const { logClients } = await import("../../utils/logger.js");

  // Generar un ID único para este fragmento de audio del cliente
  const clientAudioId = Date.now() + Math.random().toString(36).substr(2, 9);

  logClients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(
        JSON.stringify({
          type: "client_audio",
          id: clientAudioId, // Añadir ID único
          payload: msg.media.payload,
        })
      );
    }
  });
}

/**
 * Finaliza la llamada de Twilio cuando se cierra la conexión con ElevenLabs
 * @param {string} callSid - SID de la llamada de Twilio a finalizar
 */
export const endTwilioCall = async (callSid) => {
  if (callSid) {
    try {
      const { twilioClient } = await import("../twilioService.js");
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