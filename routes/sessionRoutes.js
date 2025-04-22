// src/routes/sessionRoutes.js
import { createSession, getSessionStats, getSession } from '../services/sessionService.js';

export default async function sessionRoutes(fastify, options) {
  // Endpoint para solicitar un nuevo sessionId
  fastify.get('/create-session', async (request, reply) => {
    try {
      const sessionId = createSession();

      return reply.send({
        success: true,
        sessionId,
        message: 'Session created successfully'
      });
    } catch (error) {
      console.error('[SessionRoutes] Error creating session:', error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to create session'
      });
    }
  });

  // Endpoint opcional para obtener estadísticas de las sesiones (para administradores/debugging)
  fastify.get('/session-stats', async (request, reply) => {
    try {
      const stats = getSessionStats();

      return reply.send({
        success: true,
        stats
      });
    } catch (error) {
      console.error('[SessionRoutes] Error fetching session stats:', error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch session statistics'
      });
    }
  });

  // Endpoint para obtener detalles de una sesión específica
  fastify.get('/session-details', async (request, reply) => {
    try {
      const { sessionId } = request.query;

      if (!sessionId) {
        return reply.code(400).send({
          success: false,
          error: 'Session ID is required'
        });
      }

      const session = getSession(sessionId);

      if (!session) {
        return reply.code(404).send({
          success: false,
          error: 'Session not found'
        });
      }

      // Crear un objeto con información segura para enviar (sin referencias circulares)
      const safeSession = {
        id: session.id,
        createdAt: session.createdAt,
        lastActivity: session.lastActivity,
        callSid: session.callSid,
        isAgentActive: session.isAgentActive,
        logClients: {
          size: session.logClients ? session.logClients.size : 0
        },
        hasTwilioConnection: !!session.twilioWs,
        hasElevenLabsConnection: !!session.elevenLabsWs,
        hasAgentConnection: !!session.agentWs
      };

      return reply.send({
        success: true,
        session: safeSession
      });
    } catch (error) {
      console.error('[SessionRoutes] Error fetching session details:', error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch session details'
      });
    }
  });
}