// src/routes/sessionRoutes.js
import { createSession, getSessionStats, getSession, removeSession, getTranscriptions, addTranscription } from '../services/sessionService.js';
import { twilioClient } from "../services/twilioService.js";

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
        transcriptCount: session.transcriptions ? session.transcriptions.length : 0,
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

  // Nuevo endpoint para obtener las transcripciones de una sesión
  fastify.get('/session-transcripts', async (request, reply) => {
    try {
      const { sessionId } = request.query;

      if (!sessionId) {
        return reply.code(400).send({
          success: false,
          error: 'Session ID is required'
        });
      }

      const transcriptions = getTranscriptions(sessionId);

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

      const added = addTranscription(sessionId, text, speakerType);

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
      const session = getSession(sessionId);

      if (!session) {
        return reply.code(404).send({
          success: false,
          error: 'Session not found'
        });
      }

      // Si la sesión tiene una llamada activa, finalizarla primero
      if (session.callSid) {
        try {
          await twilioClient.calls(session.callSid).update({ status: "completed" });
          console.log(`[SessionRoutes] Llamada ${session.callSid} finalizada como parte de terminación de sesión ${sessionId}`);
        } catch (twilioError) {
          // No bloqueamos la terminación de la sesión si falla la finalización de la llamada
          console.error(`[SessionRoutes] Error al finalizar llamada durante terminación de sesión:`, twilioError);
        }
      }

      // Eliminar la sesión
      const removed = removeSession(sessionId);

      if (removed) {
        return reply.send({
          success: true,
          message: `Session ${sessionId} terminated successfully`
        });
      } else {
        return reply.code(404).send({
          success: false,
          error: 'Failed to terminate session - session not found or already terminated'
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