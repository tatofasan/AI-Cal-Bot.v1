// src/services/twilio/callManager.js
import { 
  twilioClient, 
  TWILIO_PHONE_NUMBER,
  TWILIO_BYOC_TRUNK_SID,
  DEFAULT_TO_PHONE_NUMBER 
} from "./twilioConfig.js";
import { APP_PUBLIC_URL } from '../config/appConfig.js';

/**
 * Inicia una llamada saliente a través de Twilio
 * @param {object} callParams - Parámetros de la llamada
 * @param {string} callParams.user_name - Nombre del usuario
 * @param {string} callParams.to_number - Número de teléfono destino
 * @param {string} callParams.voice_id - ID de la voz a usar
 * @param {string} callParams.voice_name - Nombre de la voz
 * @param {string} callParams.sessionId - ID de la sesión (opcional)
 * @returns {object} Resultado de la llamada
 */
export const initiateCall = async ({ user_name, to_number, voice_id, voice_name, sessionId }) => {
  // Crear un objeto de contexto para los logs si hay sessionId
  const sessionContext = sessionId ? { sessionId } : {};

  console.log("[Twilio] Iniciando llamada con parámetros:", {
    userName: user_name,
    toNumber: to_number || DEFAULT_TO_PHONE_NUMBER,
    voiceId: voice_id,
    voiceName: voice_name,
    ...sessionContext
  });

  const destinationNumber = to_number || DEFAULT_TO_PHONE_NUMBER;

  // Usar la URL pública para asegurar que Twilio se conecte correctamente
  const publicUrl = APP_PUBLIC_URL;

  // Construir la URL para TwiML con parámetros codificados, incluido sessionId si existe
  let queryParams =
    `user_name=${encodeURIComponent(user_name || "")}` +
    (voice_id ? `&voice_id=${encodeURIComponent(voice_id)}` : "") +
    (voice_name ? `&voice_name=${encodeURIComponent(voice_name)}` : "");

  // Añadir sessionId al querystring si existe
  if (sessionId) {
    queryParams += `&sessionId=${encodeURIComponent(sessionId)}`;
  }

  const twimlUrl = `${publicUrl}/outbound-call-twiml?${queryParams}`;

  console.log("[Twilio] URL TwiML:", twimlUrl, sessionContext);

  try {
    console.log("[Twilio] Enviando petición a API de Twilio...", sessionContext);

    const callOptions = {
      from: TWILIO_PHONE_NUMBER,
      to: destinationNumber,
      url: twimlUrl,
      byoc: TWILIO_BYOC_TRUNK_SID,
      machineDetection: true,
    };

    console.log("[Twilio] Opciones de llamada:", callOptions, sessionContext);

    const call = await twilioClient.calls.create(callOptions);

    console.log("[Twilio] Llamada iniciada con éxito:", call.sid, sessionContext);
    return {
      success: true,
      message: "Call initiated",
      callSid: call.sid,
      destinationNumber,
      sessionId: sessionId // Devolver el sessionId usado
    };
  } catch (error) {
    console.error("[Twilio] Error al iniciar llamada:", error, sessionContext);
    console.error("[Twilio] Detalles adicionales:", {
      code: error.code,
      status: error.status,
      moreInfo: error.moreInfo,
      ...sessionContext
    });
    throw error;
  }
};

/**
 * Finaliza una llamada activa
 * @param {string} callSid - SID de la llamada a finalizar
 * @param {string} sessionId - ID de la sesión (opcional)
 * @returns {object} Resultado de la operación
 */
export const endCall = async (callSid, sessionId) => {
  // Crear un objeto de contexto para los logs si hay sessionId
  const sessionContext = sessionId ? { sessionId } : {};

  try {
    const call = await twilioClient.calls(callSid).update({ status: "completed" });
    console.log(`[Twilio] Llamada ${callSid} finalizada exitosamente.`, sessionContext);
    return {
      success: true,
      message: `Call ${callSid} ended`,
      call
    };
  } catch (error) {
    console.error(`[Twilio] Error cortando la llamada ${callSid}:`, error, sessionContext);
    throw error;
  }
};

/**
 * Verifica el estado actual de una llamada
 * @param {string} callSid - SID de la llamada a verificar
 * @param {string} sessionId - ID de la sesión (opcional)
 * @returns {object} Información del estado de la llamada
 */
export const checkCallStatus = async (callSid, sessionId) => {
  // Crear un objeto de contexto para los logs si hay sessionId
  const sessionContext = sessionId ? { sessionId } : {};

  try {
    const call = await twilioClient.calls(callSid).fetch();
    console.log(`[Twilio] Estado de la llamada ${callSid}: ${call.status}`, sessionContext);
    return call;
  } catch (error) {
    console.error(`[Twilio] Error verificando estado de llamada ${callSid}:`, error, sessionContext);
    throw error;
  }
};