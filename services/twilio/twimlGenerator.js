// src/services/twilio/twimlGenerator.js
import { APP_PUBLIC_URL } from '../config/appConfig.js';

/**
 * Genera el TwiML para una llamada con streaming de media
 * @param {object} params - Parámetros para la generación del TwiML
 * @param {string} params.user_name - Nombre del usuario
 * @param {string} params.voice_id - ID de la voz
 * @param {string} params.voice_name - Nombre de la voz
 * @returns {string} TwiML generado como string
 */
export const generateStreamTwiML = (params) => {
  const { user_name, voice_id, voice_name } = params;

  const publicUrl = APP_PUBLIC_URL;
  const wsProtocol = publicUrl.startsWith("https://") ? "wss://" : "ws://";
  const wsHost = publicUrl.replace(/^https?:\/\//, "");
  const wsUrl = `${wsProtocol}${wsHost}/outbound-media-stream`;

  console.log(`[TwiML] Generando TwiML con WebSocket URL: ${wsUrl} y voice_name: ${voice_name}`);

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${wsUrl}">
      <Parameter name="user_name" value="${user_name}" />
      <Parameter name="voice_id" value="${voice_id}" />
      <Parameter name="voice_name" value="${voice_name}" />
    </Stream>
  </Connect>
</Response>`;
};

/**
 * Genera un TwiML de respaldo para casos de error
 * @returns {string} TwiML de respaldo
 */
export const generateFallbackTwiML = () => {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Lo sentimos, ha ocurrido un error en la aplicación.</Say>
</Response>`;
};