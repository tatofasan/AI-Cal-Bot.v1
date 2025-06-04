// services/elevenPhoneService.js
import { ElevenLabsClient } from "elevenlabs";

// Configuración
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_AGENT_ID = process.env.ELEVENLABS_AGENT_ID;
const ELEVENLABS_PHONE_NUMBER_ID = process.env.ELEVENLABS_PHONE_NUMBER_ID;
const ELEVENLABS_CALLER_NUMBER = process.env.ELEVENLABS_CALLER_NUMBER || '+17346276080';

// Cliente de ElevenLabs
const client = new ElevenLabsClient({
  apiKey: ELEVENLABS_API_KEY
});

/**
 * Servicio para manejar llamadas telefónicas con ElevenLabs Phone API
 */
class ElevenPhoneService {
  constructor() {
    this.activePhoneCalls = new Map();
  }

  /**
   * Iniciar una llamada telefónica
   * @param {Object} callData - Datos de la llamada
   * @returns {Object} Resultado de la llamada
   */
  async initiatePhoneCall(callData) {
    const { 
      sessionId, 
      phoneNumber, 
      userName,
      voiceId,
      voiceName 
    } = callData;

    try {
      console.log('[ElevenPhone] Iniciando llamada:', {
        sessionId,
        phoneNumber,
        userName,
        voiceId
      });

      // Crear la llamada usando Phone API
      const phoneCall = await client.conversationalAi.createPhoneCall({
        phone_number_id: ELEVENLABS_PHONE_NUMBER_ID,
        customer_number: phoneNumber,
        agent_id: ELEVENLABS_AGENT_ID,

        // Configuración adicional
        first_message: `Hola, ¿hablo con ${userName}?`,

        // Variables dinámicas para el agente
        variables: {
          user_name: userName,
          voice_id: voiceId,
          voice_name: voiceName
        },

        // Webhook para recibir eventos
        webhook_url: `${process.env.WEBHOOK_BASE_URL}/api/phone/webhook`
      });

      // Guardar referencia de la llamada
      this.activePhoneCalls.set(sessionId, {
        phoneCallId: phoneCall.phone_call_id,
        status: 'initiated',
        startTime: Date.now(),
        phoneNumber,
        userName,
        voiceId,
        voiceName
      });

      console.log('[ElevenPhone] Llamada iniciada exitosamente:', phoneCall.phone_call_id);

      return {
        success: true,
        phoneCallId: phoneCall.phone_call_id,
        sessionId,
        message: 'Llamada iniciada correctamente'
      };

    } catch (error) {
      console.error('[ElevenPhone] Error iniciando llamada:', error);
      throw error;
    }
  }

  /**
   * Finalizar una llamada activa
   * @param {string} sessionId - ID de la sesión
   * @returns {Object} Resultado
   */
  async endPhoneCall(sessionId) {
    try {
      const phoneCall = this.activePhoneCalls.get(sessionId);

      if (!phoneCall) {
        throw new Error('Llamada no encontrada');
      }

      console.log('[ElevenPhone] Finalizando llamada:', phoneCall.phoneCallId);

      // Finalizar la llamada a través de la API
      await client.conversationalAi.endPhoneCall(phoneCall.phoneCallId);

      // Actualizar estado
      phoneCall.status = 'ended';
      phoneCall.endTime = Date.now();

      // Eliminar de llamadas activas
      this.activePhoneCalls.delete(sessionId);

      return {
        success: true,
        message: 'Llamada finalizada correctamente'
      };

    } catch (error) {
      console.error('[ElevenPhone] Error finalizando llamada:', error);
      throw error;
    }
  }

  /**
   * Obtener estado de una llamada
   * @param {string} sessionId - ID de la sesión
   * @returns {Object} Estado de la llamada
   */
  getCallStatus(sessionId) {
    const phoneCall = this.activePhoneCalls.get(sessionId);

    if (!phoneCall) {
      return null;
    }

    return {
      ...phoneCall,
      duration: phoneCall.endTime 
        ? phoneCall.endTime - phoneCall.startTime 
        : Date.now() - phoneCall.startTime
    };
  }

  /**
   * Actualizar variables del agente durante la llamada
   * @param {string} sessionId - ID de la sesión
   * @param {Object} variables - Variables a actualizar
   */
  async updateAgentVariables(sessionId, variables) {
    try {
      const phoneCall = this.activePhoneCalls.get(sessionId);

      if (!phoneCall) {
        throw new Error('Llamada no encontrada');
      }

      console.log('[ElevenPhone] Actualizando variables:', variables);

      // Actualizar variables a través de la API
      await client.conversationalAi.updatePhoneCallVariables(
        phoneCall.phoneCallId,
        variables
      );

      return {
        success: true,
        message: 'Variables actualizadas'
      };

    } catch (error) {
      console.error('[ElevenPhone] Error actualizando variables:', error);
      throw error;
    }
  }

