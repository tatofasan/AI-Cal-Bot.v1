// src/services/speechService.js
import WebSocket from "ws";
import { getSession, broadcastToSession } from "../utils/sessionManager.js";

/**
 * Procesa el audio enviado por el agente y lo reenvía directamente a Twilio
 * @param {string} sessionId - ID de la sesión
 * @param {object} data - Datos del audio (formato, payload, etc.)
 */
export async function processAgentAudio(sessionId, data) {
  // Obtener la sesión actual
  const session = getSession(sessionId);
  if (!session) {
    console.error("[AgentVoice] No se encontró la sesión para el audio del agente", { sessionId });
    return;
  }

  // Verificar si hay una conexión con Twilio
  if (!session.twilioWs || session.twilioWs.readyState !== WebSocket.OPEN) {
    console.error("[AgentVoice] No hay conexión activa con Twilio", { sessionId });
    return;
  }

  try {
    // Verificar si hay un streamSid disponible (necesario para enviar audio a Twilio)
    if (!session.twilioWs.streamSid) {
      console.error("[AgentVoice] No hay streamSid disponible para enviar audio", { sessionId });
      return;
    }

    // Si hay una conexión activa con ElevenLabs, enviar comando para interrumpir cualquier salida
    if (session.elevenLabsWs && session.elevenLabsWs.readyState === WebSocket.OPEN) {
      try {
        session.elevenLabsWs.send(JSON.stringify({ 
          type: "interruption" 
        }));

        // Registrar que se envió la interrupción a ElevenLabs
        if (!session.isAgentActiveInterruptSent) {
          console.log("[AgentVoice] Enviado comando de interrupción a ElevenLabs", { sessionId });
          session.isAgentActiveInterruptSent = true;

          // También enviar el comando clear a Twilio para limpiar cualquier buffer
          session.twilioWs.send(JSON.stringify({
            event: "clear",
            streamSid: session.twilioWs.streamSid
          }));
        }
      } catch (interruptError) {
        console.error("[AgentVoice] Error enviando interrupción a ElevenLabs:", interruptError, { sessionId });
      }
    }

    // Si el audio es marcado como silencio, podríamos no enviarlo a Twilio para optimizar
    // Sin embargo, algunos silencios son importantes para mantener la naturalidad del habla
    const isSilence = data.isSilence || data.is_silence;

    // Para fragmentos de silencio, verificamos si deberíamos enviarlos o no
    if (isSilence) {
      // Para mantener track del último audio enviado
      const now = Date.now();
      const lastAudioSent = session.lastAudioSent || 0;

      // Si han pasado más de 500ms desde el último audio, enviamos un silencio
      // para mantener la conexión activa
      if (now - lastAudioSent < 500) {
        // Silencio reciente, podemos omitirlo
        return;
      }
    }

    // CRÍTICO: El formato del mensaje debe coincidir EXACTAMENTE con lo que espera Twilio
    // Twilio Media Streams espera recibir un mensaje con esta estructura exacta:
    // { event: "media", streamSid: "XX...", media: { payload: "base64data" } }
    const audioData = {
      event: "media",
      streamSid: session.twilioWs.streamSid,
      media: {
        payload: data.payload
      }
    };

    // Enviar a Twilio como una cadena JSON formateada correctamente
    session.twilioWs.send(JSON.stringify(audioData));

    // Actualizar timestamp del último audio enviado
    session.lastAudioSent = Date.now();

    // También enviar el audio a los clientes de logs para monitoreo
    // (solo enviamos audio real, no silencio, para reducir tráfico)
    if (!isSilence) {
      const audioId = Date.now() + Math.random().toString(36).substr(2, 9);
      broadcastToSession(sessionId, {
        type: "agent_audio",
        id: audioId,
        payload: data.payload
      });
    }

  } catch (error) {
    console.error("[AgentVoice] Error procesando audio del agente:", error, { sessionId });
  }
}

/**
 * Procesa una transcripción del agente y la envía como mensaje informativo
 * @param {string} sessionId - ID de la sesión
 * @param {string} transcript - Texto del agente para mostrar en logs
 */
export async function processAgentTranscript(sessionId, transcript) {
  // Obtener la sesión actual
  const session = getSession(sessionId);
  if (!session) {
    console.error("[AgentVoice] No se encontró la sesión para la transcripción", { sessionId });
    return;
  }

  try {
    // Registrar la transcripción para propósitos de logging
    console.log(`[AgentVoice] Mensaje del agente: ${transcript}`, { sessionId });

    // Enviar a los clientes de log para mostrar en la interfaz
    const logMessage = `[LOG] [AgentVoice] Mensaje del agente: ${transcript}`;
    broadcastToSession(sessionId, logMessage);

    // También enviar como transcripción formateada para mostrar en el chat
    broadcastToSession(sessionId, {
      type: "agent_speech",
      id: Date.now() + Math.random().toString(36).substr(2, 9),
      text: transcript
    });

  } catch (error) {
    console.error("[AgentVoice] Error procesando mensaje del agente:", error, { sessionId });
  }
}

/**
 * Procesa comandos de interrupción del agente hacia el bot
 * @param {string} sessionId - ID de la sesión
 */
export async function processAgentInterrupt(sessionId) {
  const session = getSession(sessionId);
  if (!session) {
    console.error("[AgentVoice] No se encontró la sesión para la interrupción", { sessionId });
    return;
  }

  try {
    // Marcar que el agente está activo
    session.isAgentActive = true;

    // Si hay una conexión activa con ElevenLabs, enviar comando para interrumpir cualquier salida
    if (session.elevenLabsWs && session.elevenLabsWs.readyState === WebSocket.OPEN) {
      session.elevenLabsWs.send(JSON.stringify({ 
        type: "interruption" 
      }));
      console.log("[AgentVoice] Comando de interrupción enviado a ElevenLabs", { sessionId });

      // Notificar a los clientes de log y frontend
      broadcastToSession(sessionId, "[INFO] Agente interrumpió al bot");
      broadcastToSession(sessionId, {
        type: "interruption",
        message: "Bot interrumpido por el agente"
      });

      // Si hay una conexión con Twilio, enviar comando clear
      if (session.twilioWs && session.twilioWs.readyState === WebSocket.OPEN && session.twilioWs.streamSid) {
        session.twilioWs.send(JSON.stringify({
          event: "clear",
          streamSid: session.twilioWs.streamSid
        }));
        console.log("[AgentVoice] Comando clear enviado a Twilio", { sessionId });
      }
    }
  } catch (error) {
    console.error("[AgentVoice] Error procesando interrupción del agente:", error, { sessionId });
  }
}