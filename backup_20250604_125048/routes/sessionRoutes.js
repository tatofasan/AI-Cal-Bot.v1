// routes/sessionRoutes.js
import unifiedSessionService from '../services/unifiedSessionService.js';
import { twilioClient } from "../services/twilioService.js";
import { updateCall } from '../services/callStorageService.js';

export default async function sessionRoutes(fastify, options) {
  // Endpoint para solicitar un nuevo sessionId
  fastify.get('/create-session', async (request, reply) => {
    try {
      // Obtener la IP del cliente para el registro
      const clientIp = request.headers['x-forwarded-for'] || request.ip || 'desconocida';

      // Crear sesión usando el servicio unificado
      const session = unifiedSessionService.createSession();
      const sessionId = session.id;

      // Actualizar con información del cliente
      unifiedSessionService.updateCallInfo(sessionId, { 
        clientIp,
        isRealCall: false,
        isSessionOnly: true
      });

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

  // Endpoint opcional para obtener estadísticas de las sesiones
  fastify.get('/session-stats', async (request, reply) => {
    try {
      const stats = unifiedSessionService.getStats();

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

      const session = unifiedSessionService.getSession(sessionId);

      if (!session) {
        return reply.code(404).send({
          success: false,
          error: 'Session not found'
        });
      }

      // Crear un objeto con información segura para enviar
      const safeSession = {
        id: session.id,
        createdAt: session.createdAt,
        lastActivity: session.lastActivity,
        callSid: session.call.sid,
        callStatus: session.call.status,
        isAgentActive: session.agent.isActive,
        transcriptCount: session.transcriptions.length,
        connections: {
          logClients: session.connections.logClients.size,
          hasTwilioConnection: !!session.connections.twilioWs,
          hasElevenLabsConnection: !!session.connections.elevenLabsConversation
        }
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

  // Endpoint para obtener las transcripciones de una sesión
  fastify.get('/session-transcripts', async (request, reply) => {
    try {
      const { sessionId } = request.query;

      if (!sessionId) {
        return reply.code(400).send({
          success: false,
          error: 'Session ID is required'
        });
      }

      const transcriptions = unifiedSessionService.getTranscriptions(sessionId);

      if (transcriptions === null) {
        return reply.code(404).send({
          success: false,
          error: 'Session not found'
        });
      }

      return reply.send({
        success: true,
        sessionId,
        transcriptions
      });
    } catch (error) {
      console.error('[SessionRoutes] Error fetching transcriptions:', error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch transcriptions'
      });
    }
  });

  // Endpoint para añadir una transcripción a una sesión
  fastify.post('/add-transcript', async (request, reply) => {
    try {
      const { sessionId, text, speakerType } = request.body;

      if (!sessionId || !text || !speakerType) {
        return reply.code(400).send({
          success: false,
          error: 'SessionId, text, and speakerType are required'
        });
      }

      const added = unifiedSessionService.addTranscription(sessionId, text, speakerType);

      if (!added) {
        return reply.code(404).send({
          success: false,
          error: 'Session not found'
        });
      }

      return reply.send({
        success: true,
        message: 'Transcription added successfully'
      });
    } catch (error) {
      console.error('[SessionRoutes] Error adding transcription:', error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to add transcription'
      });
    }
  });

  // Endpoint para terminar una sesión
  fastify.post('/terminate-session', async (request, reply) => {
    try {
      const { sessionId } = request.body;

      if (!sessionId) {
        return reply.code(400).send({
          success: false,
          error: 'Session ID is required'
        });
      }

      // Obtener la sesión para verificar si está en una llamada activa
      const session = unifiedSessionService.getSession(sessionId);

      if (!session) {
        return reply.code(404).send({
          success: false,
          error: 'Session not found'
        });
      }

      // Si la sesión tiene una llamada activa, finalizarla primero en Twilio
      if (session.call.sid && session.call.status === 'active') {
        try {
          await twilioClient.calls(session.call.sid).update({ status: "completed" });
          console.log(`[SessionRoutes] Llamada ${session.call.sid} finalizada en Twilio`);
        } catch (twilioError) {
          console.error(`[SessionRoutes] Error al finalizar llamada en Twilio:`, twilioError);
        }
      }

      // Eliminar la sesión usando el servicio unificado
      const removed = unifiedSessionService.removeSession(sessionId);

      if (removed) {
        return reply.send({
          success: true,
          message: `Session ${sessionId} terminated successfully`
        });
      } else {
        return reply.code(404).send({
          success: false,
          error: 'Failed to terminate session'
        });
      }
    } catch (error) {
      console.error('[SessionRoutes] Error terminating session:', error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to terminate session due to server error'
      });
    }
  });
}