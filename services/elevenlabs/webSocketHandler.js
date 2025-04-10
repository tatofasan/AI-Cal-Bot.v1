// src/services/elevenlabs/webSocketHandler.js
import WebSocket from "ws";

/**
 * Maneja los eventos de mensajes recibidos desde el WebSocket de ElevenLabs
 * @param {WebSocket} elevenLabsWs - WebSocket de conexión con ElevenLabs
 * @param {WebSocket} twilioWs - WebSocket de conexión con Twilio
 * @param {Object} state - Estado de la conexión (streamSid, callSid)
 * @param {Object} message - Mensaje recibido desde ElevenLabs
 */
export const handleElevenLabsMessage = async (elevenLabsWs, twilioWs, state, message) => {
  try {
    switch (message.type) {
      case "conversation_initiation_metadata":
        console.log("[ElevenLabs] Recibido metadata de iniciación");
        break;

      case "audio":
        await handleAudioMessage(twilioWs, state, message);
        break;

      case "interruption":
        console.log("[ElevenLabs] Recibido evento de interrupción");
        if (state.streamSid) {
          twilioWs.send(
            JSON.stringify({
              event: "clear",
              streamSid: state.streamSid,
            })
          );
        }
        break;

      case "ping":
        if (message.ping_event?.event_id) {
          elevenLabsWs.send(
            JSON.stringify({
              type: "pong",
              event_id: message.ping_event.event_id,
            })
          );
        }
        break;

      case "agent_response":
        console.log(
          `[Twilio] Respuesta del agente: ${message.agent_response_event?.agent_response}`
        );
        break;

      case "user_transcript":
        console.log(
          `[Twilio] Transcripción del usuario: ${message.user_transcription_event?.user_transcript}`
        );
        break;

      default:
        console.log(
          `[ElevenLabs] Tipo de mensaje no manejado: ${message.type}`
        );
    }
  } catch (error) {
    console.error("[ElevenLabs] Error procesando mensaje:", error);
  }
};

/**
 * Maneja específicamente los mensajes de audio desde ElevenLabs
 * @param {WebSocket} twilioWs - WebSocket de conexión con Twilio
 * @param {Object} state - Estado de la conexión
 * @param {Object} message - Mensaje de audio recibido
 */
async function handleAudioMessage(twilioWs, state, message) {
  if (state.streamSid) {
    const payload = message.audio?.chunk || message.audio_event?.audio_base_64;
    if (payload) {
      console.log("[ElevenLabs] Audio chunk recibido");

      // Generar un ID único para este fragmento de audio
      const audioId = Date.now() + Math.random().toString(36).substr(2, 9);

      // Enviar a Twilio
      const audioData = {
        event: "media",
        streamSid: state.streamSid,
        media: {
          payload,
        },
      };
      twilioWs.send(JSON.stringify(audioData));

      // Enviar a todos los clientes de logs (frontend) para el audio del bot
      const { logClients } = await import("../../utils/logger.js");
      logClients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(
            JSON.stringify({
              type: "audio",
              id: audioId, // Añadir ID único
              payload,
            })
          );
        }
      });
    }
  } else {
    console.log("[ElevenLabs] Recibido audio pero aún no hay streamSid");
  }
}

/**
 * Envía la configuración inicial al WebSocket de ElevenLabs
 * @param {WebSocket} elevenLabsWs - WebSocket de conexión con ElevenLabs
 * @param {Object} customParameters - Parámetros personalizados de la llamada
 */
export const sendInitialConfig = (elevenLabsWs, customParameters) => {
  try {
    // Extraer el nombre del usuario de los parámetros
    const userName = customParameters?.user_name || "Usuario";
    const voiceId = customParameters?.voice_id || "";
    const voiceName = customParameters?.voice_name || "";

    console.log("[ElevenLabs] Enviando configuración inicial");
    console.log("[ElevenLabs] Voiceid", voiceId);

    // Configuración inicial con conversation_config_override para tts utilizando la estructura requerida
    const initialConfig = {
      type: "conversation_initiation_client_data",
      dynamic_variables: {
        user_name: userName,
        voice_name: voiceName || "",
      },
      conversation_config_override: {
        tts: {
          voice_id: voiceId || "",
        },
      },
    };

    elevenLabsWs.send(JSON.stringify(initialConfig));
  } catch (error) {
    console.error("[ElevenLabs] Error enviando configuración inicial:", error);
  }
};