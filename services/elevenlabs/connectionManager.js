// src/services/elevenlabs/connectionManager.js
import WebSocket from "ws";
import { getSignedUrl } from "./elevenLabsApi.js";
import { selectVoice } from "./voiceManager.js";
import { handleElevenLabsMessage, sendInitialConfig } from "./webSocketHandler.js";
import { handleTwilioMessage, endTwilioCall } from "./twilioHandler.js";
import { registerElevenLabsConnection, removeElevenLabsConnection } from "../../utils/sessionManager.js";

/**
 * Inicializa y configura la conexión WebSocket con ElevenLabs
 * @param {Object} state - Estado de la conexión (streamSid, callSid, customParameters)
 * @param {WebSocket} twilioWs - WebSocket de conexión con Twilio
 * @returns {Promise<WebSocket>} WebSocket configurado para ElevenLabs
 */
export const setupElevenLabsConnection = async (state, twilioWs) => {
  try {
    console.log("[ElevenLabs] Iniciando conexión a ElevenLabs", 
      { sessionId: state.sessionId });
    const signedUrl = await getSignedUrl();

    const elevenLabsWs = new WebSocket(signedUrl);

    // Almacenar sessionId en el WebSocket para poder accederlo en eventos
    elevenLabsWs.sessionId = state.sessionId;

    // Manejar apertura de conexión
    elevenLabsWs.on("open", () => {
      console.log("[ElevenLabs] WebSocket conectado a ElevenLabs", 
        { sessionId: state.sessionId });

      if (state.customParameters?.voice_id === "random") {
        const selectedVoice = selectVoice("random");
        state.customParameters.voice_id = selectedVoice.id;
        state.customParameters.voice_name = selectedVoice.name;
      }

      // Registrar la conexión en el gestor de sesiones cuando esté abierta
      if (state.callSid) {
        registerElevenLabsConnection(state.sessionId, elevenLabsWs, state.callSid);
      }

      // Enviar configuración inicial a ElevenLabs
      sendInitialConfig(elevenLabsWs, state.customParameters);
    });

    // Manejar mensajes recibidos
    elevenLabsWs.on("message", (data) => {
      const message = JSON.parse(data);
      handleElevenLabsMessage(elevenLabsWs, twilioWs, state, message);
    });

    // Manejar errores
    elevenLabsWs.on("error", (error) => {
      console.error("[ElevenLabs] Error en WebSocket:", error, 
        { sessionId: state.sessionId });
    });

    // Manejar cierre de conexión
    elevenLabsWs.on("close", async (code, reason) => {
      console.log(
        `[ElevenLabs] WebSocket cerrado. Código: ${code}, Razón: ${reason || "No especificada"}`,
        { sessionId: state.sessionId }
      );

      // Eliminar la conexión del gestor de sesiones
      removeElevenLabsConnection(elevenLabsWs);

      await endTwilioCall(state.callSid);
    });

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
  if (elevenLabsWs?.readyState === WebSocket.OPEN) {
    const sessionId = elevenLabsWs.sessionId;
    console.log("[ElevenLabs] Cerrando conexión", { sessionId });
    elevenLabsWs.close();
  }
};