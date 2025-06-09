// routes/phoneRoutes.js
import elevenPhoneSipService from '../services/elevenPhoneSipService.js';
import unifiedSessionService from '../services/unifiedSessionService.js';
import { registerCall, updateCall } from '../services/callStorageService.js';
import { requireAuth } from '../middleware/auth-middleware.js';

/**
 * Rutas para manejar llamadas telefónicas con ElevenLabs Phone API
 */
export default async function phoneRoutes(fastify, options) {

  /**
   * POST /api/phone/call
   * Iniciar una nueva llamada telefónica
   */
  fastify.post('/api/phone/call', {
    preHandler: requireAuth,
    schema: {
      body: {
        type: 'object',
        required: ['phoneNumber'],
        properties: {
          phoneNumber: { type: 'string' },
          userName: { type: 'string' },
          voiceId: { type: 'string' },
          voiceName: { type: 'string' },
          sessionId: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            phoneCallId: { type: 'string' },
            sessionId: { type: 'string' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { 
        phoneNumber, 
        userName = 'el titular de la línea',
        voiceId,
        voiceName,
        sessionId: providedSessionId
      } = request.body;

      // Obtener IP del cliente
      const clientIp = request.headers['x-forwarded-for'] || request.ip || 'desconocida';

      // Usar sessionId proporcionado o crear uno nuevo
      let sessionId = providedSessionId;
      if (!sessionId) {
        const session = unifiedSessionService.createSession();
        sessionId = session.id;
      }

      console.log('[PhoneRoute] Iniciando llamada:', {
        sessionId,
        phoneNumber,
        userName,
        voiceId,
        clientIp
      });

      // Registrar la llamada en el sistema
      registerCall({
        sessionId,
        userName,
        phoneNumber,
        voiceId,
        voiceName,
        clientIp,
        isPhoneAPI: true // Marcar que es a través de Phone API
      });

      // Actualizar información de la sesión
      unifiedSessionService.updateCallInfo(sessionId, {
        phoneNumber,
        userName,
        voiceId,
        voiceName,
        status: 'initiating',
        isRealCall: true
      });

      // Iniciar la llamada a través de ElevenLabs SIP trunk
      const result = await elevenPhoneSipService.initiatePhoneCall({
        sessionId,
        phoneNumber,
        userName,
        voiceId,
        voiceName
      });

      // Actualizar con el ID de la llamada de ElevenLabs
      if (result.phoneCallId) {
        updateCall(sessionId, {
          phoneCallId: result.phoneCallId,
          status: 'started'
        });
      }

      return reply.send({
        success: true,
        phoneCallId: result.phoneCallId,
        sessionId: sessionId,
        message: 'Llamada iniciada correctamente'
      });

    } catch (error) {
      console.error('[PhoneRoute] Error iniciando llamada:', error);
      return reply.code(500).send({
        success: false,
        error: error.message || 'Error al iniciar la llamada'
      });
    }
  });

  /**
   * POST /api/phone/end
   * Finalizar una llamada activa
   */
  fastify.post('/api/phone/end', {
    preHandler: requireAuth,
    schema: {
      body: {
        type: 'object',
        required: ['sessionId'],
        properties: {
          sessionId: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { sessionId } = request.body;

      if (!sessionId) {
        return reply.code(400).send({
          success: false,
          error: 'SessionId es requerido'
        });
      }

      console.log('[PhoneRoute] Finalizando llamada:', sessionId);

      // Finalizar la llamada
      const result = await elevenPhoneSipService.endPhoneCall(sessionId);

      return reply.send({
        success: true,
        message: result.message
      });

    } catch (error) {
      console.error('[PhoneRoute] Error finalizando llamada:', error);
      return reply.code(500).send({
        success: false,
        error: error.message || 'Error al finalizar la llamada'
      });
    }
  });

  /**
   * GET /api/phone/status/:sessionId
   * Obtener el estado de una llamada
   */
  fastify.get('/api/phone/status/:sessionId', {
    preHandler: requireAuth,
    schema: {
      params: {
        type: 'object',
        required: ['sessionId'],
        properties: {
          sessionId: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { sessionId } = request.params;

      const status = elevenPhoneSipService.getCallStatus(sessionId);

      if (!status) {
        return reply.code(404).send({
          success: false,
          error: 'Llamada no encontrada'
        });
      }

      return reply.send({
        success: true,
        status: status
      });

    } catch (error) {
      console.error('[PhoneRoute] Error obteniendo estado:', error);
      return reply.code(500).send({
        success: false,
        error: error.message || 'Error al obtener estado'
      });
    }
  });

  /**
   * POST /api/phone/variables
   * Actualizar variables del agente durante la llamada
   */
  fastify.post('/api/phone/variables', {
    preHandler: requireAuth,
    schema: {
      body: {
        type: 'object',
        required: ['sessionId', 'variables'],
        properties: {
          sessionId: { type: 'string' },
          variables: { type: 'object' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { sessionId, variables } = request.body;

      if (!sessionId || !variables) {
        return reply.code(400).send({
          success: false,
          error: 'SessionId y variables son requeridos'
        });
      }

      console.log('[PhoneRoute] Actualizando variables:', { sessionId, variables });

      // Nota: updateAgentVariables no implementado en SIP service
      // const result = await elevenPhoneSipService.updateAgentVariables(sessionId, variables);
      // Por ahora solo confirmar recepción
      const result = { success: true, message: 'Variables recibidas (función no implementada para SIP)' };

      return reply.send({
        success: true,
        message: result.message
      });

    } catch (error) {
      console.error('[PhoneRoute] Error actualizando variables:', error);
      return reply.code(500).send({
        success: false,
        error: error.message || 'Error al actualizar variables'
      });
    }
  });

  /**
   * GET /api/phone/active
   * Obtener todas las llamadas activas (para dashboard)
   */
  fastify.get('/api/phone/active', {
    preHandler: requireAuth,
  }, async (request, reply) => {
    try {
      // Obtener todas las sesiones del unifiedSessionService
      const stats = unifiedSessionService.getStats();

      // Filtrar solo las que tienen llamadas activas por Phone API
      const activeCalls = stats.sessionInfo
        .filter(session => 
          session.callStatus === 'active' || 
          session.callStatus === 'connected' ||
          session.callStatus === 'starting'
        )
        .map(session => {
          const phoneStatus = elevenPhoneSipService.getCallStatus(session.id);
          return {
            sessionId: session.id,
            ...phoneStatus,
            transcriptCount: session.transcriptCount,
            isAgentActive: session.isAgentActive
          };
        });

      return reply.send({
        success: true,
        calls: activeCalls,
        count: activeCalls.length
      });

    } catch (error) {
      console.error('[PhoneRoute] Error obteniendo llamadas activas:', error);
      return reply.code(500).send({
        success: false,
        error: error.message || 'Error al obtener llamadas activas'
      });
    }
  });
}