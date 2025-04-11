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
    // Si es un fragmento de silencio, podemos ignorarlo para optimizar
    if (data.isSilence || data.is_silence) {
      return;
    }

    // Verificar si hay un streamSid disponible (necesario para enviar audio a Twilio)
    if (!session.twilioWs.streamSid) {
      console.error("[AgentVoice] No hay streamSid disponible para enviar audio", { sessionId });
      return;
    }

    // Si hay una conexión activa con ElevenLabs, enviar comando para interrumpir cualquier salida
    if (session.elevenLabsWs && session.elevenLabsWs.readyState === WebSocket.OPEN) {
      session.elevenLabsWs.send(JSON.stringify({ 
        type: "interruption" 
      }));
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

    // Información de debugguing
    console.log("[AgentVoice] Enviando audio a Twilio:", {
      streamSid: session.twilioWs.streamSid,
      payloadLength: data.payload.length,
      sessionId,
      format: data.format || "mulaw",
      sampleRate: data.sampleRate || 8000
    });

    // Enviar a Twilio como una cadena JSON formateada correctamente
    session.twilioWs.send(JSON.stringify(audioData));

    // Loguear el envío
    console.log("[AgentVoice] Audio del agente enviado directamente a Twilio", { sessionId });

    // También enviar el audio a los clientes de logs para monitoreo
    const audioId = Date.now() + Math.random().toString(36).substr(2, 9);
    broadcastToSession(sessionId, {
      type: "agent_audio",
      id: audioId,
      payload: data.payload
    });

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

  } catch (error) {
    console.error("[AgentVoice] Error procesando mensaje del agente:", error, { sessionId });
  }
}