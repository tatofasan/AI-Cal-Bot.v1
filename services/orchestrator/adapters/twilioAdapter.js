// services/orchestrator/adapters/twilioAdapter.js
import { BaseAdapter } from './baseAdapter.js';
import WebSocket from 'ws';
import { broadcastToSession } from '../../../utils/sessionManager.js';

/**
 * Adaptador para mensajes de Twilio
 * Convierte los mensajes entre el formato de Twilio y el formato estándar del orquestador
 */
export class TwilioAdapter extends BaseAdapter {
  constructor(orchestrator) {
    super(orchestrator);
  }

  /**
   * Procesa un mensaje entrante de Twilio
   * @param {Object} message - Mensaje de Twilio
   * @param {Object} state - Estado de la sesión
   * @param {Function} callback - Callback a ejecutar (para iniciar ElevenLabs)
   * @returns {Promise<void>}
   */
  async processIncomingMessage(message, state, callback) {
    const sessionId = state.sessionId;

    try {
      switch (message.event) {
        case "start":
          await this.handleStartEvent(message, state, callback);
          break;

        case "media":
          this.handleMediaEvent(message, state);
          break;

        case "stop":
          this.handleStopEvent(message, state);
          break;

        default:
          console.log(`[TwilioAdapter] Evento no manejado: ${message.event}`, { sessionId });
          break;
      }
    } catch (error) {
      console.error("[TwilioAdapter] Error procesando mensaje:", error, { sessionId });
    }
  }

  /**
   * Maneja el evento 'start' de Twilio
   * @param {Object} message - Mensaje de Twilio
   * @param {Object} state - Estado de la sesión
   * @param {Function} callback - Callback a ejecutar
   * @private
   */
  async handleStartEvent(message, state, callback) {
    const sessionId = state.sessionId;

    // Actualizar el estado con información de la llamada
    state.streamSid = message.start.streamSid;
    state.callSid = message.start.callSid;

    // Actualizar también el estado en el StreamManager
    this.orchestrator.streamManager.updateSessionState(sessionId, {
      streamSid: state.streamSid,
      callSid: state.callSid
    });

    // Extraer parámetros personalizados
    if (message.start.customParameters) {
      state.customParameters = message.start.customParameters;
      console.log("[TwilioAdapter] Parámetros personalizados recibidos", { sessionId });

      // Actualizar sessionId si viene en los parámetros personalizados
      if (message.start.customParameters.sessionId && 
          message.start.customParameters.sessionId !== sessionId) {
        const newSessionId = message.start.customParameters.sessionId;
        console.log(`[TwilioAdapter] Actualizando sessionId de ${sessionId} a ${newSessionId}`);
        state.sessionId = newSessionId;

        // También actualizar en el StreamManager
        this.orchestrator.streamManager.updateSessionState(newSessionId, {
          streamSid: state.streamSid,
          callSid: state.callSid,
          customParameters: state.customParameters
        });
      }
    }

    console.log(`[TwilioAdapter] Stream iniciado - StreamSid: ${state.streamSid}`, { sessionId });

    // Ejecutar callback (ej: para iniciar ElevenLabs)
    if (callback) {
      await callback();
    }
  }

  /**
   * Maneja el evento 'media' de Twilio
   * @param {Object} message - Mensaje de Twilio
   * @param {Object} state - Estado de la sesión
   * @private
   */
  handleMediaEvent(message, state) {
    const sessionId = state.sessionId;

    if (!message.media || !message.media.payload) {
      console.error("[TwilioAdapter] Mensaje de media sin payload", { sessionId });
      return;
    }

    // También enviar el audio al frontend para monitoreo
    broadcastToSession(sessionId, {
      type: "client_audio",
      payload: message.media.payload
    });

    // Preparar mensaje estándar para el orquestador
    const standardMessage = this.convertToStandardFormat(message, sessionId);

    // Enviar al streamManager para enrutamiento
    this.orchestrator.streamManager.routeMessage(standardMessage);
  }

  /**
   * Maneja el evento 'stop' de Twilio
   * @param {Object} message - Mensaje de Twilio
   * @param {Object} state - Estado de la sesión
   * @private
   */
  handleStopEvent(message, state) {
    const sessionId = state.sessionId;
    console.log(`[TwilioAdapter] Stream ${state.streamSid} finalizado`, { sessionId });

    // Crear mensaje de control para cerrar conexiones asociadas
    const controlMessage = {
      source: 'twilio',
      type: 'control',
      messageType: 'call_control',
      action: 'end_call',
      payload: {
        callSid: state.callSid
      },
      sessionId
    };

    // Enviar mensaje al orquestador
    this.orchestrator.streamManager.routeMessage(controlMessage);
  }

