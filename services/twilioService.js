// src/services/twilioService.js
import { twilioClient } from "./twilio/twilioConfig.js";
import { initiateCall } from "./twilio/callManager.js";
import { generateStreamTwiML, generateFallbackTwiML } from "./twilio/twimlGenerator.js";

// Exportar la función principal para iniciar llamadas 
// (manteniendo la compatibilidad con el código existente)
export const twilioCall = initiateCall;

// Exportar el cliente de Twilio para uso en otras partes de la aplicación
export { twilioClient };

// Exportar las utilidades de TwiML para uso en rutas
export const twiml = {
  generateStreamTwiML,
  generateFallbackTwiML
};