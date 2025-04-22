// Módulo para manejar la interfaz de usuario del dashboard
const UIController = (() => {
  // Elementos DOM y estado de la UI
  const elements = {
    // Estadísticas
    activeCallsCount: document.getElementById('activeCallsCount'),
    recentCallsCount: document.getElementById('recentCallsCount'),
    activeAgentsCount: document.getElementById('activeAgentsCount'),

    // Tabs
    tabActiveCalls: document.getElementById('tab-active-calls'),
    tabRecentCalls: document.getElementById('tab-recent-calls'),

    // Contenedores
    callsContainer: document.getElementById('callsContainer'),
    noCallsMessage: document.getElementById('noCallsMessage'),
    systemLogs: document.getElementById('systemLogs'),

    // Estado de conexión
    statusIndicator: document.getElementById('statusIndicator'),
    statusText: document.getElementById('statusText'),

    // Otros elementos
    refreshButton: document.getElementById('refreshButton'),
    toast: document.getElementById('toast'),

    // Elementos de transcripción
    callSelector: document.getElementById('callSelector'),
    transcriptContainer: document.getElementById('transcriptContainer')
  };

  // Mapa para almacenar las llamadas mostradas
  let displayedCalls = new Map();

  // Mapa para almacenar transcripciones por llamada
  let callTranscripts = new Map();

  // Llamada seleccionada actualmente para mostrar transcripciones
  let currentSelectedCall = null;

  // Flag para controlar la actualización automática de transcripciones
  let autoRefreshTranscriptsEnabled = false;
  let autoRefreshInterval = null;

  // Actualizar estadísticas generales
  function updateStats(data) {
    if (!data || !data.calls) return;

    const now = Date.now();
    const thirtyMinsAgo = now - (30 * 60 * 1000);

    // Filtrar llamadas activas y recientes
    const activeCalls = data.calls.filter(call => call.status === 'active');
    const recentEndedCalls = data.calls.filter(call => 
        call.status === 'ended' && 
        call.endTime > thirtyMinsAgo);

    // Contar agentes activos
    const activeAgents = activeCalls.filter(call => call.isAgentActive).length;

    // Actualizar contadores
    elements.activeCallsCount.textContent = activeCalls.length;
    elements.recentCallsCount.textContent = recentEndedCalls.length;
    elements.activeAgentsCount.textContent = activeAgents;
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

  // Formatear duración
  function formatDuration(durationMs) {
    if (!durationMs) return '--:--';

    const totalSeconds = Math.floor(durationMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  // Crear o actualizar una tarjeta de llamada
  function updateCallCard(call) {
    const callId = call.id;
    const isNewCall = !displayedCalls.has(callId);
    let card;

    if (isNewCall) {
      // Crear una nueva tarjeta
      card = document.createElement('div');
      card.id = `call-${callId}`;
      card.className = 'call-card bg-white rounded-lg p-4 border border-gray-200 flex flex-col new-call';
      displayedCalls.set(callId, call);

      // Crear entrada en el mapa de transcripciones si no existe
      if (!callTranscripts.has(callId)) {
        callTranscripts.set(callId, []);
      }

      // Actualizar el selector de llamadas
      updateCallSelector();

      // Mostrar notificación toast para nuevas llamadas
      if (call.status === 'active') {
        showToast('Nueva llamada detectada');
      }
    } else {
      // Actualizar tarjeta existente
      card = document.getElementById(`call-${callId}`);
      if (!card) {
        console.error(`No se encontró la tarjeta para la llamada ${callId}`);
        return;
      }
    }

    // Determinar estado de la llamada
    const isActive = call.status === 'active';
    const hasAgentActive = call.isAgentActive || call.agentTakeoverCount > 0;

    // Obtener una versión corta del ID para mostrar
    const shortId = callId.substring(8, 16); // Omitir el prefijo "session_"

    // Calcular duración
    let duration = '--:--';
    if (call.startTime) {
      const endTime = call.endTime || Date.now();
      duration = formatDuration(endTime - call.startTime);
    }

    // Obtener número de teléfono formateado
    const phoneNumber = call.phoneNumber || call.to_number || 'Desconocido';

    // Construir contenido de la tarjeta
    card.innerHTML = `
      <div class="flex justify-between items-start mb-2">
        <div>
          <h3 class="text-lg font-semibold text-gray-800">
            ${call.userName || 'Usuario'}
          </h3>
          <p class="text-sm text-gray-500">
            ${phoneNumber}
          </p>
        </div>
        <div class="flex space-x-1">
          <span class="status-indicator ${isActive ? 'status-active' : 'status-ended'}" 
                title="${isActive ? 'Llamada activa' : 'Llamada finalizada'}"></span>
          <span class="status-indicator ${hasAgentActive ? 'status-agent' : 'status-ended'}" 
                title="${hasAgentActive ? 'Con intervención de agente' : 'Sin agente'}"></span>
        </div>
      </div>
      <div class="mt-2 space-y-1">
        <p class="text-sm flex justify-between">
          <span class="text-gray-600">Duración:</span>
          <span class="font-medium">${duration}</span>
        </p>
        <p class="text-sm flex justify-between">
          <span class="text-gray-600">Inicio:</span>
          <span class="font-medium">${formatRelativeTime(call.startTime)}</span>
        </p>
        ${call.endTime ? `
        <p class="text-sm flex justify-between">
          <span class="text-gray-600">Fin:</span>
          <span class="font-medium">${formatRelativeTime(call.endTime)}</span>
        </p>
        ` : ''}
        <p class="text-sm flex justify-between">
          <span class="text-gray-600">Voz:</span>
          <span class="font-medium">${call.voiceName || 'Desconocida'}</span>
        </p>
        <p class="text-sm flex justify-between">
          <span class="text-gray-600">Mensajes:</span>
          <span class="font-medium">${call.transcriptions ? call.transcriptions.length : 0}</span>
        </p>
      </div>
      <div class="border-t border-gray-100 pt-2 mt-auto">
        <div class="flex justify-between items-center">
          <div>
            <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${isActive ? 'bg-green-100 text-green-800' : 'bg-pink-100 text-pink-800'}">
              ${isActive ? 'Activa' : 'Finalizada'}
            </span>
            ${hasAgentActive ? `
            <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 ml-1">
              Agente
            </span>
            ` : ''}
          </div>
          <div class="flex space-x-2">
            <button 
              class="text-blue-500 hover:text-blue-700 focus:outline-none" 
              onclick="UIController.viewTranscript('${callId}')"
              aria-label="Ver transcripción"
            >
              Ver transcripción
            </button>
            ${isActive ? `
            <button 
              class="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-xs" 
              onclick="UIController.endCall('${callId}', '${call.callSid}')"
              aria-label="Cortar llamada"
            >
              Cortar llamada
            </button>` : ''}
          </div>
        </div>
      </div>
    `;

    // Añadir la tarjeta al contenedor si es nueva
    if (isNewCall) {
      elements.callsContainer.appendChild(card);
    }

    // Actualizar el mapa de llamadas
    displayedCalls.set(callId, call);
  }

  // Actualizar el contenedor de llamadas
  function updateCallsContainer(calls) {
    // Obtener la pestaña activa
    const activeTab = CallMonitor.getActiveTab();

    // Filtrar llamadas según la pestaña activa
    const now = Date.now();
    const thirtyMinsAgo = now - (30 * 60 * 1000);

    let filteredCalls = [];
    if (activeTab === 'active') {
      // Mostrar solo llamadas activas
      filteredCalls = calls.filter(call => call.status === 'active');
    } else {
      // Mostrar llamadas recientes finalizadas (últimos 30 minutos)
      filteredCalls = calls.filter(call => 
        call.status === 'ended' && 
        call.endTime > thirtyMinsAgo);
    }

    // Limpiar contenedor si no hay llamadas
    if (!filteredCalls || filteredCalls.length === 0) {
      elements.callsContainer.innerHTML = '';
      elements.noCallsMessage.classList.remove('hidden');
      displayedCalls.clear(); // Limpiar el mapa cuando no hay llamadas
      updateCallSelector(); // Actualizar el selector
      return;
    }

    // Mostrar las llamadas
    elements.noCallsMessage.classList.add('hidden');

    // Marcar todas las llamadas como no verificadas
    const callIds = new Set();
    filteredCalls.forEach(call => {
      callIds.add(call.id);
      updateCallCard(call);
    });

    // Crear una copia segura del mapa de llamadas para iteración
    const displayedCallsEntries = Array.from(displayedCalls.entries());

    // Eliminar tarjetas de llamadas que ya no existen o no deben mostrarse
    for (const [id, call] of displayedCallsEntries) {
      if (!callIds.has(id)) {
        // Verificar que la tarjeta existe antes de intentar eliminarla
        const card = document.getElementById(`call-${id}`);
        if (card) {
          console.log(`[UIController] Eliminando tarjeta para llamada: ${id}`);
          // Añadir clase para animar la salida
          card.classList.add('opacity-0', 'transform', 'scale-95');
          setTimeout(() => {
            if (document.getElementById(`call-${id}`)) { // Verificar de nuevo antes de eliminar
              card.remove();
            }
          }, 300);
        } else {
          console.log(`[UIController] La tarjeta para la llamada ${id} ya no existe en el DOM`);
        }

        // Eliminar del mapa de llamadas
        displayedCalls.delete(id);
      }
    }

    // Actualizar el selector de llamadas después de hacer cambios
    updateCallSelector();
  }

  // Agregar log al panel de logs
  function addLog(text) {
    if (!text) return;

    const logLine = document.createElement('div');
    logLine.textContent = text;
    elements.systemLogs.appendChild(logLine);
    elements.systemLogs.scrollTop = elements.systemLogs.scrollHeight;

    // Procesar el log para buscar transcripciones
    processLogForTranscript(text);
  }

  // Procesar logs para encontrar transcripciones
  function processLogForTranscript(text) {
    try {
      // Detectar actualizaciones importantes que requieren refrescar transcripciones
      if (text.includes("Transcripción del usuario") || 
          text.includes("Respuesta del agente") || 
          text.includes("Mensaje del agente") ||
          text.includes("El agente humano ha tomado el control") ||
          text.includes("El agente humano ha dejado el control")) {

        // Si hay una llamada seleccionada actualmente, refrescar sus transcripciones
        if (currentSelectedCall) {
          // Refrescar después de un breve retraso para asegurarse de que el backend ha procesado
          setTimeout(() => {
            fetchTranscripts(currentSelectedCall);
          }, 500);
        }
      }
    } catch (error) {
      console.error("Error procesando log para transcripción:", error);
    }
  }

  // Obtener transcripciones de una llamada
  async function fetchTranscripts(callId) {
    if (!callId) return;

    try {
      const transcriptions = await CallMonitor.fetchCallTranscriptions(callId);

      // Actualizar las transcripciones en el mapa local
      callTranscripts.set(callId, transcriptions);

      // Actualizar la vista si esta es la llamada seleccionada
      if (currentSelectedCall === callId) {
        updateTranscriptView(callId);
      }

      return transcriptions;
    } catch (error) {
      console.error("Error obteniendo transcripciones:", error);
      return null;
    }
  }

  // Actualizar la vista de transcripciones para una llamada
  function updateTranscriptView(callId) {
    if (!callId) {
      elements.transcriptContainer.innerHTML = `
        <div class="text-center text-gray-500 py-10">
          Seleccione una llamada para ver las transcripciones
        </div>
      `;
      return;
    }

    const transcripts = callTranscripts.get(callId);

    if (!transcripts || transcripts.length === 0) {
      elements.transcriptContainer.innerHTML = `
        <div class="text-center text-gray-500 py-10">
          <p>No hay transcripciones disponibles para esta llamada</p>
          <button id="refreshTranscriptsBtn" class="mt-4 bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline">
            Refrescar transcripciones
          </button>
        </div>
      `;

      // Agregar event listener al botón de refrescar
      const refreshBtn = document.getElementById('refreshTranscriptsBtn');
      if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
          fetchTranscripts(callId);
        });
      }

      return;
    }

    // Limpiar el contenedor
    elements.transcriptContainer.innerHTML = '';

    // Añadir botón para refrescar en la parte superior
    const refreshHeader = document.createElement('div');
    refreshHeader.className = 'flex justify-between items-center mb-4';
    refreshHeader.innerHTML = `
      <div class="text-sm text-gray-500">
        ${transcripts.length} mensajes
      </div>
      <div class="flex items-center">
        <label class="inline-flex items-center mr-4">
          <input type="checkbox" id="autoRefreshTranscripts" class="form-checkbox h-4 w-4 text-blue-600" ${autoRefreshTranscriptsEnabled ? 'checked' : ''}>
          <span class="ml-2 text-sm text-gray-700">Auto-refrescar</span>
        </label>
        <button id="refreshTranscriptsBtn" class="bg-blue-500 hover:bg-blue-600 text-white text-xs px-2 py-1 rounded focus:outline-none focus:shadow-outline">
          Refrescar
        </button>
      </div>
    `;
    elements.transcriptContainer.appendChild(refreshHeader);

    // Agregar contenedor para los mensajes
    const messagesContainer = document.createElement('div');
    messagesContainer.className = 'space-y-2 pb-4 max-h-52 overflow-y-auto'; // Altura limitada con scroll
    elements.transcriptContainer.appendChild(messagesContainer);

    // Añadir cada transcripción
    transcripts.forEach(transcript => {
      const messageDiv = document.createElement('div');

      if (transcript.speakerType === 'system') {
        messageDiv.className = 'text-center text-gray-500 italic my-2';
        messageDiv.textContent = transcript.text;
      } else {
        messageDiv.className = `chat-message ${transcript.speakerType}`;

        let speakerLabel = '';
        if (transcript.speakerType === 'bot') {
          speakerLabel = '<span class="text-xs font-semibold text-blue-600">Bot</span>';
        } else if (transcript.speakerType === 'agent') {
          speakerLabel = '<span class="text-xs font-semibold text-yellow-600">Agente</span>';
        } else {
          speakerLabel = '<span class="text-xs font-semibold text-green-600">Cliente</span>';
        }

        const time = new Date(transcript.timestamp).toLocaleTimeString();

        messageDiv.innerHTML = `
          <div class="flex justify-between items-center mb-1">
            ${speakerLabel}
            <span class="text-xs text-gray-500">${time}</span>
          </div>
          <p>${transcript.text}</p>
        `;
      }

      messagesContainer.appendChild(messageDiv);
    });

    // Desplazar automáticamente al final
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // Agregar event listeners
    const refreshBtn = document.getElementById('refreshTranscriptsBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        fetchTranscripts(callId);
      });
    }

    const autoRefreshCheckbox = document.getElementById('autoRefreshTranscripts');
    if (autoRefreshCheckbox) {
      autoRefreshCheckbox.addEventListener('change', (e) => {
        toggleAutoRefresh(e.target.checked);
      });
    }
  }

  // Activar/desactivar actualización automática
  function toggleAutoRefresh(enabled) {
    autoRefreshTranscriptsEnabled = enabled;

    // Limpiar cualquier intervalo existente
    if (autoRefreshInterval) {
      clearInterval(autoRefreshInterval);
      autoRefreshInterval = null;
    }

    // Si está habilitado y hay una llamada seleccionada, iniciar refresco automático
    if (enabled && currentSelectedCall) {
      autoRefreshInterval = setInterval(() => {
        fetchTranscripts(currentSelectedCall);
      }, 3000); // Refrescar cada 3 segundos
    }
  }

  // Actualizar el selector de llamadas
  function updateCallSelector() {
    // Guardar la selección actual
    const currentValue = elements.callSelector.value;

    // Limpiar opciones excepto la primera (placeholder)
    while (elements.callSelector.options.length > 1) {
      elements.callSelector.remove(1);
    }

    // Añadir opciones para cada llamada activa
    for (const [callId, call] of displayedCalls.entries()) {
      const option = document.createElement('option');
      option.value = callId;

      // Crear una etiqueta descriptiva
      let label = `${call.userName || 'Usuario'} - ${call.phoneNumber || 'Desconocido'}`;

      // Añadir información adicional sobre la llamada
      if (call.status === 'active') {
        label += ' (Activa)';
      } else {
        label += ' (Finalizada)';
      }

      option.textContent = label;
      elements.callSelector.appendChild(option);
    }

    // Restaurar la selección si todavía existe
    if (currentValue && Array.from(elements.callSelector.options).some(opt => opt.value === currentValue)) {
      elements.callSelector.value = currentValue;
    }
  }

  // Ver transcripción de una llamada específica
  async function viewTranscript(callId) {
    if (!callId) return;

    // Actualizar el selector
    if (elements.callSelector.value !== callId) {
      elements.callSelector.value = callId;
    }

    currentSelectedCall = callId;

    // Mostrar un mensaje de carga
    elements.transcriptContainer.innerHTML = `
      <div class="text-center text-gray-500 py-10">
        <svg class="animate-spin h-8 w-8 text-blue-500 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p class="mt-2">Cargando transcripciones...</p>
      </div>
    `;

    // Obtener transcripciones de la llamada
    await fetchTranscripts(callId);

    // Activar actualización automática si está habilitada
    if (autoRefreshTranscriptsEnabled) {
      toggleAutoRefresh(true);
    }
  }

  // Finalizar una llamada
  async function endCall(callId, callSid) {
    if (!callId || !callSid) {
      console.error("Se requiere callId y callSid para finalizar la llamada");
      return;
    }

    try {
      const response = await fetch('/end-call', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          callSid,
          sessionId: callId
        })
      });

      const result = await response.json();

      if (result.success) {
        showToast(`Llamada finalizada correctamente`);

        // Solicitar actualización de todas las llamadas
        window.dispatchEvent(new CustomEvent('dashboard:requestRefresh'));
      } else {
        showToast(`Error al finalizar la llamada: ${result.error || 'Error desconocido'}`, 5000);
      }
    } catch (error) {
      console.error("Error finalizando llamada:", error);
      showToast('Error al comunicarse con el servidor', 5000);
    }
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

    // Event listener para el selector de llamadas
    elements.callSelector.addEventListener('change', () => {
      const selectedCallId = elements.callSelector.value;

      if (selectedCallId) {
        viewTranscript(selectedCallId);
      } else {
        // Mostrar mensaje predeterminado cuando no hay selección
        toggleAutoRefresh(false); // Desactivar auto-refresh
        elements.transcriptContainer.innerHTML = `
          <div class="text-center text-gray-500 py-10">
            Seleccione una llamada para ver las transcripciones
          </div>
        `;
        currentSelectedCall = null;
      }
    });

    // Event listeners para las pestañas
    elements.tabActiveCalls.addEventListener('click', () => {
      setActiveTab('active');
    });

    elements.tabRecentCalls.addEventListener('click', () => {
      setActiveTab('recent');
    });
  }

  // Cambiar pestaña activa
  function setActiveTab(tab) {
    // Actualizar estado de los botones de pestaña
    if (tab === 'active') {
      elements.tabActiveCalls.classList.add('text-blue-600', 'border-blue-600');
      elements.tabActiveCalls.classList.remove('text-gray-500', 'border-transparent');

      elements.tabRecentCalls.classList.remove('text-blue-600', 'border-blue-600');
      elements.tabRecentCalls.classList.add('text-gray-500', 'border-transparent');
    } else {
      elements.tabRecentCalls.classList.add('text-blue-600', 'border-blue-600');
      elements.tabRecentCalls.classList.remove('text-gray-500', 'border-transparent');

      elements.tabActiveCalls.classList.remove('text-blue-600', 'border-blue-600');
      elements.tabActiveCalls.classList.add('text-gray-500', 'border-transparent');
    }

    // Actualizar en el CallMonitor
    CallMonitor.setActiveTab(tab);

    // Actualizar la visualización
    window.dispatchEvent(new CustomEvent('dashboard:requestRefresh'));
  }

  // API pública
  return {
    elements,
    init,
    updateStats,
    updateCallsContainer,
    addLog,
    viewTranscript,
    endCall,
    showToast,
    updateConnectionStatus,
    fetchTranscripts,
    setActiveTab
  };
})();

// Exportar el módulo
window.UIController = UIController;