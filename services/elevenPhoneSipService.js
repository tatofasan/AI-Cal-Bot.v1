// services/elevenPhoneSipService.js - Servicio para llamadas SIP con ElevenLabs
import { ElevenLabsClient } from "elevenlabs";
import { elevenLabsConfig, sipConfig } from './config/appConfig.js';
import unifiedSessionService from './unifiedSessionService.js';

// Cliente de ElevenLabs
const client = new ElevenLabsClient({
  apiKey: elevenLabsConfig.apiKey
});

/**
 * Servicio para manejar llamadas telefónicas con SIP trunk via WebSocket
 */
class ElevenPhoneSipService {
  constructor() {
    this.activeConnections = new Map();
  }

  /**
   * Iniciar una llamada telefónica usando SIP trunk oficial
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
      console.log('[ElevenPhoneSIP] Iniciando llamada via SIP trunk oficial:', {
        sessionId,
        phoneNumber,
        userName,
        sipTrunk: sipConfig.trunkAddress
      });

      // Actualizar estado inicial en unifiedSessionService
      unifiedSessionService.updateCallInfo(sessionId, {
        status: 'initiating',
        phoneNumber: phoneNumber || sipConfig.defaultToNumber,
        userName,
        voiceId,
        voiceName,
        usingSipTrunk: true,
        sipTrunkAddress: sipConfig.trunkAddress,
        callerNumber: '+541162662863',
        isPhoneAPI: true,
        isRealCall: true
      });

      // Broadcast estado inicial
      unifiedSessionService.broadcastToSession(sessionId, {
        type: 'call_status',
        status: 'initiating',
        message: 'Iniciando llamada via SIP trunk...',
        sessionId,
        timestamp: Date.now()
      });

      // Usar el método oficial del SDK para llamadas SIP salientes
      const result = await client.conversationalAi.sipTrunk.outboundCall({
        agent_id: elevenLabsConfig.agentId,
        agent_phone_number_id: elevenLabsConfig.sipPhoneNumberId,
        to_number: phoneNumber || sipConfig.defaultToNumber
      });

      console.log('[ElevenPhoneSIP] ✅ Llamada iniciada exitosamente:', result);

      // Actualizar con información de la llamada exitosa
      unifiedSessionService.updateCallInfo(sessionId, {
        phoneCallId: result.sip_call_id,
        conversationId: result.conversation_id,
        status: 'connecting',
        startTime: Date.now()
      });

      // Broadcast estado de conexión
      unifiedSessionService.broadcastToSession(sessionId, {
        type: 'call_status',
        status: 'connecting',
        message: 'Llamada conectando...',
        phoneCallId: result.sip_call_id,
        conversationId: result.conversation_id,
        sessionId,
        timestamp: Date.now()
      });

      // Guardar información de la llamada activa
      this.activeConnections.set(sessionId, {
        sessionId,
        phoneNumber: phoneNumber || sipConfig.defaultToNumber,
        userName,
        startTime: Date.now(),
        status: 'connecting',
        conversationId: result.conversation_id,
        sipCallId: result.sip_call_id,
        phoneCallId: result.sip_call_id // Para compatibilidad
      });

      // Simular progreso de llamada (ya que no tenemos webhooks en tiempo real)
      setTimeout(() => {
        this.simulateCallProgress(sessionId);
      }, 2000);

      // Retornar información de la llamada
      return {
        success: true,
        sessionId,
        phoneCallId: result.sip_call_id,
        conversationId: result.conversation_id,
        message: 'Llamada iniciada via SIP trunk oficial',
        phoneNumber: phoneNumber || sipConfig.defaultToNumber
      };

    } catch (error) {
      console.error('[ElevenPhoneSIP] Error iniciando llamada:', error);
      
      // Actualizar estado de error
      unifiedSessionService.updateCallInfo(sessionId, {
        status: 'failed',
        errorMessage: error.message
      });

      // Broadcast estado de error
      unifiedSessionService.broadcastToSession(sessionId, {
        type: 'call_status',
        status: 'failed',
        message: `Error: ${error.message}`,
        sessionId,
        timestamp: Date.now()
      });

      throw error;
    }
  }

  /**
   * Simular progreso de llamada para feedback visual
   * @param {string} sessionId - ID de la sesión
   */
  simulateCallProgress(sessionId) {
    const connection = this.activeConnections.get(sessionId);
    if (!connection) return;

    // Simular "ringing"
    unifiedSessionService.updateCallInfo(sessionId, {
      status: 'ringing'
    });

    unifiedSessionService.broadcastToSession(sessionId, {
      type: 'call_status',
      status: 'ringing',
      message: 'Teléfono sonando...',
      sessionId,
      timestamp: Date.now()
    });

    // Después de 3-5 segundos, simular "active"
    setTimeout(() => {
      const stillActive = this.activeConnections.get(sessionId);
      if (stillActive && stillActive.status !== 'ended') {
        unifiedSessionService.updateCallInfo(sessionId, {
          status: 'active'
        });

        unifiedSessionService.broadcastToSession(sessionId, {
          type: 'call_status',
          status: 'active',
          message: 'Llamada activa - Conversación en progreso',
          sessionId,
          timestamp: Date.now()
        });

        // Actualizar estado interno
        stillActive.status = 'active';
      }
    }, 4000);
  }