  /**
   * Manejar webhooks de eventos de llamada
   * @param {Object} webhookData - Datos del webhook
   */
  handleWebhook(webhookData) {
    const { 
      event_type,
      phone_call_id,
      session_id,
      data 
    } = webhookData;

    console.log('[ElevenPhone] Webhook recibido:', event_type);

    // Buscar la sesión por phone_call_id
    let sessionId = session_id;
    if (!sessionId) {
      for (const [sid, call] of this.activePhoneCalls.entries()) {
        if (call.phoneCallId === phone_call_id) {
          sessionId = sid;
          break;
        }
      }
    }

    if (!sessionId) {
      console.warn('[ElevenPhone] No se encontró sesión para webhook:', phone_call_id);
      return;
    }

    // Procesar según tipo de evento
    switch (event_type) {
      case 'call.started':
        this.handleCallStarted(sessionId, data);
        break;

      case 'call.connected':
        this.handleCallConnected(sessionId, data);
        break;

      case 'call.ended':
        this.handleCallEnded(sessionId, data);
        break;

      case 'transcript.partial':
        this.handleTranscriptPartial(sessionId, data);
        break;

      case 'transcript.final':
        this.handleTranscriptFinal(sessionId, data);
        break;

      case 'agent.response':
        this.handleAgentResponse(sessionId, data);
        break;

      default:
        console.log('[ElevenPhone] Evento no manejado:', event_type);
    }
  }

  // Manejadores de eventos específicos
  handleCallStarted(sessionId, data) {
    const phoneCall = this.activePhoneCalls.get(sessionId);
    if (phoneCall) {
      phoneCall.status = 'started';
      console.log('[ElevenPhone] Llamada iniciada:', sessionId);
    }
  }

  handleCallConnected(sessionId, data) {
    const phoneCall = this.activePhoneCalls.get(sessionId);
    if (phoneCall) {
      phoneCall.status = 'connected';
      phoneCall.connectedTime = Date.now();
      console.log('[ElevenPhone] Llamada conectada:', sessionId);
    }
  }

  handleCallEnded(sessionId, data) {
    const phoneCall = this.activePhoneCalls.get(sessionId);
    if (phoneCall) {
      phoneCall.status = 'ended';
      phoneCall.endTime = Date.now();
      phoneCall.endReason = data.reason || 'normal';
      console.log('[ElevenPhone] Llamada finalizada:', sessionId, data.reason);
    }

    // Eliminar después de un tiempo
    setTimeout(() => {
      this.activePhoneCalls.delete(sessionId);
    }, 5000);
  }

  handleTranscriptPartial(sessionId, data) {
    // Emitir evento para actualización en tiempo real
    console.log('[ElevenPhone] Transcripción parcial:', data.text);
  }

  handleTranscriptFinal(sessionId, data) {
    // Guardar transcripción final
    console.log('[ElevenPhone] Transcripción final:', data.text);
  }

  handleAgentResponse(sessionId, data) {
    // Manejar respuesta del agente
    console.log('[ElevenPhone] Respuesta del agente:', data.text);
  }

  /**
   * Limpiar todas las llamadas activas
   */
  async cleanup() {
    console.log('[ElevenPhone] Limpiando llamadas activas...');

    for (const [sessionId, phoneCall] of this.activePhoneCalls.entries()) {
      try {
        await this.endPhoneCall(sessionId);
      } catch (error) {
        console.error('[ElevenPhone] Error limpiando llamada:', error);
      }
    }

    this.activePhoneCalls.clear();
  }
}

// Crear instancia única
const elevenPhoneService = new ElevenPhoneService();

// Exportar
export default elevenPhoneService;

// También exportar funciones individuales para compatibilidad
export const {
  initiatePhoneCall,
  endPhoneCall,
  getCallStatus,
  updateAgentVariables,
  handleWebhook,
  cleanup
} = {
  initiatePhoneCall: (data) => elevenPhoneService.initiatePhoneCall(data),
  endPhoneCall: (sessionId) => elevenPhoneService.endPhoneCall(sessionId),
  getCallStatus: (sessionId) => elevenPhoneService.getCallStatus(sessionId),
  updateAgentVariables: (sessionId, vars) => elevenPhoneService.updateAgentVariables(sessionId, vars),
  handleWebhook: (data) => elevenPhoneService.handleWebhook(data),
  cleanup: () => elevenPhoneService.cleanup()
};

// Cleanup al salir
process.on('SIGINT', async () => {
  await elevenPhoneService.cleanup();
  process.exit(0);
});