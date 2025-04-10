// src/services/elevenlabs/mediaStreamService.js
import WebSocket from "ws";
import { setupElevenLabsConnection, closeElevenLabsConnection } from "./connectionManager.js";
import { handleTwilioMessage } from "./twilioHandler.js";

/**
 * Configura el stream de medios para la comunicación entre Twilio y ElevenLabs
 * @param {WebSocket} ws - WebSocket de conexión con Twilio
 */
export const setupMediaStream = async (ws) => {
  console.info(
    "[Server] WebSocket connection established for outbound media stream"
  );

  // Variables para mantener el estado
  const state = {
    streamSid: null,
    callSid: null,
    customParameters: {},
  };

  let elevenLabsWs = null;

  // Manejador de errores
  ws.on("error", (error) => {
    console.error("[WebSocket Error]", error);
  });

  // Procesar mensajes de Twilio
  ws.on("message", (message) => {
    try {
      const msg = JSON.parse(message);

      // Usar la función de manejo de mensajes de Twilio
      handleTwilioMessage(
        msg, 
        ws, 
        elevenLabsWs, 
        state, 
        // Callback para iniciar ElevenLabs después de recibir parámetros
        async () => {
          // Iniciar ElevenLabs solo después de recibir los parámetros
          elevenLabsWs = await setupElevenLabsConnection(state, ws);
        }
      );
    } catch (error) {
      console.error("[Twilio] Error procesando mensaje de Twilio:", error);
    }
  });

  // Manejar cierre de conexión
  ws.on("close", () => {
    console.log("[Twilio] Cliente desconectado");
    closeElevenLabsConnection(elevenLabsWs);
  });
};