// routes/webhookRoutes.js
import phoneWebhookService from '../services/phoneWebhookService.js';

/**
 * Rutas para manejar webhooks de ElevenLabs Phone API
 */
export default async function webhookRoutes(fastify, options) {

  /**
   * POST /api/phone/webhook
   * Endpoint principal para recibir webhooks de ElevenLabs
   */
  fastify.post('/api/phone/webhook', {
    // No requiere autenticación ya que viene de ElevenLabs
    schema: {
      body: {
        type: 'object',
        required: ['event_type'],
        properties: {
          event_type: { type: 'string' },
          phone_call_id: { type: 'string' },
          session_id: { type: 'string' },
          timestamp: { type: 'string' },
          data: { type: 'object' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      // Log del webhook recibido
      console.log('[Webhook] Recibido:', {
        eventType: request.body.event_type,
        phoneCallId: request.body.phone_call_id,
        sessionId: request.body.session_id
      });

      // Validar firma del webhook (si ElevenLabs proporciona una)
      const signature = request.headers['x-elevenlabs-signature'];
      if (signature) {
        const isValid = phoneWebhookService.validateWebhookSignature(
          signature,
          JSON.stringify(request.body)
        );

        if (!isValid) {
          console.warn('[Webhook] Firma inválida');
          return reply.code(401).send({
            success: false,
            error: 'Firma de webhook inválida'
          });
        }
      }

      // Procesar el webhook
      const result = await phoneWebhookService.processWebhook(request.body);

      // Responder rápidamente a ElevenLabs
      return reply.send({
        success: result.success,
        message: result.message || 'Webhook procesado'
      });

    } catch (error) {
      console.error('[Webhook] Error procesando webhook:', error);

      // Responder con error pero sin detalles sensibles
      return reply.code(500).send({
        success: false,
        error: 'Error procesando webhook'
      });
    }
  });

  /**
   * GET /api/phone/webhook/health
   * Health check para verificar que el endpoint está funcionando
   */
  fastify.get('/api/phone/webhook/health', async (request, reply) => {
    return reply.send({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString()
    });
  });

  /**
   * POST /api/phone/webhook/test
   * Endpoint de prueba para simular webhooks (solo desarrollo)
   */
  if (process.env.NODE_ENV !== 'production') {
    fastify.post('/api/phone/webhook/test', {
      schema: {
        body: {
          type: 'object',
          required: ['event_type'],
          properties: {
            event_type: { type: 'string' },
            session_id: { type: 'string' },
            data: { type: 'object' }
          }
        }
      }
    }, async (request, reply) => {
      try {
        console.log('[Webhook] Procesando webhook de prueba:', request.body);

        // Simular un webhook con datos de prueba
        const testWebhook = {
          event_type: request.body.event_type,
          phone_call_id: `test_${Date.now()}`,
          session_id: request.body.session_id || `test_session_${Date.now()}`,
          timestamp: new Date().toISOString(),
          data: request.body.data || {}
        };

        const result = await phoneWebhookService.processWebhook(testWebhook);

        return reply.send({
          success: true,
          message: 'Webhook de prueba procesado',
          result: result
        });

      } catch (error) {
        console.error('[Webhook] Error en webhook de prueba:', error);
        return reply.code(500).send({
          success: false,
          error: error.message
        });
      }
    });
  }

  // Logging middleware específico para webhooks
  fastify.addHook('onRequest', async (request, reply) => {
    if (request.url.startsWith('/api/phone/webhook')) {
      console.log('[Webhook] Request:', {
        method: request.method,
        url: request.url,
        headers: request.headers,
        ip: request.ip
      });
    }
  });

  fastify.addHook('onResponse', async (request, reply) => {
    if (request.url.startsWith('/api/phone/webhook')) {
      console.log('[Webhook] Response:', {
        statusCode: reply.statusCode,
        time: reply.getResponseTime()
      });
    }
  });
}