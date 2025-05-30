// routes/twilioCallbacks.js
import { findCallByCallSid } from '../services/callStorageService.js';
import unifiedSessionService from '../services/unifiedSessionService.js';

/**
 * Rutas para manejar los callbacks de estado de Twilio
 * @param {object} fastify - Instancia de Fastify
 * @param {object} options - Opciones de configuración
 */
export default async function twilioCallbackRoutes(fastify, options) {
  // Endpoint para recibir callbacks de estado de Twilio
  fastify.post('/twilio-status-callback', async (request, reply) => {
    try {
      // Extraer información relevante del cuerpo del request
      const {
        CallSid,
        CallStatus,
        CallDuration,
        ErrorCode,
        ErrorMessage
      } = request.body;

      if (!CallSid) {
        console.error('[TwilioCallback] Error: Recibido callback sin CallSid');
        return reply.code(400).send({
          success: false,
          error: 'No CallSid provided'
        });
      }

      console.log(`[TwilioCallback] Recibido estado: ${CallStatus} para CallSid: ${CallSid}`);

      // Buscar la sesión asociada con este CallSid
      const callInfo = findCallByCallSid(CallSid);

      if (!callInfo || !callInfo.sessionId) {
        console.warn(`[TwilioCallback] No se encontró sesión asociada con CallSid: ${CallSid}`);

        // Aún así respondemos 200 OK a Twilio para evitar reintentos
        return reply.code(200).send({
          success: false,
          error: 'No session found for this CallSid'
        });
      }

      const { sessionId } = callInfo;
      console.log(`[TwilioCallback] Encontrada sesión ${sessionId} para CallSid: ${CallSid}`);

      // Mapear el estado de Twilio a un estado más amigable para la UI
      let uiStatus = CallStatus;
      let statusMessage = '';

      switch (CallStatus) {
        case 'initiated':
          uiStatus = 'starting';
          statusMessage = 'Iniciando llamada...';
          break;
        case 'ringing':
          uiStatus = 'ringing';
          statusMessage = 'Llamando...';
          break;
        case 'in-progress':
        case 'answered':
          uiStatus = 'connected';
          statusMessage = 'Llamada conectada';
          break;
        case 'completed':
          uiStatus = 'ended';
          statusMessage = 'Llamada finalizada';
          break;
        case 'busy':
          uiStatus = 'busy';
          statusMessage = 'Número ocupado';
          break;
        case 'no-answer':
          uiStatus = 'no-answer';
          statusMessage = 'Sin respuesta';
          break;
        case 'failed':
          uiStatus = 'failed';
          statusMessage = `Error: ${ErrorMessage || 'Desconocido'}`;
          break;
        case 'canceled':
          uiStatus = 'canceled';
          statusMessage = 'Llamada cancelada';
          break;
        default:
          uiStatus = CallStatus;
          statusMessage = `Estado: ${CallStatus}`;
      }

      // Actualizar el estado de la llamada en el servicio unificado
      unifiedSessionService.updateCallInfo(sessionId, {
        callStatus: CallStatus,
        status: uiStatus,
        statusMessage,
        callDuration: CallDuration ? parseInt(CallDuration) : undefined,
        errorCode: ErrorCode,
        errorMessage: ErrorMessage,
        updatedAt: Date.now()
      });

      // Si la llamada finalizó, marcarla como tal
      if (['completed', 'busy', 'no-answer', 'failed', 'canceled'].includes(CallStatus)) {
        unifiedSessionService.endCall(sessionId, {
          callSid: CallSid,
          endReason: CallStatus,
          duration: CallDuration ? parseInt(CallDuration) : undefined
        });
      }

      // Enviar notificación SOLO a los clientes conectados a esta sesión
      unifiedSessionService.broadcastToSession(sessionId, JSON.stringify({
        type: 'call_status_update',
        callSid: CallSid,
        status: uiStatus,
        message: statusMessage,
        timestamp: Date.now()
      }));

      // Siempre responder con 200 OK a Twilio
      return reply.code(200).send({
        success: true,
        message: `Callback procesado para ${CallSid}, estado: ${CallStatus}`
      });
    } catch (error) {
      console.error('[TwilioCallback] Error procesando callback:', error);
      // Aún así respondemos 200 OK a Twilio para evitar reintentos
      return reply.code(200).send({
        success: false,
        error: 'Error interno al procesar el callback'
      });
    }
  });
}