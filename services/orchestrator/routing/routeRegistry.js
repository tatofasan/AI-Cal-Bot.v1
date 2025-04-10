// services/orchestrator/routing/routeRegistry.js

/**
 * Registro de rutas disponibles para el enrutamiento de mensajes
 * Gestiona las conexiones entre diferentes servicios y permite
 * cambiarlas dinámicamente
 */
export class RouteRegistry {
  constructor() {
    // Almacena las rutas registradas
    this.routes = [];
  }

  /**
   * Registra una nueva ruta entre servicios
   * @param {Object} route - Configuración de la ruta
   * @param {string} route.source - Origen del mensaje ('twilio', 'elevenlabs', etc.)
   * @param {string} route.target - Destino del mensaje
   * @param {string} route.messageType - Tipo de mensaje para esta ruta
   * @param {number} route.priority - Prioridad de la ruta (mayor número = mayor prioridad)
   * @param {Function} route.filter - Función opcional para filtrado adicional
   * @param {string} route.id - Identificador opcional para la ruta
   * @returns {Object} La ruta registrada
   */
  register(route) {
    // Generar ID si no se proporciona
    const routeId = route.id || `route_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

    // Asignar prioridad predeterminada si no se proporciona
    const priority = route.priority || 5;

    // Crear la ruta completa
    const fullRoute = {
      ...route,
      id: routeId,
      priority,
      active: true,
      createdAt: Date.now()
    };

    // Añadir la ruta
    this.routes.push(fullRoute);

    // Ordenar rutas por prioridad (mayor a menor)
    this.routes.sort((a, b) => b.priority - a.priority);

    console.log(`[RouteRegistry] Ruta registrada: ${route.source} -> ${route.target} para mensajes tipo: ${route.messageType}`);

    return fullRoute;
  }

  /**
   * Busca rutas que coincidan con los criterios especificados
   * @param {Object} criteria - Criterios de búsqueda
   * @param {string} criteria.source - Origen del mensaje
   * @param {string} criteria.messageType - Tipo de mensaje
   * @param {Object} message - Mensaje completo para filtrado avanzado
   * @returns {Array} Lista de rutas que coinciden con los criterios
   */
  findRoutes(criteria, message = {}) {
    return this.routes.filter(route => {
      // Solo considerar rutas activas
      if (!route.active) return false;

      // Verificar coincidencia básica
      const sourceMatch = route.source === criteria.source;
      const typeMatch = route.messageType === criteria.messageType || route.messageType === '*';

      // Si no hay coincidencia básica, descartar
      if (!sourceMatch || !typeMatch) return false;

      // Si hay función de filtro, aplicarla
      if (typeof route.filter === 'function') {
        return route.filter(message);
      }

      return true;
    });
  }

  /**
   * Actualiza una ruta existente
   * @param {string} routeId - ID de la ruta a actualizar
   * @param {Object} updates - Actualizaciones a aplicar
   * @returns {Object|null} La ruta actualizada o null si no se encontró
   */
  updateRoute(routeId, updates) {
    const routeIndex = this.routes.findIndex(r => r.id === routeId);

    if (routeIndex === -1) {
      console.log(`[RouteRegistry] Ruta no encontrada: ${routeId}`);
      return null;
    }

    // Actualizar la ruta
    this.routes[routeIndex] = {
      ...this.routes[routeIndex],
      ...updates,
      updatedAt: Date.now()
    };

    // Re-ordenar si se cambió la prioridad
    if (updates.priority !== undefined) {
      this.routes.sort((a, b) => b.priority - a.priority);
    }

    console.log(`[RouteRegistry] Ruta actualizada: ${routeId}`);

    return this.routes[routeIndex];
  }

  /**
   * Desactiva una ruta específica
   * @param {string} routeId - ID de la ruta a desactivar
   * @returns {boolean} true si se desactivó correctamente
   */
  disableRoute(routeId) {
    return this.updateRoute(routeId, { active: false }) !== null;
  }

  /**
   * Activa una ruta específica
   * @param {string} routeId - ID de la ruta a activar
   * @returns {boolean} true si se activó correctamente
   */
  enableRoute(routeId) {
    return this.updateRoute(routeId, { active: true }) !== null;
  }

  /**
   * Elimina una ruta específica
   * @param {string} routeId - ID de la ruta a eliminar
   * @returns {boolean} true si se eliminó correctamente
   */
  removeRoute(routeId) {
    const initialLength = this.routes.length;
    this.routes = this.routes.filter(r => r.id !== routeId);

    const removed = this.routes.length < initialLength;
    if (removed) {
      console.log(`[RouteRegistry] Ruta eliminada: ${routeId}`);
    } else {
      console.log(`[RouteRegistry] Ruta no encontrada para eliminar: ${routeId}`);
    }

    return removed;
  }

  /**
   * Obtiene todas las rutas registradas
   * @param {boolean} activeOnly - Si true, devuelve solo rutas activas
   * @returns {Array} Lista de rutas
   */
  getAllRoutes(activeOnly = false) {
    return activeOnly 
      ? this.routes.filter(r => r.active)
      : [...this.routes];
  }

  /**
   * Obtiene rutas para un origen específico
   * @param {string} source - Origen para filtrar
   * @param {boolean} activeOnly - Si true, devuelve solo rutas activas
   * @returns {Array} Lista de rutas filtradas
   */
  getRoutesBySource(source, activeOnly = true) {
    return this.routes.filter(r => 
      r.source === source && 
      (!activeOnly || r.active)
    );
  }
}