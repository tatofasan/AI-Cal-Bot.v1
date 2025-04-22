// src/services/elevenlabs/webSocketHandler.js
import WebSocket from "ws";
import { broadcastToSession } from "../../utils/sessionManager.js";
import { addTranscription } from "../../services/sessionService.js";

/**
 * Maneja los eventos de mensajes recibidos desde el WebSocket de ElevenLabs
 * @param {WebSocket} elevenLabsWs - WebSocket de conexión con ElevenLabs
 * @param {WebSocket} twilioWs - WebSocket de conexión con Twilio
 * @param {Object} state - Estado de la conexión (streamSid, callSid)
 * @param {Object} message - Mensaje recibido desde ElevenLabs
 */
export const handleElevenLabsMessage = async (
  elevenLabsWs,
  twilioWs,
  state,
  message,
) => {
  try {
    switch (message.type) {
      case "conversation_initiation_metadata":
        console.log("[ElevenLabs] Recibido metadata de iniciación", {
          sessionId: state.sessionId,
        });
        break;

      case "audio":
        await handleAudioMessage(twilioWs, state, message);
        break;

      case "interruption":
        console.log("[ElevenLabs] Recibido evento de interrupción", {
          sessionId: state.sessionId,
        });

        // Notificar a los clientes del frontend sobre la interrupción
        broadcastToSession(state.sessionId, {
          type: "interruption",
          message: "Bot interrumpido por el agente",
        });

        if (state.streamSid) {
          twilioWs.send(
            JSON.stringify({
              event: "clear",
              streamSid: state.streamSid,
            }),
          );
        }
        break;

      case "ping":
        if (message.ping_event?.event_id) {
          elevenLabsWs.send(
            JSON.stringify({
              type: "pong",
              event_id: message.ping_event.event_id,
            }),
          );
        }
        break;

      case "agent_response":
        console.log(
          `[Twilio] Respuesta del agente: ${message.agent_response_event?.agent_response}`,
          { sessionId: state.sessionId },
        );

        // Guardar la respuesta del agente (bot) como transcripción
        if (message.agent_response_event?.agent_response) {
          addTranscription(
            state.sessionId, 
            message.agent_response_event.agent_response,
            'bot'
          );
        }
        break;

      case "user_transcript":
        console.log(
          `[Twilio] Transcripción del usuario: ${message.user_transcription_event?.user_transcript}`,
          { sessionId: state.sessionId },
        );

        // Guardar la transcripción del usuario
        if (message.user_transcription_event?.user_transcript) {
          addTranscription(
            state.sessionId,
            message.user_transcription_event.user_transcript,
            'client'
          );
        }
        break;

      case "agent_transcript_result":
        // Nuevo: Manejar la transcripción del audio del agente humano
        if (message.transcript && message.transcript.text) {
          console.log(
            `[AgentVoice] Transcripción recibida: ${message.transcript.text}`,
            { sessionId: state.sessionId },
          );

          // Guardar la transcripción del agente humano
          addTranscription(
            state.sessionId,
            message.transcript.text,
            'agent'
          );

          // Enviar la transcripción a los clientes para mostrarla en la interfaz
          broadcastToSession(state.sessionId, {
            type: "agent_speech",
            id: Date.now() + Math.random().toString(36).substr(2, 9),
            text: message.transcript.text,
            isAgent: true,
          });
        }
        break;

      case "agent_speech_ready":
        // Nuevo: Manejar el audio sintetizado del texto del agente
        if (message.audio_event && message.audio_event.audio_base_64) {
          console.log(
            "[AgentVoice] Audio sintetizado recibido para agente humano",
            { sessionId: state.sessionId },
          );

          // Enviar el audio sintetizado a Twilio para reproducir al cliente
          await handleAudioMessage(twilioWs, state, {
            audio: { chunk: message.audio_event.audio_base_64 },
          });

          // Guardar el texto original si está disponible
          if (message.original_text) {
            addTranscription(
              state.sessionId,
              message.original_text,
              'agent'
            );
          }

          // Marcar el mensaje como proveniente del agente humano para la interfaz
          broadcastToSession(state.sessionId, {
            type: "agent_speech",
            id: Date.now() + Math.random().toString(36).substr(2, 9),
            text: message.original_text || "Mensaje del agente",
          });
        }
        break;

      default:
        console.log(
          `[ElevenLabs] Tipo de mensaje no manejado: ${message.type}`,
          { sessionId: state.sessionId },
        );
    }
  } catch (error) {
    console.error("[ElevenLabs] Error procesando mensaje:", error, {
      sessionId: state.sessionId,
    });
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

      // Enviar el audio a los clientes de logs de esta sesión específica
      if (state.sessionId) {
        broadcastToSession(state.sessionId, {
          type: "audio",
          id: audioId,
          payload,
        });
      }
    }
  } else {
    console.log("[ElevenLabs] Recibido audio pero aún no hay streamSid", {
      sessionId: state.sessionId,
    });
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
    const voiceName = customParameters?.voice_name || '';
    const sessionId = elevenLabsWs.sessionId;

    console.log("[ElevenLabs] Enviando configuración inicial", { sessionId });
    console.log("[ElevenLabs] Voiceid", voiceId, { sessionId });

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
        // Permitir que el agente humano pueda enviar audio y tomar el control
        agent_control: {
          enabled: true,
          allow_agent_audio: true,
        },
      },
    };

    elevenLabsWs.send(JSON.stringify(initialConfig));
  } catch (error) {
    console.error("[ElevenLabs] Error enviando configuración inicial:", error, {
      sessionId: elevenLabsWs.sessionId,
    });
  }
};