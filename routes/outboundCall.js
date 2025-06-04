// routes/outboundCall.js (NUEVO - Reemplaza el anterior)
import { handleIndexRoute, handleJsFileRoute } from "./outbound/routeHandler.js";
import { requireAuth } from "../middleware/auth-middleware.js";
import elevenPhoneService from '../services/elevenPhoneService.js';
import unifiedSessionService from '../services/unifiedSessionService.js';
import { registerCall } from '../services/callStorageService.js';

export default async function outboundCallRoutes(fastify, options) {
  // Ruta que sirve el front end - requiere autenticación
  fastify.get("/", {
    preHandler: requireAuth
  }, handleIndexRoute);

  // Rutas para servir los archivos JS estáticos
  fastify.get("/js/audioProcessor.js", (request, reply) => {
    return handleJsFileRoute(request, reply, "audioProcessor.js");
  });

  fastify.get("/js/uiController.js", (request, reply) => {
    return handleJsFileRoute(request, reply, "uiController.js");
  });

  fastify.get("/js/apiService.js", (request, reply) => {
    return handleJsFileRoute(request, reply, "apiService.js");
  });

  fastify.get("/js/webSocketHandler.js", (request, reply) => {
    return handleJsFileRoute(request, reply, "webSocketHandler.js");
  });

  fastify.get("/js/main.js", (request, reply) => {
    return handleJsFileRoute(request, reply, "main.js");
  });

  fastify.get("/js/agentVoiceCapture.js", (request, reply) => {
    return handleJsFileRoute(request, reply, "agentVoiceCapture.js");
  });

  /**
   * POST /outbound-call
   * Iniciar llamada - AHORA USA ELEVENLABS PHONE API
   */
  fastify.post("/outbound-call", {
    preHandler: requireAuth
  }, async (request, reply) => {
    try {
      const { 
        user_name = "el titular de la línea", 
        to_number, 
        voice_id, 
        voice_name,
        sessionId: providedSessionId 
      } = request.body;

      // Obtener IP del cliente
      const clientIp = request.headers['x-forwarded-for'] || request.ip || 'desconocida';

      console.log("[OutboundCall] Iniciando llamada con Phone API:", {
        user_name,
        to_number,
        voice_id,
        voice_name,
        clientIp
      });

      // Crear o usar sesión existente
      let sessionId = providedSessionId;
      if (!sessionId) {
        const session = unifiedSessionService.createSession();
        sessionId = session.id;
      }

      // Registrar la llamada
      registerCall({
        sessionId,
        userName: user_name,
        phoneNumber: to_number,
        voiceId: voice_id,
        voiceName: voice_name,
        clientIp,
        isPhoneAPI: true
      });

      // Actualizar información de la sesión
      unifiedSessionService.updateCallInfo(sessionId, {
        phoneNumber: to_number,
        userName: user_name,
        voiceId: voice_id,
        voiceName: voice_name,
        status: 'initiating',
        isRealCall: true,
        isPhoneAPI: true
      });

      // Iniciar llamada con ElevenLabs Phone API
      const result = await elevenPhoneService.initiatePhoneCall({
        sessionId,
        phoneNumber: to_number,
        userName: user_name,
        voiceId: voice_id,
        voiceName: voice_name
      });

      return reply.send({
        success: true,
        callSid: result.phoneCallId, // Mantener nombre para compatibilidad
        phoneCallId: result.phoneCallId,
        sessionId: sessionId,
        message: "Llamada iniciada correctamente"
      });

    } catch (error) {
      console.error("[OutboundCall] Error:", error);
      return reply.code(500).send({
        success: false,
        error: `Fallo al iniciar la llamada: ${error.message}`,
        errorDetails: error.stack || "No stack trace available"
      });
    }
  });

  /**
   * POST /end-call
   * Finalizar llamada - AHORA USA ELEVENLABS PHONE API
   */
  fastify.post("/end-call", {
    preHandler: requireAuth
  }, async (request, reply) => {
    try {
      const { callSid, sessionId } = request.body;

      if (!sessionId) {
        console.error("[ERROR] No sessionId provided in end-call request");
        return reply.code(400).send({
          success: false,
          error: "No sessionId provided"
        });
      }

      console.log(`[OutboundCall] Finalizando llamada para sesión: ${sessionId}`);

      // Finalizar llamada con ElevenLabs Phone API
      const result = await elevenPhoneService.endPhoneCall(sessionId);

      return reply.send({
        success: true,
        message: `Llamada finalizada para sesión ${sessionId}`
      });

    } catch (error) {
      console.error(`[OutboundCall] Error finalizando llamada:`, error);
      return reply.code(500).send({
        success: false,
        error: `Error ending call: ${error.message}`
      });
    }
  });

  /**
   * ELIMINADOS:
   * - /outbound-call-twiml (ya no necesario)
   * - Toda la lógica de TwiML
   */
}