// src/routes/outbound/callController.js
import { twilioCall, twilioClient } from "../../services/twilioService.js";
import { REPLIT_URL } from '../../services/urlService.js';

/**
 * Inicia una llamada saliente a través de Twilio
 * @param {object} request - Objeto de solicitud Fastify
 * @param {object} reply - Objeto de respuesta Fastify
 */
export const initiateCall = async (request, reply) => {
  if (!request.body) {
    console.error("[ERROR] No se recibió el cuerpo de la solicitud");
    return reply.code(400).send({
      success: false,
      error: "No request body provided",
    });
  }
  const { user_name = "el titular de la linea", to_number, voice_id, voice_name } = request.body;
  console.log("[DEBUG] Iniciando llamada con parámetros:", {
    user_name,
    to_number: to_number || "+541161728140",
    voice_id,
    voice_name
  });
  try {
    const callResult = await twilioCall({ user_name, to_number, voice_id, voice_name });
    return reply.send(callResult);
  } catch (error) {
    console.error("[Outbound Call] Error:", error);
    return reply.code(500).send({
      success: false,
      error: `Fallo al iniciar la llamada: ${error.message}`,
      errorDetails: error.stack ? error.stack : "No stack trace available",
    });
  }
};

/**
 * Genera el TwiML necesario para la llamada saliente
 * @param {object} request - Objeto de solicitud Fastify
 * @param {object} reply - Objeto de respuesta Fastify
 */
export const generateTwiML = async (request, reply) => {
  try {
    const user_name = request.query.user_name || "el titular de la linea";
    const voice_id = request.query.voice_id || "";
    const voice_name = request.query.voice_name || '';
    const publicUrl = REPLIT_URL;
    let wsProtocol = publicUrl.startsWith("https://") ? "wss://" : "ws://";
    let wsHost = publicUrl.replace(/^https?:\/\//, "");
    let wsUrl = `${wsProtocol}${wsHost}/outbound-media-stream`;
    console.log(`[TwiML] Generando TwiML con WebSocket URL: ${wsUrl} y voice_name: ${voice_name}`);
    const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${wsUrl}">
      <Parameter name="user_name" value="${user_name}" />
      <Parameter name="voice_id" value="${voice_id}" />
      <Parameter name="voice_name" value="${voice_name}" />
    </Stream>
  </Connect>
</Response>`;
    return reply.type("text/xml").send(twimlResponse);
  } catch (error) {
    console.error(`[TwiML] Error generando TwiML: ${error}`);
    const fallbackTwiML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Lo sentimos, ha ocurrido un error en la aplicación.</Say>
</Response>`;
    return reply.type("text/xml").send(fallbackTwiML);
  }
};

/**
 * Finaliza una llamada activa en Twilio
 * @param {object} request - Objeto de solicitud Fastify
 * @param {object} reply - Objeto de respuesta Fastify
 */
export const endCall = async (request, reply) => {
  if (!request.body || !request.body.callSid) {
    console.error("[ERROR] No callSid provided in end-call request");
    return reply.code(400).send({
      success: false,
      error: "No callSid provided",
    });
  }
  const { callSid } = request.body;
  try {
    const call = await twilioClient.calls(callSid).update({ status: "completed" });
    console.log(`[Twilio] Llamada ${callSid} finalizada exitosamente.`);
    return reply.send({
      success: true,
      message: `Call ${callSid} ended`,
    });
  } catch (error) {
    console.error(`[Twilio] Error cortando la llamada ${callSid}:`, error);
    return reply.code(500).send({
      success: false,
      error: `Error ending call: ${error.message}`,
    });
  }
};