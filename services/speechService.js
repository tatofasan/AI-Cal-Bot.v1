// src/services/speechService.js
import { 
  getActiveConversation, 
  interruptConversation, 
  setConversationMode,
  sendAgentAudio 
} from "./elevenLabsService.js";
import { broadcastToSession } from "../utils/sessionManager.js";
import { getSession, addTranscription } from "./sessionService.js";
import { bufferToFloat32Array } from "../utils/audioProcessor.js";

/**
 * Procesa el audio enviado por el agente usando el SDK
 * @param {string} sessionId - ID de la sesión
 * @param {object} data - Datos del audio (formato, payload, etc.)
 */
export async function processAgentAudio(sessionId, data) {
  // Obtener la sesión actual
  const session = getSession(sessionId);
  if (!session) {
    console.error("[SpeechService] No se encontró la sesión para el audio del agente", { sessionId });
    return;
  }

  // Verificar si hay una conversación activa
  const conversation = getActiveConversation(sessionId);
  if (!conversation) {
    console.error("[SpeechService] No hay conversación activa con ElevenLabs", { sessionId });
    return;
  }

  try {
    // Marcar sesión como con agente activo
    session.isAgentActive = true;

    // Interrumpir al bot si está hablando
    await interruptConversation(sessionId);

    // Cambiar a modo agente si no está ya
    await setConversationMode(sessionId, 'agent');

    // Convertir el audio según el formato
    let audioBuffer;

    if (data.format === 'base64') {
      // Decodificar de base64
      const binaryString = atob(data.payload || data.audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      audioBuffer = bytes.buffer;
    } else if (data.format === 'pcm16') {
      // PCM16 en base64
      const binaryString = atob(data.audio);
      audioBuffer = new ArrayBuffer(binaryString.length);
      const view = new Uint8Array(audioBuffer);
      for (let i = 0; i < binaryString.length; i++) {
        view[i] = binaryString.charCodeAt(i);
      }
    } else {
      // Asumir que es un buffer directo
      audioBuffer = data.payload;
    }

    // Enviar audio a ElevenLabs
    const success = await sendAgentAudio(sessionId, audioBuffer);

    if (success) {
      // Notificar a los clientes
      broadcastToSession(sessionId, JSON.stringify({
        type: "agent_audio_sent",
        sessionId: sessionId,
        timestamp: Date.now()
      }));
    } else {
      console.error("[SpeechService] Error al enviar audio del agente a ElevenLabs", { sessionId });
    }

  } catch (error) {
    console.error("[SpeechService] Error procesando audio del agente:", error, { sessionId });
  }
}

/**
 * Procesa una transcripción/mensaje del agente
 * @param {string} sessionId - ID de la sesión
 * @param {string} message - Mensaje del agente
 */
export async function processAgentTranscript(sessionId, message) {
  // Obtener la sesión actual
  const session = getSession(sessionId);
  if (!session) {
    console.error("[SpeechService] No se encontró la sesión para el mensaje", { sessionId });
    return;
  }

  try {
    // Registrar la transcripción
    console.log(`[SpeechService] Mensaje del agente: ${message}`, { sessionId });
    addTranscription(sessionId, message, 'agent');

    // Enviar a los clientes para mostrar en la interfaz
    broadcastToSession(sessionId, JSON.stringify({
      type: "agent_message",
      text: message,
      timestamp: Date.now()
    }));

    // Si hay una conversación activa, podríamos enviar el texto para síntesis
    const conversation = getActiveConversation(sessionId);
    if (conversation) {
      // El SDK puede sintetizar texto del agente si está configurado
      await conversation.sendText(message);
    }

  } catch (error) {
    console.error("[SpeechService] Error procesando mensaje del agente:", error, { sessionId });
  }
}

/**
 * Procesa comandos de interrupción del agente
 * @param {string} sessionId - ID de la sesión
 */
export async function processAgentInterrupt(sessionId) {
  const session = getSession(sessionId);
  if (!session) {
    console.error("[SpeechService] No se encontró la sesión para la interrupción", { sessionId });
    return;
  }

  try {
    // Marcar que el agente está activo
    session.isAgentActive = true;

    // Interrumpir la conversación actual
    const interrupted = await interruptConversation(sessionId);

    if (interrupted) {
      console.log("[SpeechService] Bot interrumpido por el agente", { sessionId });

      // Notificar a los clientes
      broadcastToSession(sessionId, JSON.stringify({
        type: "interruption",
        message: "Bot interrumpido por el agente",
        timestamp: Date.now()
      }));

      // Cambiar a modo agente
      await setConversationMode(sessionId, 'agent');
    }

  } catch (error) {
    console.error("[SpeechService] Error procesando interrupción del agente:", error, { sessionId });
  }
}

/**
 * Activa el modo agente para una sesión
 * @param {string} sessionId - ID de la sesión
 * @returns {boolean} - true si se activó correctamente
 */
export async function activateAgentMode(sessionId) {
  try {
    const session = getSession(sessionId);
    if (!session) {
      throw new Error('Sesión no encontrada');
    }

    // Cambiar a modo agente en ElevenLabs
    const success = await setConversationMode(sessionId, 'agent');

    if (success) {
      session.isAgentActive = true;

      // Interrumpir cualquier audio en curso
      await interruptConversation(sessionId);

      // Notificar
      broadcastToSession(sessionId, JSON.stringify({
        type: "agent_mode_activated",
        timestamp: Date.now()
      }));

      console.log("[SpeechService] Modo agente activado", { sessionId });
      return true;
    }

    return false;
  } catch (error) {
    console.error("[SpeechService] Error activando modo agente:", error, { sessionId });
    return false;
  }
}

/**
 * Desactiva el modo agente y vuelve al bot
 * @param {string} sessionId - ID de la sesión
 * @returns {boolean} - true si se desactivó correctamente
 */
export async function deactivateAgentMode(sessionId) {
  try {
    const session = getSession(sessionId);
    if (!session) {
      throw new Error('Sesión no encontrada');
    }

    // Cambiar a modo bot en ElevenLabs
    const success = await setConversationMode(sessionId, 'bot');

    if (success) {
      session.isAgentActive = false;

      // Notificar
      broadcastToSession(sessionId, JSON.stringify({
        type: "agent_mode_deactivated", 
        timestamp: Date.now()
      }));

      console.log("[SpeechService] Modo agente desactivado", { sessionId });
      return true;
    }

    return false;
  } catch (error) {
    console.error("[SpeechService] Error desactivando modo agente:", error, { sessionId });
    return false;
  }
}

/**
 * Procesa el audio recibido para métricas y análisis
 * @param {string} sessionId - ID de la sesión
 * @param {ArrayBuffer} audioData - Datos de audio
 * @param {string} speaker - 'agent' o 'user'
 */
export async function processAudioMetrics(sessionId, audioData, speaker) {
  try {
    // Convertir a Float32Array para análisis
    const samples = bufferToFloat32Array(audioData, 2);

    // Calcular métricas básicas
    let maxAmplitude = 0;
    let avgAmplitude = 0;

    for (let i = 0; i < samples.length; i++) {
      const amplitude = Math.abs(samples[i]);
      maxAmplitude = Math.max(maxAmplitude, amplitude);
      avgAmplitude += amplitude;
    }

    avgAmplitude /= samples.length;

    // Enviar métricas
    broadcastToSession(sessionId, JSON.stringify({
      type: "audio_metrics",
      speaker: speaker,
      metrics: {
        maxAmplitude: maxAmplitude,
        avgAmplitude: avgAmplitude,
        duration: (samples.length / 16000) * 1000, // Asumiendo 16kHz
        timestamp: Date.now()
      }
    }));

  } catch (error) {
    console.error("[SpeechService] Error calculando métricas de audio:", error, { sessionId });
  }
}