  /**
   * Finalizar una llamada activa
   * @param {string} sessionId - ID de la sesión
   * @returns {Object} Resultado
   */
  async endPhoneCall(sessionId) {
    try {
      const connection = this.activeConnections.get(sessionId);
      
      if (!connection) {
        throw new Error('Conexión no encontrada');
      }

      console.log('[ElevenPhoneSIP] Finalizando llamada:', sessionId);

      // Actualizar estado en unifiedSessionService
      unifiedSessionService.updateCallInfo(sessionId, {
        status: 'ending'
      });

      // Broadcast estado de finalización
      unifiedSessionService.broadcastToSession(sessionId, {
        type: 'call_status',
        status: 'ending',
        message: 'Finalizando llamada...',
        sessionId,
        timestamp: Date.now()
      });

      try {
        // Intentar finalizar via API REST si es posible
        const response = await fetch(`https://api.elevenlabs.io/v1/convai/conversations/${connection.conversationId}/end`, {
          method: 'POST',
          headers: {
            'xi-api-key': elevenLabsConfig.apiKey,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          console.warn('[ElevenPhoneSIP] No se pudo finalizar llamada por API:', await response.text());
        }
      } catch (apiError) {
        console.warn('[ElevenPhoneSIP] Error llamando API de finalización:', apiError.message);
      }

      // Cerrar conexión local
      this.closeConnection(sessionId);

      // Finalizar en unifiedSessionService
      unifiedSessionService.endCall(sessionId, {
        reason: 'manual',
        phoneCallId: connection.phoneCallId
      });

      // Broadcast estado final
      unifiedSessionService.broadcastToSession(sessionId, {
        type: 'call_status',
        status: 'ended',
        message: 'Llamada finalizada',
        sessionId,
        timestamp: Date.now()
      });

      return {
        success: true,
        message: 'Llamada finalizada'
      };

    } catch (error) {
      console.error('[ElevenPhoneSIP] Error finalizando llamada:', error);
      
      // Broadcast error
      unifiedSessionService.broadcastToSession(sessionId, {
        type: 'call_status',
        status: 'error',
        message: `Error finalizando llamada: ${error.message}`,
        sessionId,
        timestamp: Date.now()
      });

      throw error;
    }
  }

  /**
   * Cerrar conexión WebSocket
   * @param {string} sessionId 
   */
  closeConnection(sessionId) {
    const connection = this.activeConnections.get(sessionId);
    if (connection && connection.ws) {
      connection.ws.close();
    }
    this.activeConnections.delete(sessionId);
  }

  /**
   * Obtener estado de una llamada
   * @param {string} sessionId - ID de la sesión
   * @returns {Object} Estado de la llamada
   */
  getCallStatus(sessionId) {
    const connection = this.activeConnections.get(sessionId);
    const sessionData = unifiedSessionService.getSession(sessionId);
    
    if (!connection && !sessionData) {
      return null;
    }

    // Combinar información de ambas fuentes
    const callInfo = sessionData?.call || {};
    const connectionInfo = connection || {};

    return {
      sessionId,
      phoneNumber: callInfo.phoneNumber || connectionInfo.phoneNumber,
      userName: callInfo.userName || connectionInfo.userName,
      status: callInfo.status || connectionInfo.status,
      phoneCallId: callInfo.phoneCallId || connectionInfo.phoneCallId,
      conversationId: callInfo.conversationId || connectionInfo.conversationId,
      startTime: callInfo.startTime || connectionInfo.startTime,
      duration: callInfo.startTime ? Date.now() - callInfo.startTime : 0,
      usingSipTrunk: callInfo.usingSipTrunk || true,
      sipTrunkAddress: callInfo.sipTrunkAddress,
      callerNumber: callInfo.callerNumber,
      isActive: ['active', 'ringing', 'connecting'].includes(callInfo.status)
    };
  }

  /**
   * Obtener configuración SIP actual
   * @returns {Object} Configuración SIP
   */
  getSipConfiguration() {
    return {
      trunkAddress: sipConfig.trunkAddress,
      callerNumber: '+541162662863',
      phoneNumberId: elevenLabsConfig.sipPhoneNumberId,
      defaultToNumber: sipConfig.defaultToNumber,
      isConfigured: !!(sipConfig.trunkAddress && elevenLabsConfig.sipPhoneNumberId)
    };
  }

  /**
   * Limpiar todas las conexiones activas
   */
  async cleanup() {
    console.log('[ElevenPhoneSIP] Limpiando conexiones activas...');
    
    for (const [sessionId] of this.activeConnections.entries()) {
      try {
        await this.endPhoneCall(sessionId);
      } catch (error) {
        console.error('[ElevenPhoneSIP] Error limpiando conexión:', error);
      }
    }
    
    this.activeConnections.clear();
  }
}

// Crear instancia única
const elevenPhoneSipService = new ElevenPhoneSipService();

// Exportar
export default elevenPhoneSipService;

// También exportar funciones individuales para compatibilidad
export const {
  initiatePhoneCall,
  endPhoneCall,
  getCallStatus,
  getSipConfiguration,
  cleanup
} = {
  initiatePhoneCall: (data) => elevenPhoneSipService.initiatePhoneCall(data),
  endPhoneCall: (sessionId) => elevenPhoneSipService.endPhoneCall(sessionId),
  getCallStatus: (sessionId) => elevenPhoneSipService.getCallStatus(sessionId),
  getSipConfiguration: () => elevenPhoneSipService.getSipConfiguration(),
  cleanup: () => elevenPhoneSipService.cleanup()
};

// Cleanup al salir
process.on('SIGINT', async () => {
  await elevenPhoneSipService.cleanup();
  process.exit(0);
});