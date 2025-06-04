// services/elevenLabsService.js
import { ElevenLabsClient } from "elevenlabs";
import unifiedSessionService from "./unifiedSessionService.js";

// Configuración
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_AGENT_ID = process.env.ELEVENLABS_AGENT_ID;

// Cliente de ElevenLabs
const client = new ElevenLabsClient({
  apiKey: ELEVENLABS_API_KEY
});

/**
 * NOTA: Este archivo ha sido simplificado para la migración a Phone API.
 * La mayoría de la funcionalidad de WebSocket y conversación se ha movido
 * o eliminado ya que ahora ElevenLabs maneja todo internamente.
 * 
 * Este servicio ahora solo mantiene funciones auxiliares para:
 * - Gestión de agentes
 * - Configuración de voces
 * - Utilidades generales
 */

/**
 * Obtener información del agente
 */
export async function getAgentInfo() {
  try {
    console.log("[ElevenLabs] Obteniendo información del agente:", ELEVENLABS_AGENT_ID);

    const agent = await client.conversationalAi.getAgent(ELEVENLABS_AGENT_ID);

    return {
      agentId: agent.agent_id,
      name: agent.name,
      language: agent.language,
      voiceId: agent.voice_id
    };
  } catch (error) {
    console.error("[ElevenLabs] Error obteniendo información del agente:", error);
    throw error;
  }
}

/**
 * Obtener lista de voces disponibles
 */
export async function getAvailableVoices() {
  try {
    console.log("[ElevenLabs] Obteniendo voces disponibles");

    const voices = await client.voices.getAll();

    return voices.voices.map(voice => ({
      voiceId: voice.voice_id,
      name: voice.name,
      category: voice.category,
      labels: voice.labels
    }));
  } catch (error) {
    console.error("[ElevenLabs] Error obteniendo voces:", error);
    throw error;
  }
}

/**
 * Actualizar configuración del agente
 * @param {Object} config - Nueva configuración
 */
export async function updateAgentConfig(config) {
  try {
    console.log("[ElevenLabs] Actualizando configuración del agente");

    // La Phone API permite actualizar ciertas configuraciones del agente
    // Esto se puede hacer a través de la API de agentes

    // TODO: Implementar según necesidades específicas

    return { success: true };
  } catch (error) {
    console.error("[ElevenLabs] Error actualizando configuración:", error);
    throw error;
  }
}

/**
 * Obtener el historial de conversaciones (si está disponible)
 * @param {string} phoneCallId - ID de la llamada telefónica
 */
export async function getConversationHistory(phoneCallId) {
  try {
    console.log("[ElevenLabs] Obteniendo historial de conversación:", phoneCallId);

    // La Phone API puede proporcionar historial de conversaciones
    // TODO: Implementar según la documentación de ElevenLabs

    return {
      phoneCallId,
      transcripts: [],
      duration: 0
    };
  } catch (error) {
    console.error("[ElevenLabs] Error obteniendo historial:", error);
    throw error;
  }
}

/**
 * Función de utilidad para verificar el estado de la API
 */
export async function checkAPIStatus() {
  try {
    // Verificar que podemos acceder al agente
    await getAgentInfo();

    return {
      status: 'operational',
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

// Exportar cliente para uso directo si es necesario
export { client };

// Funciones legacy que ahora no hacen nada (para compatibilidad)
export async function setupMediaStream() {
  console.warn("[ElevenLabs] setupMediaStream está deprecado con Phone API");
  return null;
}

export function getActiveConversation() {
  console.warn("[ElevenLabs] getActiveConversation está deprecado con Phone API");
  return null;
}

export async function interruptConversation() {
  console.warn("[ElevenLabs] interruptConversation está deprecado con Phone API");
  return false;
}

export async function setConversationMode() {
  console.warn("[ElevenLabs] setConversationMode está deprecado con Phone API");
  return false;
}

export async function sendAgentAudio() {
  console.warn("[ElevenLabs] sendAgentAudio está deprecado con Phone API");
  return false;
}

export async function closeAllConversations() {
  console.warn("[ElevenLabs] closeAllConversations está deprecado con Phone API");
  // No hay conversaciones WebSocket que cerrar con Phone API
}