  /**
   * Convierte un mensaje de Twilio al formato estándar interno
   * @param {Object} message - Mensaje de Twilio
   * @param {string} sessionId - ID de la sesión
   * @returns {Object} Mensaje en formato estándar
   * @override
   */
  convertToStandardFormat(message, sessionId) {
    if (message.event === 'media' && message.media) {
      return {
        source: 'twilio',
        target: 'elevenlabs',  // Destino por defecto para audio del cliente
        type: 'audio',
        messageType: 'client_audio',
        payload: {
          user_audio_chunk: Buffer.from(message.media.payload, 'base64').toString('base64')
        },
        originalPayload: message.media.payload,
        sessionId
      };
    } 
    else if (message.event === 'start') {
      return {
        source: 'twilio',
        type: 'control',
        messageType: 'call_control',
        action: 'start_call',
        payload: {
          streamSid: message.start.streamSid,
          callSid: message.start.callSid,
          customParameters: message.start.customParameters
        },
        sessionId
      };
    }
    else if (message.event === 'stop') {
      return {
        source: 'twilio',
        type: 'control',
        messageType: 'call_control',
        action: 'end_call',
        payload: {
          streamSid: message.streamSid
        },
        sessionId
      };
    }

    // Para otros tipos de mensajes
    return {
      source: 'twilio',
      type: 'unknown',
      messageType: message.event,
      payload: message,
      sessionId
    };
  }

  /**
   * Convierte un mensaje estándar al formato de Twilio
   * @param {Object} standardMessage - Mensaje en formato estándar
   * @returns {Object} Mensaje en formato de Twilio
   * @override
   */
  convertFromStandardFormat(standardMessage) {
    const { type, messageType, payload, sessionId } = standardMessage;

    // Para mensajes de audio (de elevenlabs a twilio)
    if (type === 'audio' && payload) {
      // Obtener el streamSid del estado de la sesión
      const streamSid = this.orchestrator.streamManager.getSessionState(sessionId)?.streamSid;

      if (!streamSid) {
        console.error(`[TwilioAdapter] No hay streamSid para la sesión ${sessionId}`, { sessionId });
        return null;
      }

      return {
        event: 'media',
        streamSid: streamSid,
        media: {
          payload: payload.audio_chunk || payload.chunk || payload
        }
      };
    }

    // Para mensajes de control (ej: finalizar llamada)
    if (type === 'control' && messageType === 'call_control') {
      if (standardMessage.action === 'clear_buffer') {
        const streamSid = this.orchestrator.streamManager.getSessionState(sessionId)?.streamSid;

        if (!streamSid) {
          console.error(`[TwilioAdapter] No hay streamSid para limpiar buffer en sesión ${sessionId}`, { sessionId });
          return null;
        }

        return {
          event: 'clear',
          streamSid: streamSid
        };
      }
    }

    // Retornar el payload original si no hay conversión específica
    return payload;
  }

  /**
   * Procesa un mensaje que será enviado a Twilio
   * @param {Object} message - Mensaje a enviar
   * @param {string} sessionId - ID de la sesión
   * @override
   */
  processOutgoingMessage(message, sessionId) {
    // Convertir al formato de Twilio
    const twilioMessage = this.convertFromStandardFormat({
      ...message,
      sessionId
    });

    // Si no se pudo convertir, cancelar
    if (twilioMessage === null) {
      return false;
    }

    // Obtener WebSocket de Twilio para la sesión
    const connections = this.orchestrator.streamManager.connections.twilio;
    if (!connections || !connections.has(sessionId)) {
      console.log(`[TwilioAdapter] No hay conexión Twilio para sesión ${sessionId}`, { sessionId });
      return false;
    }

    const ws = connections.get(sessionId);
    if (ws.readyState !== WebSocket.OPEN) {
      console.log(`[TwilioAdapter] WebSocket de Twilio no está abierto para sesión ${sessionId}`, { sessionId });
      return false;
    }

    try {
      // Enviar mensaje
      const messageStr = typeof twilioMessage === 'string' ? 
        twilioMessage : JSON.stringify(twilioMessage);
      ws.send(messageStr);
      return true;
    } catch (error) {
      console.error("[TwilioAdapter] Error enviando mensaje a Twilio:", error, { sessionId });
      return false;
    }
  }
}