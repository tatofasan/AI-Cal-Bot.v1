// Módulo para monitorear las sesiones activas
const SessionMonitor = (() => {
  // Variables privadas
  let pollingInterval = null;
  const POLLING_INTERVAL_MS = 5000; // 5 segundos

  // Obtener estadísticas de sesiones desde la API
  async function fetchSessionStats() {
    try {
      const timestamp = Date.now(); // Añadir timestamp para evitar caché
      const response = await fetch(`/api/sessions?t=${timestamp}`);

      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Error desconocido');
      }

      return data;
    } catch (error) {
      console.error('[SessionMonitor] Error al obtener estadísticas de sesiones:', error);
      throw error;
    }
  }

  // Obtener detalles completos de las sesiones
  async function fetchSessionDetails() {
    try {
      const data = await fetchSessionStats();

      if (!data.stats) {
        throw new Error('Formato de datos inválido');
      }

      // Si la API ya incluye información de sesiones, usarla directamente
      if (data.stats.sessionInfo && Array.isArray(data.stats.sessionInfo)) {
        data.stats.sessionDetails = data.stats.sessionInfo;
        return data;
      }

      // En caso contrario, solicitar detalles para cada sesión individualmente
      if (!data.stats.sessions || !Array.isArray(data.stats.sessions)) {
        throw new Error('No hay información de sesiones disponible');
      }

      // Crear array para almacenar detalles de sesiones
      const sessionDetails = [];

      // Solicitar detalles de cada sesión
      for (const sessionId of data.stats.sessions) {
        try {
          // Usar el endpoint existente para obtener detalles
          const response = await fetch(`/session-details?sessionId=${sessionId}`);

          if (response.ok) {
            const sessionData = await response.json();
            if (sessionData.success && sessionData.session) {
              sessionDetails.push(sessionData.session);
            }
          }
        } catch (detailError) {
          console.warn(`[SessionMonitor] Error al obtener detalles para sesión ${sessionId}:`, detailError);
          // Añadir datos básicos de la sesión aunque fallen los detalles
          sessionDetails.push({
            id: sessionId,
            isError: true,
            errorMessage: detailError.message
          });
        }
      }

      // Actualizar data con detalles de sesiones
      data.stats.sessionDetails = sessionDetails;

      return data;
    } catch (error) {
      console.error('[SessionMonitor] Error al obtener detalles de sesiones:', error);
      throw error;
    }
  }

  // Iniciar monitoreo continuo de sesiones
  function startMonitoring(callback) {
    // Detener cualquier intervalo existente
    stopMonitoring();

    // Solicitar datos inmediatamente
    fetchSessionStats()
      .then(data => {
        if (callback) callback(data);
      })
      .catch(error => {
        console.error('[SessionMonitor] Error inicial al obtener datos:', error);
        UIController.addLog('[ERROR] No se pudieron cargar las sesiones activas');
      });

    // Configurar intervalo para actualizaciones periódicas
    pollingInterval = setInterval(async () => {
      try {
        const data = await fetchSessionStats();
        if (callback) callback(data);
      } catch (error) {
        console.error('[SessionMonitor] Error al actualizar datos:', error);
      }
    }, POLLING_INTERVAL_MS);

    UIController.addLog(`[INFO] Monitoreo de sesiones iniciado (intervalo: ${POLLING_INTERVAL_MS/1000}s)`);
    return true;
  }

  // Detener monitoreo de sesiones
  function stopMonitoring() {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      pollingInterval = null;
      UIController.addLog('[INFO] Monitoreo de sesiones detenido');
      return true;
    }
    return false;
  }

  // Solicitar actualización única
  async function refreshSessions(callback) {
    UIController.addLog('[INFO] Actualizando datos de sesiones...');
    try {
      const data = await fetchSessionStats();
      if (callback) callback(data);
      UIController.addLog('[INFO] Datos de sesiones actualizados');
      UIController.showToast('Datos actualizados');
      return data;
    } catch (error) {
      console.error('[SessionMonitor] Error al actualizar datos:', error);
      UIController.addLog('[ERROR] Error al actualizar datos de sesiones');
      UIController.showToast('Error al actualizar datos', 3000);
      throw error;
    }
  }

  // Procesar mensajes del WebSocket
  function processWebSocketMessage(event) {
    try {
      // Intentar parsear como JSON
      let data;
      try {
        data = JSON.parse(event.data);
      } catch (e) {
        // Si no es JSON, tratar como mensaje de texto
        UIController.addLog(event.data);
        return;
      }

      // Manejar mensaje JSON
      if (data.type === 'session_update') {
        // Solicitar actualización de datos
        refreshSessions(UIController.updateStats);
      } else if (data.type === 'system_log') {
        UIController.addLog(data.message);
      }
    } catch (error) {
      console.error('[SessionMonitor] Error procesando mensaje WebSocket:', error);
    }
  }

  // API pública
  return {
    fetchSessionStats,
    fetchSessionDetails,
    startMonitoring,
    stopMonitoring,
    refreshSessions,
    processWebSocketMessage
  };
})();

// Exportar el módulo
window.SessionMonitor = SessionMonitor;