// services/phoneWebhookService.js
import unifiedSessionService from './unifiedSessionService.js';
import { registerCall, updateCall, endCall as storageEndCall, addCallTranscription } from './callStorageService.js';

/**
 * Servicio para procesar webhooks de ElevenLabs Phone API
 */
class PhoneWebhookService {
  constructor() {
    this.eventHandlers = new Map();
    this.setupEventHandlers();
  }

  /**
   * Configurar manejadores de eventos
   */
  setupEventHandlers() {
    // Eventos de llamada
    this.eventHandlers.set('phone_call.started', this.handleCallStarted.bind(this));
    this.eventHandlers.set('phone_call.ringing', this.handleCallRinging.bind(this));
    this.eventHandlers.set('phone_call.connected', this.handleCallConnected.bind(this));
    this.eventHandlers.set('phone_call.ended', this.handleCallEnded.bind(this));
    this.eventHandlers.set('phone_call.failed', this.handleCallFailed.bind(this));

    // Eventos de transcripción
    this.eventHandlers.set('transcript.user.partial', this.handleUserTranscriptPartial.bind(this));
    this.eventHandlers.set('transcript.user.final', this.handleUserTranscriptFinal.bind(this));
    this.eventHandlers.set('transcript.agent.partial', this.handleAgentTranscriptPartial.bind(this));
    this.eventHandlers.set('transcript.agent.final', this.handleAgentTranscriptFinal.bind(this));

    // Eventos de audio
    this.eventHandlers.set('audio.input.started', this.handleAudioInputStarted.bind(this));
    this.eventHandlers.set('audio.input.ended', this.handleAudioInputEnded.bind(this));
    this.eventHandlers.set('audio.output.started', this.handleAudioOutputStarted.bind(this));
    this.eventHandlers.set('audio.output.ended', this.handleAudioOutputEnded.bind(this));

    // Eventos de interrupción
    this.eventHandlers.set('interruption.detected', this.handleInterruption.bind(this));

    // Eventos de error
    this.eventHandlers.set('error', this.handleError.bind(this));
  }

