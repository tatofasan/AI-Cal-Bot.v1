// src/routes/outbound/callController.js
import { twilioCall, twilioClient, twiml } from "../../services/twilioService.js";
import { registerCall, updateCall } from "../../services/callStorageService.js";

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

  // Obtener la IP del cliente
  const clientIp = request.headers['x-forwarded-for'] || request.ip || 'desconocida';

  console.log("[DEBUG] Iniciando llamada con parámetros:", {
    user_name,
    to_number: to_number || "+541161728140",
    voice_id,
    voice_name,
    clientIp,
    ...sessionContext
  });

  try {
    // Pasar el sessionId a la función de llamada
    const callParams = { 
      user_name, 
      to_number, 
      voice_id, 
      voice_name 
    };

    // Si tenemos un sessionId, lo incluimos para el query string de TwiML
    if (sessionId) {
      callParams.sessionId = sessionId;
    }

    const callResult = await twilioCall(callParams);

    // Registrar/actualizar la llamada en el sistema de almacenamiento
    if (callResult.success && callResult.callSid) {
      // Convertir datos de camelCase a snake_case y viceversa según sea necesario
      registerCall({
        sessionId: callResult.sessionId || sessionId,
        callSid: callResult.callSid,
        userName: user_name,
        phoneNumber: to_number,
        voiceId: voice_id,
        voiceName: voice_name,
        clientIp: clientIp // Guardar la IP del cliente en los datos de la llamada
      });
    }

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

    // Si tenemos un sessionId, actualizamos la llamada en el sistema de almacenamiento
    if (sessionId) {
      updateCall(sessionId, {
        twimlGenerated: true,
        lastTwimlTimestamp: Date.now()
      });
    }

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
    const call = await twilioClient.calls(callSid).update({ status: "completed" });
    console.log(`[Twilio] Llamada ${callSid} finalizada exitosamente.`, sessionContext);

    // Registrar el fin de la llamada en el servicio de almacenamiento
    if (sessionId) {
      try {
        // Importación dinámica para evitar problemas de dependencia circular
        const { endCall: storageEndCall } = await import("../../services/callStorageService.js");

        // Registrar en el almacenamiento
        storageEndCall(sessionId, { 
          callSid,
          endReason: "manual_termination"
        });

        // Notificar a los clientes conectados sobre el cambio de estado
        try {
          // Importar utilidades para broadcast
          const { broadcastToSession } = await import("../../utils/sessionManager.js");

          // Enviar notificación del cambio de estado
          broadcastToSession(sessionId, JSON.stringify({
            type: 'call_update',
            callId: sessionId,
            status: 'ended',
            message: 'Llamada finalizada manualmente'
          }));
        } catch (broadcastError) {
          console.error(`[Twilio] Error enviando broadcast de fin de llamada:`, broadcastError, sessionContext);
          // No bloquear la respuesta por un error en el broadcast
        }
      } catch (storageError) {
        console.error(`[Twilio] Error registrando fin de llamada en almacenamiento:`, storageError, sessionContext);
        // No bloquear la respuesta por un error en el almacenamiento
      }
    }

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