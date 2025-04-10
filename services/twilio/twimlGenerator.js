// src/services/twilio/twimlGenerator.js
import { APP_PUBLIC_URL } from '../config/appConfig.js';

/**
 * Genera el TwiML para una llamada con streaming de media
 * @param {object} params - Parámetros para la generación del TwiML
 * @param {string} params.user_name - Nombre del usuario
 * @param {string} params.voice_id - ID de la voz
 * @param {string} params.voice_name - Nombre de la voz
 * @param {string} params.sessionId - ID de la sesión (opcional)
 * @returns {string} TwiML generado como string
 */
export const generateStreamTwiML = (params) => {
  const { user_name, voice_id, voice_name, sessionId } = params;

  const publicUrl = APP_PUBLIC_URL;
  const wsProtocol = publicUrl.startsWith("https://") ? "wss://" : "ws://";
  const wsHost = publicUrl.replace(/^https?:\/\//, "");

  // Asegurarse de tener un sessionId para el aislamiento de sesiones
  const finalSessionId = sessionId || `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;

  // Añadir el sessionId directamente como parámetro en la URL del stream
  const wsUrl = `${wsProtocol}${wsHost}/outbound-media-stream?sessionId=${encodeURIComponent(finalSessionId)}`;

  console.log(`[TwiML] Generando TwiML con WebSocket URL: ${wsUrl} y voice_name: ${voice_name}`, 
              { sessionId: finalSessionId });

  // Asegurarse de incluir el sessionId también como parámetro en el Stream
  // Esto proporciona redundancia en caso de que el parámetro de URL no se procese correctamente
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${wsUrl}">
      <Parameter name="user_name" value="${user_name}" />
      <Parameter name="voice_id" value="${voice_id}" />
      <Parameter name="voice_name" value="${voice_name}" />
      <Parameter name="sessionId" value="${finalSessionId}" />
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