// src/routes/outbound/callController.js
import { twilioCall, twilioClient, twiml } from "../../services/twilioService.js";
import { orchestrator } from "../../services/orchestrator/index.js";

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

  const { 
    user_name = "el titular de la linea", 
    to_number, 
    voice_id, 
    voice_name,
    sessionId 
  } = request.body;

  // Registrar el sessionId para asociar los logs con la sesión específica
  const sessionContext = sessionId ? { sessionId } : {};

  console.log("[DEBUG] Iniciando llamada con parámetros:", {
    user_name,
    to_number: to_number || "+541161728140",
    voice_id,
    voice_name,
    ...sessionContext
  });

  try {
    // Iniciar la llamada a través del orquestador
    const callParams = { 
      user_name, 
      to_number, 
      voice_id, 
      voice_name 
    };

    // Si tenemos un sessionId, lo incluimos
    if (sessionId) {
      callParams.sessionId = sessionId;
    }

    // Usar el TwilioProvider del orquestador para iniciar la llamada
    const callResult = await orchestrator.twilioProvider.initialize(callParams, sessionId || callParams.sessionId);

    return reply.send(callResult);
  } catch (error) {
    console.error("[Outbound Call] Error:", error, sessionContext);
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
    const sessionId = request.query.sessionId || '';

    // Registrar el sessionId para asociar los logs con la sesión específica
    const sessionContext = sessionId ? { sessionId } : {};

    console.log("[TwiML] Generando TwiML para usuario:", user_name, sessionContext);

    const twimlResponse = twiml.generateStreamTwiML({ 
      user_name, 
      voice_id, 
      voice_name,
      sessionId 
    });

    return reply.type("text/xml").send(twimlResponse);
  } catch (error) {
    console.error(`[TwiML] Error generando TwiML: ${error}`);
    const fallbackTwiML = twiml.generateFallbackTwiML();
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

  const { callSid, sessionId } = request.body;

  // Registrar el sessionId para asociar los logs con la sesión específica
  const sessionContext = sessionId ? { sessionId } : {};

  try {
    // Usar el TwilioProvider del orquestador para finalizar la llamada
    let result;

    if (sessionId) {
      // Si tenemos sessionId, usamos el método del orquestador
      result = await orchestrator.twilioProvider.terminate(sessionId);
    } else {
      // Si solo tenemos callSid, usamos el cliente de Twilio directamente
      await twilioClient.calls(callSid).update({ status: "completed" });
      result = true;
    }

    console.log(`[Twilio] Llamada ${callSid} finalizada exitosamente.`, sessionContext);

    return reply.send({
      success: true,
      message: `Call ${callSid} ended`,
    });
  } catch (error) {
    console.error(`[Twilio] Error cortando la llamada ${callSid}:`, error, sessionContext);
    return reply.code(500).send({
      success: false,
      error: `Error ending call: ${error.message}`,
    });
  }
};

/**
 * Cambia el proveedor de voz para una llamada activa
 * @param {object} request - Objeto de solicitud Fastify
 * @param {object} reply - Objeto de respuesta Fastify
 */
export const changeVoiceProvider = async (request, reply) => {
  if (!request.body || !request.body.sessionId) {
    return reply.code(400).send({
      success: false,
      error: "Se requiere sessionId",
    });
  }

  const { sessionId, provider, voiceId } = request.body;

  try {
    // Cambiar la ruta para mensajes de audio
    orchestrator.changeRoute('twilio', 'audio', provider);

    return reply.send({
      success: true,
      message: `Proveedor de voz cambiado a ${provider}`,
      sessionId,
      provider
    });
  } catch (error) {
    console.error(`[API] Error cambiando proveedor de voz:`, error, { sessionId });
    return reply.code(500).send({
      success: false,
      error: `Error: ${error.message}`,
    });
  }
};