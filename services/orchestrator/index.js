// services/orchestrator/index.js
import { StreamManager } from './streamManager.js';
import { TwilioAdapter } from './adapters/twilioAdapter.js';
import { ElevenLabsAdapter } from './adapters/elevenLabsAdapter.js';
import { RouteRegistry } from './routing/routeRegistry.js';
import { RouteSelector } from './routing/routeSelector.js';
import { TwilioProvider } from './providers/twilioProvider.js';
import { ElevenLabsProvider } from './providers/elevenLabsProvider.js';

// Singleton para mantener una única instancia del orquestador
let instance = null;

/**
 * Clase principal del orquestador que coordina todos los componentes
 */
class StreamOrchestrator {
  constructor() {
    if (instance) {
      return instance;
    }

    // Inicializar componentes
    this.streamManager = new StreamManager();
    this.routeRegistry = new RouteRegistry();
    this.routeSelector = new RouteSelector(this.routeRegistry);

    // Crear adaptadores
    this.twilioAdapter = new TwilioAdapter(this);
    this.elevenLabsAdapter = new ElevenLabsAdapter(this);

    // Crear proveedores
    this.twilioProvider = new TwilioProvider(this);
    this.elevenLabsProvider = new ElevenLabsProvider(this);

    // Registrar rutas predeterminadas
    this._registerDefaultRoutes();

    instance = this;
  }

  /**
   * Registra las rutas predeterminadas entre servicios
   * @private
   */
  _registerDefaultRoutes() {
    // Ruta de Twilio a ElevenLabs (audio del cliente)
    this.routeRegistry.register({
      source: 'twilio',
      target: 'elevenlabs',
      messageType: 'audio',
      priority: 10
    });

    // Ruta de ElevenLabs a Twilio (respuestas de voz)
    this.routeRegistry.register({
      source: 'elevenlabs',
      target: 'twilio',
      messageType: 'audio',
      priority: 10
    });

    // Rutas para transcripciones
    this.routeRegistry.register({
      source: 'elevenlabs',
      target: 'frontend',
      messageType: 'transcript',
      priority: 10
    });

    // Rutas para control de llamadas
    this.routeRegistry.register({
      source: 'frontend',
      target: 'twilio',
      messageType: 'call_control',
      priority: 10
    });

    this.routeRegistry.register({
      source: 'elevenlabs',
      target: 'twilio',
      messageType: 'call_control',
      priority: 10
    });
  }

  /**
   * Punto de entrada para mensajes de Twilio
   * @param {Object} message - Mensaje recibido de Twilio
   * @param {Object} state - Estado de la llamada/sesión
   * @param {Function} callback - Callback opcional para procesar después del enrutamiento
   */
  handleTwilioMessage(message, state, callback) {
    return this.twilioAdapter.processIncomingMessage(message, state, callback);
  }

  /**
   * Punto de entrada para mensajes de ElevenLabs
   * @param {Object} message - Mensaje recibido de ElevenLabs
   * @param {Object} state - Estado de la llamada/sesión
   */
  handleElevenLabsMessage(message, state) {
    return this.elevenLabsAdapter.processIncomingMessage(message, state);
  }

  /**
   * Punto de entrada para comandos del frontend
   * @param {string} command - Comando a ejecutar
   * @param {Object} params - Parámetros del comando
   * @param {string} sessionId - ID de la sesión
   */
  handleFrontendCommand(command, params, sessionId) {
    // Crear un mensaje estructurado para el frontend
    const message = {
      command,
      params,
      sessionId
    };

    // Procesar a través del streamManager
    this.streamManager.routeMessage({
      source: 'frontend',
      type: 'command',
      messageType: command.includes('call') ? 'call_control' : 'command',
      payload: message,
      sessionId
    });
  }

  /**
   * Registra una WebSocket de Twilio en el orquestador
   * @param {WebSocket} ws - WebSocket de Twilio
   * @param {string} sessionId - ID de la sesión
   * @param {Object} state - Estado de la llamada
   */
  registerTwilioWebSocket(ws, sessionId, state) {
    // Verificar si hay un streamSid en el estado para registrarlo en el StreamManager
    if (state && state.streamSid) {
      // Asegurarnos de que el estado incluya el streamSid
      this.streamManager.updateSessionState(sessionId, {
        streamSid: state.streamSid,
        callSid: state.callSid
      });
    }

    this.streamManager.registerConnection('twilio', ws, sessionId, state);

    // Verificar que todo esté correctamente registrado
    this.streamManager.checkConnections(sessionId);
  }

  /**
   * Registra una WebSocket de ElevenLabs en el orquestador
   * @param {WebSocket} ws - WebSocket de ElevenLabs
   * @param {string} sessionId - ID de la sesión
   * @param {Object} state - Estado de la llamada
   */
  registerElevenLabsWebSocket(ws, sessionId, state) {
    this.streamManager.registerConnection('elevenlabs', ws, sessionId, state);

    // Verificar que todo esté correctamente registrado
    this.streamManager.checkConnections(sessionId);
  }

  /**
   * Cambia dinámicamente la ruta para un tipo de mensaje
   * @param {string} sourceType - Tipo de origen ('twilio', 'elevenlabs', 'frontend')
   * @param {string} messageType - Tipo de mensaje ('audio', 'transcript', 'call_control')
   * @param {string} newTarget - Nuevo destino del mensaje
   */
  changeRoute(sourceType, messageType, newTarget) {
    this.routeSelector.updateRoute(sourceType, messageType, newTarget);
  }

  /**
   * Registra un nuevo proveedor de servicios
   * @param {string} providerType - Tipo de proveedor (ej: 'watson')
   * @param {Object} providerInstance - Instancia del proveedor
   */
  registerProvider(providerType, providerInstance) {
    this.streamManager.registerProvider(providerType, providerInstance);
  }
}

// Exportar una instancia única del orquestador
export const orchestrator = new StreamOrchestrator();