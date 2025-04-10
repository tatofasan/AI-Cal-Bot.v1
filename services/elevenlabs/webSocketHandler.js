// src/services/elevenlabs/webSocketHandler.js
import WebSocket from "ws";
import { orchestrator } from "../orchestrator/index.js";
import { broadcastToSession } from "../../utils/sessionManager.js";

/**
 * Maneja los eventos de mensajes recibidos desde el WebSocket de ElevenLabs
 * @param {WebSocket} elevenLabsWs - WebSocket de conexión con ElevenLabs
 * @param {WebSocket} twilioWs - WebSocket de conexión con Twilio
 * @param {Object} state - Estado de la conexión (streamSid, callSid)
 * @param {Object} message - Mensaje recibido desde ElevenLabs
 */
export const handleElevenLabsMessage = async (elevenLabsWs, twilioWs, state, message) => {
  try {
    // Delegar el manejo del mensaje al orquestador
    orchestrator.handleElevenLabsMessage(message, state);
  } catch (error) {
    console.error("[ElevenLabs] Error procesando mensaje:", error, 
      { sessionId: state.sessionId });
  }
};

/**
 * Envía la configuración inicial al WebSocket de ElevenLabs
 * @param {WebSocket} elevenLabsWs - WebSocket de conexión con ElevenLabs
 * @param {Object} customParameters - Parámetros personalizados de la llamada
 */
export const sendInitialConfig = (elevenLabsWs, customParameters) => {
  try {
    // Usar el adaptador de ElevenLabs del orquestador para enviar la configuración
    orchestrator.elevenLabsAdapter.sendInitialConfig(
      elevenLabsWs, 
      customParameters, 
      elevenLabsWs.sessionId
    );
  } catch (error) {
    console.error("[ElevenLabs] Error enviando configuración inicial:", error, 
      { sessionId: elevenLabsWs.sessionId });
  }
};