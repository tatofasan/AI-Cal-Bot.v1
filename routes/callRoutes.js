// routes/callRoutes.js
import {
  registerCall,
  updateCall,
  endCall,
  getAllCalls,
  getCall,
  getCallTranscriptions
} from '../services/callStorageService.js';

export default async function callRoutes(fastify, options) {
  // Endpoint para obtener todas las llamadas activas y recientes
  fastify.get('/api/calls', async (request, reply) => {
    try {
      const calls = getAllCalls();

      return reply.send({
        success: true,
        timestamp: Date.now(),
        calls
      });
    } catch (error) {
      console.error("[CallAPI] Error obteniendo llamadas:", error);
      return reply.code(500).send({
        success: false,
        error: "Error interno al obtener llamadas"
      });
    }
  });

  // Endpoint para obtener detalles de una llamada específica
  fastify.get('/api/calls/:callId', async (request, reply) => {
    try {
      const { callId } = request.params;

      if (!callId) {
        return reply.code(400).send({
          success: false,
          error: 'Call ID es requerido'
        });
      }

      const call = getCall(callId);

      if (!call) {
        return reply.code(404).send({
          success: false,
          error: 'Llamada no encontrada'
        });
      }

      return reply.send({
        success: true,
        call
      });
    } catch (error) {
      console.error("[CallAPI] Error obteniendo detalles de la llamada:", error);
      return reply.code(500).send({
        success: false,
        error: "Error interno al obtener detalles de la llamada"
      });
    }
  });

  // Endpoint para obtener transcripciones de una llamada
  fastify.get('/api/calls/:callId/transcriptions', async (request, reply) => {
    try {
      const { callId } = request.params;

      if (!callId) {
        return reply.code(400).send({
          success: false,
          error: 'Call ID es requerido'
        });
      }

      const transcriptions = getCallTranscriptions(callId);

      if (transcriptions === null) {
        return reply.code(404).send({
          success: false,
          error: 'Llamada no encontrada'
        });
      }

      return reply.send({
        success: true,
        callId,
        transcriptions
      });
    } catch (error) {
      console.error("[CallAPI] Error obteniendo transcripciones:", error);
      return reply.code(500).send({
        success: false,
        error: "Error interno al obtener transcripciones"
      });
    }
  });
}