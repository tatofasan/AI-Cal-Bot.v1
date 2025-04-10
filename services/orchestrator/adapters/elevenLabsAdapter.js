// services/orchestrator/adapters/elevenLabsAdapter.js
import { BaseAdapter } from './baseAdapter.js';
import WebSocket from 'ws';
import { broadcastToSession } from '../../../utils/sessionManager.js';

/**
 * Adaptador para mensajes de ElevenLabs
 * Convierte los mensajes entre el formato de ElevenLabs y el formato estándar del orquestador
 */
export class ElevenLabsAdapter extends BaseAdapter {
  constructor(orchestrator) {
    super(orchestrator);
  }

  /**
   * Procesa un mensaje entrante de ElevenLabs
   * @param {Object} message - Mensaje de ElevenLabs
   * @param {Object} state - Estado de la sesión
   * @returns {Promise<void>}
   * @override
   */
  async processIncomingMessage(message, state) {
    const sessionId = state.sessionId;

    try {
      switch (message.type) {
        case "conversation_initiation_metadata":
          console.log("[ElevenLabsAdapter] Recibido metadata de iniciación", { sessionId });
          break;

        case "audio":
          this.handleAudioMessage(message, state);
          break;

        case "interruption":
          this.handleInterruptionMessage(message, state);
          break;

        case "ping":
          this.handlePingMessage(message, state);
          break;

        case "agent_response":
          this.handleAgentResponseMessage(message, state);
          break;

        case "user_transcript":
          this.handleUserTranscriptMessage(message, state);
          break;

        default:
          console.log(`[ElevenLabsAdapter] Tipo de mensaje no manejado: ${message.type}`, { sessionId });
      }
    } catch (error) {
      console.error("[ElevenLabsAdapter] Error procesando mensaje:", error, { sessionId });
    }
  }

  /**
   * Maneja mensajes de audio de ElevenLabs
   * @param {Object} message - Mensaje de audio
   * @param {Object} state - Estado de la sesión
   * @private
   */
  handleAudioMessage(message, state) {
    const sessionId = state.sessionId;

    // Obtener el estado más actualizado del StreamManager
    const sessionState = this.orchestrator.streamManager.getSessionState(sessionId);
    const streamSid = sessionState.streamSid || state.streamSid;

    if (!streamSid) {
      console.log("[ElevenLabsAdapter] Recibido audio pero aún no hay streamSid", { sessionId });
      return;
    }

    const payload = message.audio?.chunk || message.audio_event?.audio_base_64;
    if (!payload) {
      console.error("[ElevenLabsAdapter] Mensaje de audio sin payload", { sessionId });
      return;
    }

    console.log("[ElevenLabsAdapter] Audio chunk recibido", { sessionId });

    // Convertir a formato estándar
    const standardMessage = this.convertToStandardFormat(message, sessionId);

    // Enviar al streamManager para enrutamiento
    this.orchestrator.streamManager.routeMessage(standardMessage);
  }

  /**
   * Maneja mensajes de interrupción de ElevenLabs
   * @param {Object} message - Mensaje de interrupción
   * @param {Object} state - Estado de la sesión
   * @private
   */
  handleInterruptionMessage(message, state) {
    const sessionId = state.sessionId;

    // Obtener el estado más actualizado del StreamManager
    const sessionState = this.orchestrator.streamManager.getSessionState(sessionId);
    const streamSid = sessionState.streamSid || state.streamSid;

    console.log("[ElevenLabsAdapter] Recibido evento de interrupción", { sessionId });

    if (!streamSid) {
      console.log("[ElevenLabsAdapter] No hay streamSid para enviar interrupción", { sessionId });
      return;
    }

    // Crear mensaje estándar para limpiar buffer
    const clearMessage = {
      source: 'elevenlabs',
      target: 'twilio',
      type: 'control',
      messageType: 'call_control',
      action: 'clear_buffer',
      payload: {
        streamSid
      },
      sessionId
    };

    // Enviar al streamManager
    this.orchestrator.streamManager.routeMessage(clearMessage);
  }

