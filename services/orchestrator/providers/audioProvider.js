// services/orchestrator/providers/audioProvider.js

/**
 * Clase base para proveedores de servicios de audio
 * Define la interfaz común que todos los proveedores deben implementar
 */
export class AudioProvider {
  /**
   * @param {StreamOrchestrator} orchestrator - Instancia del orquestador
   */
  constructor(orchestrator) {
    this.orchestrator = orchestrator;
    this.providerType = "base"; // Debe ser sobrescrito por las clases hijas
  }

  /**
   * Inicializa una conexión para el proveedor
   * @param {Object} params - Parámetros para la inicialización
   * @param {string} sessionId - ID de la sesión
   * @returns {Promise<Object>} Resultado de la inicialización
   */
  async initialize(params, sessionId) {
    throw new Error('Método initialize debe ser implementado por las subclases');
  }

  /**
   * Finaliza una conexión del proveedor
   * @param {string} sessionId - ID de la sesión
   * @returns {Promise<boolean>} true si se finalizó correctamente
   */
  async terminate(sessionId) {
    throw new Error('Método terminate debe ser implementado por las subclases');
  }

  /**
   * Procesa audio de entrada (del cliente)
   * @param {Object} audioData - Datos de audio
   * @param {string} sessionId - ID de la sesión
   * @returns {Promise<boolean>} true si se procesó correctamente
   */
  async processAudio(audioData, sessionId) {
    throw new Error('Método processAudio debe ser implementado por las subclases');
  }

  /**
   * Envía un comando al proveedor
   * @param {string} command - Comando a enviar
   * @param {Object} params - Parámetros del comando
   * @param {string} sessionId - ID de la sesión
   * @returns {Promise<Object>} Resultado del comando
   */
  async sendCommand(command, params, sessionId) {
    throw new Error('Método sendCommand debe ser implementado por las subclases');
  }

  /**
   * Verifica si el proveedor está activo para una sesión
   * @param {string} sessionId - ID de la sesión
   * @returns {boolean} true si está activo
   */
  isActiveForSession(sessionId) {
    throw new Error('Método isActiveForSession debe ser implementado por las subclases');
  }

  /**
   * Obtiene información sobre el proveedor
   * @returns {Object} Información del proveedor
   */
  getProviderInfo() {
    return {
      type: this.providerType,
      capabilities: []
    };
  }
}