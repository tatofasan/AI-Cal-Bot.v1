// Módulo para monitorear las llamadas activas y recientes
const CallMonitor = (() => {
  // Variables privadas
  let pollingInterval = null;
  const POLLING_INTERVAL_MS = 5000; // 5 segundos
  let activeTab = 'active'; // 'active' o 'recent'

  // Obtener estadísticas de llamadas desde la API
  async function fetchCallStats() {
    try {
      const timestamp = Date.now(); // Añadir timestamp para evitar caché
      const response = await fetch(`/api/calls?t=${timestamp}`);

      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Error desconocido');
      }

      console.log('[CallMonitor] Datos recibidos:', data);
      return data;
    } catch (error) {
      console.error('[CallMonitor] Error al obtener estadísticas de llamadas:', error);
      throw error;
    }
  }

  // Obtener detalles de una llamada específica
  async function fetchCallDetails(callId) {
    try {
      const response = await fetch(`/api/calls/${callId}`);

      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Error desconocido');
      }

      return data.call;
    } catch (error) {
      console.error(`[CallMonitor] Error al obtener detalles de la llamada ${callId}:`, error);
      throw error;
    }
  }

  // Obtener transcripciones de una llamada específica
  async function fetchCallTranscriptions(callId) {
    try {
      const response = await fetch(`/api/calls/${callId}/transcriptions`);

      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Error desconocido');
      }

      return data.transcriptions;
    } catch (error) {
      console.error(`[CallMonitor] Error al obtener transcripciones de la llamada ${callId}:`, error);
      throw error;
    }
  }

  // Iniciar monitoreo continuo de llamadas
  function startMonitoring(callback) {
    // Detener cualquier intervalo existente
    stopMonitoring();

    // Solicitar datos inmediatamente
    fetchCallStats()
      .then(data => {
        if (callback) callback(data);
      })
      .catch(error => {
        console.error('[CallMonitor] Error inicial al obtener datos:', error);
        UIController.addLog('[ERROR] No se pudieron cargar las llamadas activas');
      });

    // Configurar intervalo para actualizaciones periódicas
    pollingInterval = setInterval(async () => {
      try {
        const data = await fetchCallStats();
        if (callback) callback(data);
      } catch (error) {
        console.error('[CallMonitor] Error al actualizar datos:', error);
      }
    }, POLLING_INTERVAL_MS);

    UIController.addLog(`[INFO] Monitoreo de llamadas iniciado (intervalo: ${POLLING_INTERVAL_MS/1000}s)`);
    return true;
  }

  // Detener monitoreo de llamadas
  function stopMonitoring() {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      pollingInterval = null;
      UIController.addLog('[INFO] Monitoreo de llamadas detenido');
      return true;
    }
    return false;
  }

  // Solicitar actualización única
  async function refreshCalls(callback) {
    UIController.addLog('[INFO] Actualizando datos de llamadas...');
    try {
      const data = await fetchCallStats();
      if (callback) callback(data);
      UIController.addLog('[INFO] Datos de llamadas actualizados');
      UIController.showToast('Datos actualizados');
      return data;
    } catch (error) {
      console.error('[CallMonitor] Error al actualizar datos:', error);
      UIController.addLog('[ERROR] Error al actualizar datos de llamadas');
      UIController.showToast('Error al actualizar datos', 3000);
      throw error;
    }
  }

  // Cambiar pestaña activa
  function setActiveTab(tab) {
    activeTab = tab;
    return activeTab;
  }

  // Obtener pestaña activa
  function getActiveTab() {
    return activeTab;
  }

  // API pública
  return {
    fetchCallStats,
    fetchCallDetails,
    fetchCallTranscriptions,
    startMonitoring,
    stopMonitoring,
    refreshCalls,
    setActiveTab,
    getActiveTab
  };
})();

// Exportar el módulo
window.CallMonitor = CallMonitor;