  /**
   * Procesar webhook principal
   * @param {Object} webhookData - Datos del webhook
   * @returns {Object} Respuesta del procesamiento
   */
  async processWebhook(webhookData) {
    const { 
      event_type, 
      phone_call_id,
      session_id,
      timestamp,
      data 
    } = webhookData;

    console.log(`[PhoneWebhook] Procesando evento: ${event_type}`, {
      phone_call_id,
      session_id,
      timestamp
    });

    try {
      // Buscar el handler para este tipo de evento
      const handler = this.eventHandlers.get(event_type);

      if (handler) {
        await handler({
          phone_call_id,
          session_id,
          timestamp,
          data
        });

        return {
          success: true,
          message: `Evento ${event_type} procesado correctamente`
        };
      } else {
        console.warn(`[PhoneWebhook] Evento no manejado: ${event_type}`);
        return {
          success: true,
          message: `Evento ${event_type} recibido pero no procesado`
        };
      }
    } catch (error) {
      console.error(`[PhoneWebhook] Error procesando evento ${event_type}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Manejadores de eventos específicos

  /**
   * Llamada iniciada
   */
  async handleCallStarted(event) {
    const { phone_call_id, session_id, data } = event;

    console.log('[PhoneWebhook] Llamada iniciada:', phone_call_id);

    // Actualizar en unifiedSessionService
    if (session_id) {
      unifiedSessionService.updateCallInfo(session_id, {
        phoneCallId: phone_call_id,
        status: 'starting',
        startTime: Date.now()
      });

      // Notificar a clientes WebSocket
      unifiedSessionService.broadcastToSession(session_id, JSON.stringify({
        type: 'call_status_update',
        status: 'starting',
        message: 'Iniciando llamada...'
      }));
    }
  }

  /**
   * Llamada sonando
   */
  async handleCallRinging(event) {
    const { phone_call_id, session_id, data } = event;

    console.log('[PhoneWebhook] Llamada sonando:', phone_call_id);

    if (session_id) {
      unifiedSessionService.updateCallInfo(session_id, {
        status: 'ringing'
      });

      unifiedSessionService.broadcastToSession(session_id, JSON.stringify({
        type: 'call_status_update',
        status: 'ringing',
        message: 'Llamando...'
      }));
    }
  }

  /**
   * Llamada conectada
   */
  async handleCallConnected(event) {
    const { phone_call_id, session_id, data } = event;

    console.log('[PhoneWebhook] Llamada conectada:', phone_call_id);

    if (session_id) {
      unifiedSessionService.updateCallInfo(session_id, {
        status: 'connected',
        connectedTime: Date.now()
      });

      // Registrar en storage
      updateCall(session_id, {
        status: 'active',
        phoneCallConnected: true
      });

      unifiedSessionService.broadcastToSession(session_id, JSON.stringify({
        type: 'call_status_update',
        status: 'connected',
        message: 'Llamada conectada'
      }));
    }
  }

  /**
   * Llamada finalizada
   */
  async handleCallEnded(event) {
    const { phone_call_id, session_id, data } = event;

    console.log('[PhoneWebhook] Llamada finalizada:', phone_call_id, data.reason);

    if (session_id) {
      const endData = {
        phoneCallId: phone_call_id,
        endReason: data.reason || 'normal',
        duration: data.duration
      };

      // Actualizar en unifiedSessionService
      unifiedSessionService.endCall(session_id, endData);

      // Actualizar en storage
      storageEndCall(session_id, endData);

      unifiedSessionService.broadcastToSession(session_id, JSON.stringify({
        type: 'call_status_update',
        status: 'ended',
        message: `Llamada finalizada: ${data.reason || 'normal'}`
      }));
    }
  }

  /**
   * Llamada fallida
   */
  async handleCallFailed(event) {
    const { phone_call_id, session_id, data } = event;

    console.log('[PhoneWebhook] Llamada fallida:', phone_call_id, data.error);

    if (session_id) {
      unifiedSessionService.updateCallInfo(session_id, {
        status: 'failed',
        error: data.error
      });

      unifiedSessionService.broadcastToSession(session_id, JSON.stringify({
        type: 'call_status_update',
        status: 'failed',
        message: `Error: ${data.error || 'Llamada fallida'}`
      }));
    }
  }

  /**
   * Transcripción parcial del usuario
   */
  async handleUserTranscriptPartial(event) {
    const { session_id, data } = event;

    if (session_id && data.text) {
      console.log('[PhoneWebhook] Transcripción parcial usuario:', data.text);

      unifiedSessionService.broadcastToSession(session_id, JSON.stringify({
        type: 'user_transcript_partial',
        text: data.text
      }));
    }
  }

  /**
   * Transcripción final del usuario
   */
  async handleUserTranscriptFinal(event) {
    const { session_id, data } = event;

    if (session_id && data.text) {
      console.log('[PhoneWebhook] Transcripción final usuario:', data.text);

      // Guardar transcripción
      unifiedSessionService.addTranscription(session_id, data.text, 'client');
      addCallTranscription(session_id, data.text, 'client');

      unifiedSessionService.broadcastToSession(session_id, JSON.stringify({
        type: 'user_transcript',
        text: data.text
      }));
    }
  }

  /**
   * Transcripción parcial del agente
   */
  async handleAgentTranscriptPartial(event) {
    const { session_id, data } = event;

    if (session_id && data.text) {
      console.log('[PhoneWebhook] Transcripción parcial agente:', data.text);

      unifiedSessionService.broadcastToSession(session_id, JSON.stringify({
        type: 'agent_transcript_partial',
        text: data.text
      }));
    }
  }

  /**
   * Transcripción final del agente
   */
  async handleAgentTranscriptFinal(event) {
    const { session_id, data } = event;

    if (session_id && data.text) {
      console.log('[PhoneWebhook] Transcripción final agente:', data.text);

      // Guardar transcripción
      unifiedSessionService.addTranscription(session_id, data.text, 'bot');
      addCallTranscription(session_id, data.text, 'bot');

      unifiedSessionService.broadcastToSession(session_id, JSON.stringify({
        type: 'agent_response',
        text: data.text
      }));
    }
  }

  /**
   * Audio input iniciado
   */
  async handleAudioInputStarted(event) {
    const { session_id } = event;

    if (session_id) {
      console.log('[PhoneWebhook] Usuario comenzó a hablar');

      unifiedSessionService.broadcastToSession(session_id, JSON.stringify({
        type: 'user_speaking',
        status: 'started'
      }));
    }
  }

  /**
   * Audio input finalizado
   */
  async handleAudioInputEnded(event) {
    const { session_id } = event;

    if (session_id) {
      console.log('[PhoneWebhook] Usuario dejó de hablar');

      unifiedSessionService.broadcastToSession(session_id, JSON.stringify({
        type: 'user_speaking',
        status: 'ended'
      }));
    }
  }

  /**
   * Audio output iniciado
   */
  async handleAudioOutputStarted(event) {
    const { session_id } = event;

    if (session_id) {
      console.log('[PhoneWebhook] Agente comenzó a hablar');

      unifiedSessionService.broadcastToSession(session_id, JSON.stringify({
        type: 'agent_speaking',
        status: 'started'
      }));
    }
  }

  /**
   * Audio output finalizado
   */
  async handleAudioOutputEnded(event) {
    const { session_id } = event;

    if (session_id) {
      console.log('[PhoneWebhook] Agente dejó de hablar');

      unifiedSessionService.broadcastToSession(session_id, JSON.stringify({
        type: 'agent_speaking',
        status: 'ended'
      }));
    }
  }

  /**
   * Interrupción detectada
   */
  async handleInterruption(event) {
    const { session_id, data } = event;

    if (session_id) {
      console.log('[PhoneWebhook] Interrupción detectada');

      unifiedSessionService.broadcastToSession(session_id, JSON.stringify({
        type: 'interruption',
        message: 'Interrupción detectada'
      }));
    }
  }

  /**
   * Error
   */
  async handleError(event) {
    const { session_id, data } = event;

    console.error('[PhoneWebhook] Error:', data);

    if (session_id) {
      unifiedSessionService.broadcastToSession(session_id, JSON.stringify({
        type: 'error',
        error: data.message || 'Error desconocido'
      }));
    }
  }

  /**
   * Validar firma del webhook (seguridad)
   * @param {string} signature - Firma del webhook
   * @param {string} body - Cuerpo del webhook
   * @returns {boolean} Si la firma es válida
   */
  validateWebhookSignature(signature, body) {
    // TODO: Implementar validación de firma cuando ElevenLabs la proporcione
    // Por ahora, retornar true
    return true;
  }
}

// Crear instancia única
const phoneWebhookService = new PhoneWebhookService();

// Exportar
export default phoneWebhookService;

// También exportar funciones individuales
export const {
  processWebhook,
  validateWebhookSignature
} = {
  processWebhook: (data) => phoneWebhookService.processWebhook(data),
  validateWebhookSignature: (sig, body) => phoneWebhookService.validateWebhookSignature(sig, body)
};