  /**
   * Maneja mensajes de ping de ElevenLabs
   * @param {Object} message - Mensaje de ping
   * @param {Object} state - Estado de la sesión
   * @private
   */
  handlePingMessage(message, state) {
    const sessionId = state.sessionId;

    if (message.ping_event?.event_id) {
      // Obtener WebSocket de ElevenLabs para la sesión
      const connections = this.orchestrator.streamManager.connections.elevenlabs;
      if (!connections || !connections.has(sessionId)) {
        return;
      }

      const ws = connections.get(sessionId);
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: "pong",
          event_id: message.ping_event.event_id,
        }));
      }
    }
  }

  /**
   * Maneja mensajes de respuesta del agente de ElevenLabs
   * @param {Object} message - Mensaje de respuesta
   * @param {Object} state - Estado de la sesión
   * @private
   */
  handleAgentResponseMessage(message, state) {
    const sessionId = state.sessionId;
    const agentResponse = message.agent_response_event?.agent_response;

    if (agentResponse) {
      console.log(`[ElevenLabsAdapter] Respuesta del agente: ${agentResponse}`, { sessionId });

      // Enviar la transcripción directamente a los clientes conectados a la sesión
      broadcastToSession(sessionId, {
        type: "transcript",
        isBot: true,
        text: agentResponse
      });
    }
  }

  /**
   * Maneja mensajes de transcripción del usuario de ElevenLabs
   * @param {Object} message - Mensaje de transcripción
   * @param {Object} state - Estado de la sesión
   * @private
   */
  handleUserTranscriptMessage(message, state) {
    const sessionId = state.sessionId;
    const userTranscript = message.user_transcription_event?.user_transcript;

    if (userTranscript) {
      console.log(`[ElevenLabsAdapter] Transcripción del usuario: ${userTranscript}`, { sessionId });

      // Enviar la transcripción directamente a los clientes conectados a la sesión
      broadcastToSession(sessionId, {
        type: "transcript",
        isBot: false,
        text: userTranscript
      });
    }
  }

  /**
   * Convierte un mensaje de ElevenLabs al formato estándar interno
   * @param {Object} message - Mensaje de ElevenLabs
   * @param {string} sessionId - ID de la sesión
   * @returns {Object} Mensaje en formato estándar
   * @override
   */
  convertToStandardFormat(message, sessionId) {
    // Obtener el streamSid del estado de la sesión
    const streamSid = this.orchestrator.streamManager.getSessionState(sessionId)?.streamSid;

    // Mensajes de audio
    if (message.type === 'audio') {
      const payload = message.audio?.chunk || message.audio_event?.audio_base_64;

      return {
        source: 'elevenlabs',
        target: 'twilio',
        type: 'audio',
        messageType: 'bot_audio',
        payload,
        streamSid, // Incluir el streamSid en el mensaje estándar
        sessionId
      };
    }

    // Mensajes de interrupción
    if (message.type === 'interruption') {
      return {
        source: 'elevenlabs',
        target: 'twilio',
        type: 'control',
        messageType: 'call_control',
        action: 'clear_buffer',
        streamSid, // Incluir el streamSid en el mensaje estándar
        sessionId
      };
    }

    // Mensajes de respuesta del agente (transcripciones)
    if (message.type === 'agent_response' && message.agent_response_event?.agent_response) {
      return {
        source: 'elevenlabs',
        target: 'frontend',
        type: 'transcript',
        messageType: 'agent_response',
        payload: {
          text: message.agent_response_event.agent_response,
          isBot: true
        },
        sessionId
      };
    }

    // Mensajes de transcripción del usuario
    if (message.type === 'user_transcript' && message.user_transcription_event?.user_transcript) {
      return {
        source: 'elevenlabs',
        target: 'frontend',
        type: 'transcript',
        messageType: 'user_transcript',
        payload: {
          text: message.user_transcription_event.user_transcript,
          isBot: false
        },
        sessionId
      };
    }

    // Para otros tipos de mensajes
    return {
      source: 'elevenlabs',
      type: 'unknown',
      messageType: message.type,
      payload: message,
      sessionId
    };
  }

  /**
   * Convierte un mensaje estándar al formato de ElevenLabs
   * @param {Object} standardMessage - Mensaje en formato estándar
   * @returns {Object} Mensaje en formato de ElevenLabs
   * @override
   */
  convertFromStandardFormat(standardMessage) {
    const { type, messageType, payload, sessionId } = standardMessage;

    // Para mensajes de audio del cliente
    if (type === 'audio' && messageType === 'client_audio' && payload) {
      return {
        user_audio_chunk: payload.user_audio_chunk || payload
      };
    }

    // Para configuración inicial
    if (type === 'config' && messageType === 'initial_config') {
      return {
        type: "conversation_initiation_client_data",
        dynamic_variables: payload.dynamic_variables || {},
        conversation_config_override: payload.conversation_config_override || {}
      };
    }

    // Retornar el payload original si no hay conversión específica
    return payload;
  }

  /**
   * Procesa un mensaje que será enviado a ElevenLabs
   * @param {Object} message - Mensaje a enviar
   * @param {string} sessionId - ID de la sesión
   * @override
   */
  processOutgoingMessage(message, sessionId) {
    // Convertir al formato de ElevenLabs
    const elevenLabsMessage = this.convertFromStandardFormat({
      ...message,
      sessionId
    });

    // Obtener WebSocket de ElevenLabs para la sesión
    const connections = this.orchestrator.streamManager.connections.elevenlabs;
    if (!connections || !connections.has(sessionId)) {
      console.log(`[ElevenLabsAdapter] No hay conexión ElevenLabs para sesión ${sessionId}`, { sessionId });
      return false;
    }

    const ws = connections.get(sessionId);
    if (ws.readyState !== WebSocket.OPEN) {
      console.log(`[ElevenLabsAdapter] WebSocket de ElevenLabs no está abierto para sesión ${sessionId}`, { sessionId });
      return false;
    }

    try {
      // Enviar mensaje
      const messageStr = typeof elevenLabsMessage === 'string' ? 
        elevenLabsMessage : JSON.stringify(elevenLabsMessage);
      ws.send(messageStr);
      return true;
    } catch (error) {
      console.error("[ElevenLabsAdapter] Error enviando mensaje a ElevenLabs:", error, { sessionId });
      return false;
    }
  }

  /**
   * Envía la configuración inicial a ElevenLabs
   * @param {WebSocket} ws - WebSocket de ElevenLabs
   * @param {Object} customParameters - Parámetros personalizados
   * @param {string} sessionId - ID de la sesión
   */
  sendInitialConfig(ws, customParameters, sessionId) {
    try {
      // Extraer parámetros
      const userName = customParameters?.user_name || "Usuario";
      const voiceId = customParameters?.voice_id || "";
      const voiceName = customParameters?.voice_name || "";

      console.log("[ElevenLabsAdapter] Enviando configuración inicial", { sessionId });

      // Configuración inicial con conversation_config_override para tts
      const initialConfig = {
        type: "conversation_initiation_client_data",
        dynamic_variables: {
          user_name: userName,
          voice_name: voiceName || "",
        },
        conversation_config_override: {
          tts: {
            voice_id: voiceId || "",
          },
        },
      };

      // Enviar directamente ya que tenemos el WebSocket
      ws.send(JSON.stringify(initialConfig));
    } catch (error) {
      console.error("[ElevenLabsAdapter] Error enviando configuración inicial:", error, { sessionId });
    }
  }
}