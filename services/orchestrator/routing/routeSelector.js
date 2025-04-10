// services/orchestrator/routing/routeSelector.js

/**
 * Selector de rutas que determina el destino apropiado para cada mensaje
 * basándose en las rutas registradas y reglas de enrutamiento
 */
export class RouteSelector {
  /**
   * @param {RouteRegistry} routeRegistry - Registro de rutas disponibles
   */
  constructor(routeRegistry) {
    this.routeRegistry = routeRegistry;

    // Mapeo de último proveedor seleccionado por sesión
    // Formato: { sessionId: { messageType: { source: target } } }
    this.lastSelectedRoute = new Map();

    // Rutas activas por sesión (para cambios temporales)
    // Formato: { sessionId: { source: { messageType: target } } }
    this.sessionRoutes = new Map();
  }

  /**
   * Selecciona el destino para un mensaje específico
   * @param {Object} message - Mensaje a enrutar
   * @returns {string|null} Destino seleccionado o null si no hay ruta disponible
   */
  selectTarget(message) {
    const { source, type, messageType, sessionId } = message;

    if (!source || !messageType || !sessionId) {
      console.error("[RouteSelector] Mensaje sin información suficiente para enrutamiento");
      return null;
    }

    // 1. Verificar si hay una ruta específica para esta sesión
    const sessionTarget = this._getSessionTarget(sessionId, source, messageType);
    if (sessionTarget) {
      return sessionTarget;
    }

    // 2. Buscar rutas que coincidan con source y messageType
    const matchingRoutes = this.routeRegistry.findRoutes(
      { source, messageType },
      message
    );

    if (matchingRoutes.length === 0) {
      console.log(`[RouteSelector] No se encontraron rutas para ${source}:${messageType}`, 
                  { sessionId });
      return null;
    }

    // 3. Seleccionar la ruta con mayor prioridad (ya vienen ordenadas)
    const selectedRoute = matchingRoutes[0];

    // 4. Registrar la ruta seleccionada para esta sesión
    this._updateLastSelectedRoute(sessionId, source, messageType, selectedRoute.target);

    return selectedRoute.target;
  }

  /**
   * Actualiza temporalmente la ruta para una sesión específica
   * @param {string} sessionId - ID de la sesión
   * @param {string} source - Origen del mensaje
   * @param {string} messageType - Tipo de mensaje
   * @param {string} target - Nuevo destino
   */
  setSessionRoute(sessionId, source, messageType, target) {
    if (!this.sessionRoutes.has(sessionId)) {
      this.sessionRoutes.set(sessionId, {});
    }

    const sessionMap = this.sessionRoutes.get(sessionId);

    if (!sessionMap[source]) {
      sessionMap[source] = {};
    }

    sessionMap[source][messageType] = target;

    console.log(`[RouteSelector] Ruta de sesión actualizada: ${sessionId} ${source}:${messageType} -> ${target}`);
  }

  /**
   * Elimina una ruta específica para una sesión
   * @param {string} sessionId - ID de la sesión
   * @param {string} source - Origen del mensaje
   * @param {string} messageType - Tipo de mensaje
   * @returns {boolean} true si se eliminó correctamente
   */
  clearSessionRoute(sessionId, source, messageType) {
    if (!this.sessionRoutes.has(sessionId)) {
      return false;
    }

    const sessionMap = this.sessionRoutes.get(sessionId);
    if (!sessionMap[source] || !sessionMap[source][messageType]) {
      return false;
    }

    delete sessionMap[source][messageType];

    // Limpiar objetos vacíos
    if (Object.keys(sessionMap[source]).length === 0) {
      delete sessionMap[source];
    }

    if (Object.keys(sessionMap).length === 0) {
      this.sessionRoutes.delete(sessionId);
    }

    console.log(`[RouteSelector] Ruta de sesión eliminada: ${sessionId} ${source}:${messageType}`);
    return true;
  }

  /**
   * Elimina todas las rutas específicas para una sesión
   * @param {string} sessionId - ID de la sesión
   */
  clearAllSessionRoutes(sessionId) {
    this.sessionRoutes.delete(sessionId);
    console.log(`[RouteSelector] Todas las rutas de sesión eliminadas para: ${sessionId}`);
  }

  /**
   * Actualiza la ruta global para un tipo de mensaje
   * @param {string} source - Origen del mensaje
   * @param {string} messageType - Tipo de mensaje
   * @param {string} newTarget - Nuevo destino
   */
  updateRoute(source, messageType, newTarget) {
    // Buscar rutas existentes
    const matchingRoutes = this.routeRegistry.findRoutes({ source, messageType });

    if (matchingRoutes.length > 0) {
      // Actualizar la ruta con mayor prioridad
      this.routeRegistry.updateRoute(matchingRoutes[0].id, { target: newTarget });
    } else {
      // Crear una nueva ruta
      this.routeRegistry.register({
        source,
        target: newTarget,
        messageType,
        priority: 20, // Mayor prioridad que las rutas predeterminadas
        id: `dynamic_${source}_${messageType}_${Date.now()}`
      });
    }

    console.log(`[RouteSelector] Ruta global actualizada: ${source}:${messageType} -> ${newTarget}`);
  }

  /**
   * Obtiene el destino específico para una sesión si existe
   * @param {string} sessionId - ID de la sesión
   * @param {string} source - Origen del mensaje
   * @param {string} messageType - Tipo de mensaje
   * @returns {string|null} Destino o null si no hay ruta específica
   * @private
   */
  _getSessionTarget(sessionId, source, messageType) {
    if (!this.sessionRoutes.has(sessionId)) {
      return null;
    }

    const sessionMap = this.sessionRoutes.get(sessionId);
    if (!sessionMap[source] || !sessionMap[source][messageType]) {
      return null;
    }

    return sessionMap[source][messageType];
  }

  /**
   * Actualiza el registro de la última ruta seleccionada
   * @param {string} sessionId - ID de la sesión
   * @param {string} source - Origen del mensaje
   * @param {string} messageType - Tipo de mensaje
   * @param {string} target - Destino seleccionado
   * @private
   */
  _updateLastSelectedRoute(sessionId, source, messageType, target) {
    if (!this.lastSelectedRoute.has(sessionId)) {
      this.lastSelectedRoute.set(sessionId, {});
    }

    const sessionMap = this.lastSelectedRoute.get(sessionId);

    if (!sessionMap[messageType]) {
      sessionMap[messageType] = {};
    }

    sessionMap[messageType][source] = target;
  }

  /**
   * Obtiene el último destino seleccionado para una combinación específica
   * @param {string} sessionId - ID de la sesión
   * @param {string} source - Origen del mensaje
   * @param {string} messageType - Tipo de mensaje
   * @returns {string|null} Último destino seleccionado o null
   */
  getLastSelectedTarget(sessionId, source, messageType) {
    if (!this.lastSelectedRoute.has(sessionId)) {
      return null;
    }

    const sessionMap = this.lastSelectedRoute.get(sessionId);
    if (!sessionMap[messageType] || !sessionMap[messageType][source]) {
      return null;
    }

    return sessionMap[messageType][source];
  }
}