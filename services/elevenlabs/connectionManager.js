// src/services/elevenlabs/connectionManager.js
import { orchestrator } from "../orchestrator/index.js";
import { registerElevenLabsConnection, removeElevenLabsConnection } from "../../utils/sessionManager.js";

/**
 * Inicializa y configura la conexión WebSocket con ElevenLabs
 * Ahora utiliza el orquestador como intermediario
 * @param {Object} state - Estado de la conexión (streamSid, callSid, customParameters)
 * @param {WebSocket} twilioWs - WebSocket de conexión con Twilio
 * @returns {Promise<WebSocket>} WebSocket configurado para ElevenLabs
 */
export const setupElevenLabsConnection = async (state, twilioWs) => {
  try {
    console.log("[ElevenLabs] Iniciando conexión a ElevenLabs", 
      { sessionId: state.sessionId });

    // Inicializar ElevenLabs a través del orquestador
    const result = await orchestrator.elevenLabsProvider.initialize(
      state.customParameters, 
      state.sessionId
    );

    // Recuperar el WebSocket desde las conexiones gestionadas por el orquestador
    const elevenLabsWs = orchestrator.streamManager.connections.elevenlabs.get(state.sessionId);

    if (!elevenLabsWs) {
      throw new Error("No se pudo establecer la conexión con ElevenLabs");
    }

    // Registrar la conexión en el gestor de sesiones si está disponible
    if (state.callSid) {
      registerElevenLabsConnection(state.sessionId, elevenLabsWs, state.callSid);
    }

    return elevenLabsWs;
  } catch (error) {
    console.error("[ElevenLabs] Error configurando ElevenLabs:", error, 
      { sessionId: state.sessionId });
    throw error;
  }
};

/**
 * Cierra la conexión con ElevenLabs si está abierta
 * @param {WebSocket} elevenLabsWs - WebSocket de conexión con ElevenLabs
 */
export const closeElevenLabsConnection = (elevenLabsWs) => {
  if (elevenLabsWs) {
    const sessionId = elevenLabsWs.sessionId;
    console.log("[ElevenLabs] Cerrando conexión", { sessionId });

    // Utilizar el orquestador para terminar la conexión
    if (sessionId) {
      orchestrator.elevenLabsProvider.terminate(sessionId);
    } else {
      // Fallback para cerrar directamente si no hay sessionId
      elevenLabsWs.close();
    }

    // Eliminar del gestor de sesiones
    removeElevenLabsConnection(elevenLabsWs);
  }
};