// services/orchestrator/providers/twilioProvider.js
import { AudioProvider } from './audioProvider.js';
import { twilioCall, twilioClient } from '../../twilioService.js';

/**
 * Proveedor para servicios de telefonía mediante Twilio
 */
export class TwilioProvider extends AudioProvider {
  constructor(orchestrator) {
    super(orchestrator);
    this.providerType = "twilio";
    this.activeSessions = new Map(); // Mapeo de sessionId -> callSid
  }

  /**
   * Inicia una llamada a través de Twilio
   * @param {Object} params - Parámetros para la llamada
   * @param {string} params.user_name - Nombre del usuario
   * @param {string} params.to_number - Número de teléfono destino
   * @param {string} params.voice_id - ID de la voz
   * @param {string} params.voice_name - Nombre de la voz
   * @param {string} sessionId - ID de la sesión
   * @returns {Promise<Object>} Resultado de la inicialización
   * @override
   */
  async initialize(params, sessionId) {
    try {
      // Agregar sessionId a los parámetros
      const callParams = { ...params, sessionId };

      console.log("[TwilioProvider] Iniciando llamada con parámetros:", {
        ...callParams,
        sessionId
      });

      // Realizar la llamada
      const callResult = await twilioCall(callParams);

      // Registrar la sesión activa
      if (callResult.success && callResult.callSid) {
        this.activeSessions.set(sessionId, callResult.callSid);
      }

      return callResult;
    } catch (error) {
      console.error("[TwilioProvider] Error iniciando llamada:", error, { sessionId });
      throw error;
    }
  }

  /**
   * Finaliza una llamada activa
   * @param {string} sessionId - ID de la sesión
   * @returns {Promise<boolean>} true si se finalizó correctamente
   * @override
   */
  async terminate(sessionId) {
    const callSid = this.activeSessions.get(sessionId);

    if (!callSid) {
      console.log(`[TwilioProvider] No hay llamada activa para sesión ${sessionId}`, { sessionId });
      return false;
    }

    try {
      const call = await twilioClient.calls(callSid).update({ status: "completed" });
      console.log(`[TwilioProvider] Llamada ${callSid} finalizada exitosamente.`, { sessionId });

      // Eliminar de sesiones activas
      this.activeSessions.delete(sessionId);

      return true;
    } catch (error) {
      console.error(`[TwilioProvider] Error cortando la llamada ${callSid}:`, error, { sessionId });
      return false;
    }
  }

  /**
   * Procesa audio para enviar a Twilio (no aplicable directamente)
   * @param {Object} audioData - Datos de audio
   * @param {string} sessionId - ID de la sesión
   * @returns {Promise<boolean>} true si se procesó correctamente
   * @override
   */
  async processAudio(audioData, sessionId) {
    // Este método no tiene una implementación directa para Twilio,
    // ya que el audio se envía a través del WebSocket que ya está configurado
    return true;
  }

  /**
   * Envía un comando específico a Twilio
   * @param {string} command - Comando a enviar
   * @param {Object} params - Parámetros del comando
   * @param {string} sessionId - ID de la sesión
   * @returns {Promise<Object>} Resultado del comando
   * @override
   */
  async sendCommand(command, params, sessionId) {
    const callSid = this.activeSessions.get(sessionId) || params.callSid;

    if (!callSid) {
      throw new Error(`No hay callSid para la sesión ${sessionId}`);
    }

    try {
      switch (command) {
        case "end_call":
          return await this.terminate(sessionId);

        case "check_status":
          const call = await twilioClient.calls(callSid).fetch();
          return {
            success: true,
            status: call.status,
            duration: call.duration,
            callSid
          };

        default:
          throw new Error(`Comando desconocido: ${command}`);
      }
    } catch (error) {
      console.error(`[TwilioProvider] Error ejecutando comando ${command}:`, error, { sessionId });
      throw error;
    }
  }

  /**
   * Verifica si hay una llamada activa para la sesión
   * @param {string} sessionId - ID de la sesión
   * @returns {boolean} true si hay una llamada activa
   * @override
   */
  isActiveForSession(sessionId) {
    return this.activeSessions.has(sessionId);
  }

  /**
   * Obtiene información del proveedor Twilio
   * @returns {Object} Información del proveedor
   * @override
   */
  getProviderInfo() {
    return {
      type: this.providerType,
      capabilities: [
        "outbound_calls",
        "call_control",
        "audio_streaming"
      ],
      activeSessions: this.activeSessions.size
    };
  }
}