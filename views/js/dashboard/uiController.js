// Módulo para manejar la interfaz de usuario del dashboard
const UIController = (() => {
  // Elementos DOM y estado de la UI
  const elements = {
    // Estadísticas
    activeSessionsCount: document.getElementById('activeSessionsCount'),
    activeCallsCount: document.getElementById('activeCallsCount'),
    activeAgentsCount: document.getElementById('activeAgentsCount'),

    // Contenedores
    sessionsContainer: document.getElementById('sessionsContainer'),
    noSessionsMessage: document.getElementById('noSessionsMessage'),
    systemLogs: document.getElementById('systemLogs'),

    // Estado de conexión
    statusIndicator: document.getElementById('statusIndicator'),
    statusText: document.getElementById('statusText'),

    // Otros elementos
    refreshButton: document.getElementById('refreshButton'),
    toast: document.getElementById('toast'),
  };

  // Mapa para almacenar las sesiones mostradas
  let displayedSessions = new Map();

  // Actualizar estadísticas generales
  function updateStats(stats) {
    if (!stats) return;

    // Contar sesiones activas
    elements.activeSessionsCount.textContent = stats.totalSessions || 0;

    // Contar llamadas activas (sesiones con callSid)
    let callCount = 0;
    let agentCount = 0;

    // Procesar estadísticas detalladas si están disponibles
    if (stats.sessionDetails && Array.isArray(stats.sessionDetails)) {
      stats.sessionDetails.forEach(session => {
        if (session.callSid) callCount++;
        if (session.isAgentActive) agentCount++;
      });
    }

    elements.activeCallsCount.textContent = callCount;
    elements.activeAgentsCount.textContent = agentCount;
  }

  // Formatear tiempo relativo
  function formatRelativeTime(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;

    if (diff < 60000) {
      // Menos de un minuto
      const seconds = Math.floor(diff / 1000);
      return `hace ${seconds} seg`;
    } else if (diff < 3600000) {
      // Menos de una hora
      const minutes = Math.floor(diff / 60000);
      return `hace ${minutes} min`;
    } else {
      // Más de una hora
      const hours = Math.floor(diff / 3600000);
      return `hace ${hours} h`;
    }
  }

  // Crear o actualizar una tarjeta de sesión
  function updateSessionCard(session) {
    const sessionId = session.id;
    const isNewSession = !displayedSessions.has(sessionId);
    let card;

    if (isNewSession) {
      // Crear una nueva tarjeta
      card = document.createElement('div');
      card.id = `session-${sessionId}`;
      card.className = 'session-card bg-white rounded-lg p-4 border border-gray-200 flex flex-col new-session';
      displayedSessions.set(sessionId, session);

      // Mostrar notificación toast para nuevas sesiones
      showToast('Nueva sesión detectada');
    } else {
      // Actualizar tarjeta existente
      card = document.getElementById(`session-${sessionId}`);
      if (!card) {
        console.error(`No se encontró la tarjeta para la sesión ${sessionId}`);
        return;
      }
    }

    // Determinar estado de la sesión
    const hasActiveCall = session.callSid ? true : false;
    const hasAgentActive = session.isAgentActive ? true : false;

    // Construir contenido de la tarjeta
    card.innerHTML = `
      <div class="flex justify-between items-start mb-2">
        <div>
          <h3 class="text-lg font-semibold text-gray-800 truncate" title="${sessionId}">
            ${sessionId.substring(0, 12)}...
          </h3>
          <p class="text-sm text-gray-500">
            ${formatRelativeTime(session.createdAt)}
          </p>
        </div>
        <div class="flex space-x-1">
          <span class="status-indicator ${hasActiveCall ? 'status-active' : 'status-inactive'}" 
                title="${hasActiveCall ? 'Llamada activa' : 'Sin llamada'}"></span>
          <span class="status-indicator ${hasAgentActive ? 'status-agent' : 'status-inactive'}" 
                title="${hasAgentActive ? 'Agente conectado' : 'Sin agente'}"></span>
        </div>
      </div>
      <div class="border-t border-gray-100 pt-2 mt-auto">
        <div class="flex justify-between">
          <div class="text-sm">
            <p class="flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>${formatRelativeTime(session.lastActivity)}</span>
            </p>
          </div>
          <div>
            ${hasActiveCall ? 
              `<span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Llamada: ${session.callSid.substring(0, 6)}...
               </span>` : 
              `<span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                Sin llamada
               </span>`
            }
          </div>
        </div>
        <div class="mt-2 text-xs">
          <p>Clientes log: ${session.logClients?.size || 0}</p>
        </div>
      </div>
    `;

    // Añadir la tarjeta al contenedor si es nueva
    if (isNewSession) {
      elements.sessionsContainer.appendChild(card);
    }

    // Actualizar el mapa de sesiones
    displayedSessions.set(sessionId, session);
  }

  // Actualizar el contenedor de sesiones
  function updateSessionsContainer(sessions) {
    // Limpiar contenedor si no hay sesiones
    if (!sessions || sessions.length === 0) {
      elements.sessionsContainer.innerHTML = '';
      elements.noSessionsMessage.classList.remove('hidden');
      return;
    }

    // Mostrar las sesiones
    elements.noSessionsMessage.classList.add('hidden');

    // Marcar todas las sesiones como no verificadas
    const sessionIds = new Set();
    sessions.forEach(session => {
      sessionIds.add(session.id);
      updateSessionCard(session);
    });

    // Eliminar tarjetas de sesiones que ya no existen
    for (const [id, session] of displayedSessions.entries()) {
      if (!sessionIds.has(id)) {
        const card = document.getElementById(`session-${id}`);
        if (card) {
          // Añadir clase para animar la salida
          card.classList.add('opacity-0', 'transform', 'scale-95');
          setTimeout(() => {
            card.remove();
          }, 300);
        }
        displayedSessions.delete(id);
      }
    }
  }

  // Agregar log al panel de logs
  function addLog(text) {
    const logLine = document.createElement('div');
    logLine.textContent = text;
    elements.systemLogs.appendChild(logLine);
    elements.systemLogs.scrollTop = elements.systemLogs.scrollHeight;
  }

  // Mostrar toast de notificación
  function showToast(message, duration = 3000) {
    elements.toast.textContent = message;
    elements.toast.classList.remove('hidden');

    setTimeout(() => {
      elements.toast.classList.add('hidden');
    }, duration);
  }

  // Actualizar estado de la conexión
  function updateConnectionStatus(isConnected, customText = null) {
    if (isConnected) {
      elements.statusIndicator.classList.replace('bg-red-500', 'bg-green-500');
      elements.statusText.textContent = customText || 'Conectado';
    } else {
      elements.statusIndicator.classList.replace('bg-green-500', 'bg-red-500');
      elements.statusText.textContent = customText || 'Sin conexión';
    }
  }

  // Inicializar event listeners
  function init() {
    // Event listener para el botón de actualizar
    elements.refreshButton.addEventListener('click', () => {
      // Disparar evento personalizado para solicitar actualización
      window.dispatchEvent(new CustomEvent('dashboard:requestRefresh'));
    });
  }

  // API pública
  return {
    elements,
    init,
    updateStats,
    updateSessionsContainer,
    addLog,
    showToast,
    updateConnectionStatus
  };
})();

// Exportar el módulo
window.UIController = UIController;