// routes/agentRoutes.js
import { 
  activateAgentMode, 
  deactivateAgentMode,
  processAgentAudio,
  processAgentTranscript
} from '../services/speechService.js';
import { requireAuth } from '../middleware/auth-middleware.js';
import unifiedSessionService from '../services/unifiedSessionService.js';

export default async function agentRoutes(fastify, options) {
  // Tomar control como agente
  fastify.post('/api/agent/take-control', {
    preHandler: requireAuth
  }, async (request, reply) => {
    try {
      const { sessionId } = request.body;

      if (!sessionId) {
        return reply.code(400).send({
          success: false,
          error: 'SessionId es requerido'
        });
      }

      // Verificar que la sesión existe usando el servicio unificado
      const session = unifiedSessionService.getSession(sessionId);
      if (!session) {
        return reply.code(404).send({
          success: false,
          error: 'Sesión no encontrada'
        });
      }

      // Activar modo agente
      const success = await activateAgentMode(sessionId);

      if (success) {
        console.log(`[AgentAPI] Control tomado por agente en sesión ${sessionId}`);
        return reply.send({
          success: true,
          message: 'Control de agente activado'
        });
      } else {
        return reply.code(500).send({
          success: false,
          error: 'No se pudo activar el modo agente'
        });
      }
    } catch (error) {
      console.error('[AgentAPI] Error tomando control:', error);
      return reply.code(500).send({
        success: false,
        error: 'Error interno al tomar control'
      });
    }
  });

  // Liberar control del agente
  fastify.post('/api/agent/release-control', {
    preHandler: requireAuth
  }, async (request, reply) => {
    try {
      const { sessionId } = request.body;

      if (!sessionId) {
        return reply.code(400).send({
          success: false,
          error: 'SessionId es requerido'
        });
      }

      // Desactivar modo agente
      const success = await deactivateAgentMode(sessionId);

      if (success) {
        console.log(`[AgentAPI] Control liberado por agente en sesión ${sessionId}`);
        return reply.send({
          success: true,
          message: 'Control de agente desactivado'
        });
      } else {
        return reply.code(500).send({
          success: false,
          error: 'No se pudo desactivar el modo agente'
        });
      }
    } catch (error) {
      console.error('[AgentAPI] Error liberando control:', error);
      return reply.code(500).send({
        success: false,
        error: 'Error interno al liberar control'
      });
    }
  });

  // Enviar audio del agente
  fastify.post('/api/agent/audio', {
    preHandler: requireAuth
  }, async (request, reply) => {
    try {
      const { sessionId, audio, format, sampleRate } = request.body;

      if (!sessionId || !audio) {
        return reply.code(400).send({
          success: false,
          error: 'SessionId y audio son requeridos'
        });
      }

      // Procesar el audio del agente
      await processAgentAudio(sessionId, {
        audio: audio,
        format: format || 'base64',
        sampleRate: sampleRate || 16000
      });

      return reply.send({
        success: true,
        message: 'Audio procesado'
      });
    } catch (error) {
      console.error('[AgentAPI] Error procesando audio:', error);
      return reply.code(500).send({
        success: false,
        error: 'Error procesando audio del agente'
      });
    }
  });

  // Enviar mensaje de texto del agente
  fastify.post('/api/agent/message', {
    preHandler: requireAuth
  }, async (request, reply) => {
    try {
      const { sessionId, message } = request.body;

      if (!sessionId || !message) {
        return reply.code(400).send({
          success: false,
          error: 'SessionId y mensaje son requeridos'
        });
      }

      // Procesar el mensaje del agente
      await processAgentTranscript(sessionId, message);

      return reply.send({
        success: true,
        message: 'Mensaje enviado'
      });
    } catch (error) {
      console.error('[AgentAPI] Error enviando mensaje:', error);
      return reply.code(500).send({
        success: false,
        error: 'Error enviando mensaje del agente'
      });
    }
  });

  // Upload de archivo de audio (para grabaciones completas)
  fastify.post('/api/agent/upload-audio', {
    preHandler: requireAuth
  }, async (request, reply) => {
    try {
      // Configurar para manejar multipart/form-data
      const data = await request.file();

      if (!data) {
        return reply.code(400).send({
          success: false,
          error: 'No se recibió archivo de audio'
        });
      }

      const sessionId = data.fields.sessionId?.value;
      if (!sessionId) {
        return reply.code(400).send({
          success: false,
          error: 'SessionId es requerido'
        });
      }

      // Leer el archivo de audio
      const buffer = await data.toBuffer();

      // Procesar el audio
      await processAgentAudio(sessionId, {
        payload: buffer,
        format: 'webm',
        mimeType: data.mimetype
      });

      return reply.send({
        success: true,
        message: 'Audio cargado y procesado'
      });
    } catch (error) {
      console.error('[AgentAPI] Error cargando audio:', error);
      return reply.code(500).send({
        success: false,
        error: 'Error cargando audio del agente'
      });
    }
  });

  // Obtener estado del agente para una sesión
  fastify.get('/api/agent/status/:sessionId', {
    preHandler: requireAuth
  }, async (request, reply) => {
    try {
      const { sessionId } = request.params;

      const session = unifiedSessionService.getSession(sessionId);
      if (!session) {
        return reply.code(404).send({
          success: false,
          error: 'Sesión no encontrada'
        });
      }

      return reply.send({
        success: true,
        sessionId: sessionId,
        isAgentActive: session.agent.isActive,
        hasActiveCall: session.call.status === 'active'
      });
    } catch (error) {
      console.error('[AgentAPI] Error obteniendo estado:', error);
      return reply.code(500).send({
        success: false,
        error: 'Error obteniendo estado del agente'
      });
    }
  });
}