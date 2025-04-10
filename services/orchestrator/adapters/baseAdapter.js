// services/orchestrator/adapters/baseAdapter.js

/**
 * Clase base para los adaptadores de servicios
 * Define la interfaz común que todos los adaptadores deben implementar
 */
export class BaseAdapter {
  /**
   * @param {StreamOrchestrator} orchestrator - Instancia del orquestador
   */
  constructor(orchestrator) {
    this.orchestrator = orchestrator;
  }

  /**
   * Procesa un mensaje entrante del servicio asociado
   * @param {Object} message - Mensaje recibido
   * @param {Object} state - Estado asociado
   * @param {Function} callback - Callback opcional
   */
  processIncomingMessage(message, state, callback) {
    throw new Error('Método processIncomingMessage debe ser implementado por las subclases');
  }

  /**
   * Procesa un mensaje saliente hacia el servicio asociado
   * @param {Object} message - Mensaje a enviar
   * @param {string} sessionId - ID de la sesión
   */
  processOutgoingMessage(message, sessionId) {
    throw new Error('Método processOutgoingMessage debe ser implementado por las subclases');
  }

  /**
   * Convierte un mensaje específico del servicio al formato estándar del orquestador
   * @param {Object} message - Mensaje específico del servicio
   * @param {string} sessionId - ID de la sesión
   * @returns {Object} Mensaje en formato estándar
   */
  convertToStandardFormat(message, sessionId) {
    throw new Error('Método convertToStandardFormat debe ser implementado por las subclases');
  }

  /**
   * Convierte un mensaje estándar al formato específico requerido por el servicio
   * @param {Object} standardMessage - Mensaje en formato estándar
   * @returns {Object} Mensaje en formato específico del servicio
   */
  convertFromStandardFormat(standardMessage) {
    throw new Error('Método convertFromStandardFormat debe ser implementado por las subclases');
  }
}