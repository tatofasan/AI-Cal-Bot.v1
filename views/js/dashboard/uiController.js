// Módulo para manejar la interfaz de usuario del dashboard
const UIController = (() => {
  // Elementos DOM y estado de la UI
  const elements = {
    // Estadísticas
    activeCallsCount: document.getElementById('activeCallsCount'),
    recentCallsCount: document.getElementById('recentCallsCount'),
    activeAgentsCount: document.getElementById('activeAgentsCount'),
    ghostCallsCount: document.getElementById('ghostCallsCount'),

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
    toastMessage: document.getElementById('toastMessage'),

    // Elementos de transcripción
    callSelector: document.getElementById('callSelector'),
    transcriptContainer: document.getElementById('transcriptContainer'),
    autoRefreshTranscripts: document.getElementById('autoRefreshTranscripts')
  };

  // Estado
  let displayedCalls = new Map();
  let callTranscripts = new Map();
  let currentSelectedCall = null;
  let autoRefreshInterval = null;
  let ghostCallsCount = 0;

  // Actualizar estadísticas generales
  function updateStats(data) {
    if (!data || !data.calls) return;

    const now = Date.now();
    const thirtyMinsAgo = now - (30 * 60 * 1000);

    // Filtrar llamadas
    const activeCalls = data.calls.filter(call => call.status === 'active');
    const recentEndedCalls = data.calls.filter(call => 
      call.status === 'ended' && 
      call.endTime > thirtyMinsAgo
    );

    // Contar agentes activos y llamadas fantasma
    const activeAgents = activeCalls.filter(call => call.isAgentActive || call.agentTakeoverCount > 0).length;
    ghostCallsCount = activeCalls.filter(call => {
      const duration = now - call.startTime;
      return call.endReason === 'ghost_call_detection' || duration > 60 * 60 * 1000; // 1 hora
    }).length;

    // Actualizar contadores con animación
    animateCounter(elements.activeCallsCount, activeCalls.length);
    animateCounter(elements.recentCallsCount, recentEndedCalls.length);
    animateCounter(elements.activeAgentsCount, activeAgents);
    animateCounter(elements.ghostCallsCount, ghostCallsCount);
  }

  // Animar contador numérico
  function animateCounter(element, targetValue) {
    const currentValue = parseInt(element.textContent) || 0;
    if (currentValue === targetValue) return;

    const increment = targetValue > currentValue ? 1 : -1;
    const steps = Math.abs(targetValue - currentValue);
    const duration = Math.min(300, steps * 50);
    const stepDuration = duration / steps;

    let current = currentValue;
    const timer = setInterval(() => {
      current += increment;
      element.textContent = current;

      if (current === targetValue) {
        clearInterval(timer);
        // Añadir efecto de pulso al completar
        element.classList.add('scale-110');
        setTimeout(() => element.classList.remove('scale-110'), 200);
      }
    }, stepDuration);
  }

  // Formatear tiempo relativo
  function formatRelativeTime(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;

    if (diff < 60000) {
      const seconds = Math.floor(diff / 1000);
      return `hace ${seconds}s`;
    } else if (diff < 3600000) {
      const minutes = Math.floor(diff / 60000);
      return `hace ${minutes}m`;
    } else {
      const hours = Math.floor(diff / 3600000);
      return `hace ${hours}h`;
    }
  }

  // Formatear duración
  function formatDuration(durationMs) {
    if (!durationMs) return '00:00';

    const totalSeconds = Math.floor(durationMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  // Crear o actualizar tarjeta de llamada
  function createCallCard(call) {
    const isActive = call.status === 'active';
    const hasAgentActive = call.isAgentActive || call.agentTakeoverCount > 0;
    const duration = call.startTime ? formatDuration((call.endTime || Date.now()) - call.startTime) : '00:00';
    const isGhostCall = call.endReason === 'ghost_call_detection' || 
                        (!call.endTime && call.startTime && (Date.now() - call.startTime) > 60 * 60 * 1000);

    const card = document.createElement('div');
    card.id = `call-${call.id}`;
    card.className = 'bg-white rounded-lg shadow-sm border border-slate-200 p-4 hover:shadow-md transition-all';

    if (isGhostCall) {
      card.classList.add('border-red-300', 'bg-red-50');
    }

    card.innerHTML = `
      <div class="flex justify-between items-start mb-3">
        <div class="flex-1">
          <h4 class="font-semibold text-slate-800 flex items-center">
            ${call.userName || 'Sin nombre'}
            ${isGhostCall ? '<span class="ml-2 text-xs bg-red-600 text-white px-2 py-0.5 rounded ghost-call-indicator">FANTASMA</span>' : ''}
          </h4>
          <p class="text-sm text-slate-600">${call.phoneNumber || 'Número desconocido'}</p>
        </div>
        <div class="flex items-center space-x-1">
          ${isActive ? '<span class="w-2 h-2 bg-green-500 rounded-full status-pulse"></span>' : ''}
          ${hasAgentActive ? '<span class="w-2 h-2 bg-amber-500 rounded-full"></span>' : ''}
        </div>
      </div>

      <div class="space-y-2 text-sm">
        <div class="flex justify-between">
          <span class="text-slate-500">Duración:</span>
          <span class="font-medium text-slate-700 metric-value">${duration}</span>
        </div>

        <div class="flex justify-between">
          <span class="text-slate-500">Voz:</span>
          <span class="text-slate-700">${call.voiceName || 'No especificada'}</span>
        </div>

        <div class="flex justify-between">
          <span class="text-slate-500">Mensajes:</span>
          <span class="font-medium text-slate-700">${call.transcriptions?.length || 0}</span>
        </div>

        ${hasAgentActive ? `
        <div class="flex justify-between">
          <span class="text-slate-500">Intervenciones:</span>
          <span class="font-medium text-amber-600">${call.agentTakeoverCount || 0}</span>
        </div>
        ` : ''}
      </div>

      <div class="mt-3 pt-3 border-t border-slate-100 flex justify-between items-center">
        <span class="text-xs text-slate-500">${formatRelativeTime(call.startTime)}</span>
        <div class="flex space-x-2">
          <button 
            class="text-xs text-blue-600 hover:text-blue-700 font-medium"
            onclick="UIController.viewTranscript('${call.id}')"
          >
            Ver transcripción
          </button>
          ${isActive ? `
          <button 
            class="text-xs text-red-600 hover:text-red-700 font-medium"
            onclick="UIController.endCall('${call.id}', '${call.callSid}')"
          >
            Finalizar
          </button>
          ` : ''}
        </div>
      </div>
    `;

    return card;
  }

  // Actualizar contenedor de llamadas
  function updateCallsContainer(calls) {
    const activeTab = CallMonitor.getActiveTab();
    const now = Date.now();
    const thirtyMinsAgo = now - (30 * 60 * 1000);

    // Filtrar según tab activa
    let filteredCalls = [];
    if (activeTab === 'active') {
      filteredCalls = calls.filter(call => call.status === 'active');
    } else {
      filteredCalls = calls.filter(call => 
        call.status === 'ended' && 
        call.endTime > thirtyMinsAgo
      );
    }

    // Limpiar contenedor si no hay llamadas
    if (!filteredCalls || filteredCalls.length === 0) {
      elements.callsContainer.innerHTML = '';
      elements.noCallsMessage.classList.remove('hidden');
      displayedCalls.clear();
      updateCallSelector();
      return;
    }

    elements.noCallsMessage.classList.add('hidden');

    // Crear mapa de llamadas actuales
    const currentCallIds = new Set(filteredCalls.map(call => call.id));

    // Actualizar o crear tarjetas
    filteredCalls.forEach(call => {
      const existingCard = document.getElementById(`call-${call.id}`);

      if (existingCard) {
        // Actualizar tarjeta existente
        const newCard = createCallCard(call);
        existingCard.replaceWith(newCard);
      } else {
        // Crear nueva tarjeta con animación
        const newCard = createCallCard(call);
        newCard.style.opacity = '0';
        newCard.style.transform = 'translateY(10px)';
        elements.callsContainer.appendChild(newCard);

        // Animar entrada
        setTimeout(() => {
          newCard.style.transition = 'all 0.3s ease-out';
          newCard.style.opacity = '1';
          newCard.style.transform = 'translateY(0)';
        }, 10);

        // Mostrar notificación para nuevas llamadas activas
        if (call.status === 'active' && activeTab === 'active') {
          showToast('Nueva llamada detectada', 2000);
        }
      }

      displayedCalls.set(call.id, call);
    });

    // Eliminar tarjetas de llamadas que ya no existen
    displayedCalls.forEach((call, id) => {
      if (!currentCallIds.has(id)) {
        const card = document.getElementById(`call-${id}`);
        if (card) {
          card.style.transition = 'all 0.3s ease-out';
          card.style.opacity = '0';
          card.style.transform = 'translateY(-10px)';
          setTimeout(() => card.remove(), 300);
        }
        displayedCalls.delete(id);
      }
    });

    updateCallSelector();
  }

  // Actualizar selector de llamadas
  function updateCallSelector() {
    const currentValue = elements.callSelector.value;

    // Limpiar opciones excepto la primera
    while (elements.callSelector.options.length > 1) {
      elements.callSelector.remove(1);
    }

    // Añadir opciones ordenadas por tiempo
    const sortedCalls = Array.from(displayedCalls.values())
      .sort((a, b) => b.startTime - a.startTime);

    sortedCalls.forEach(call => {
      const option = document.createElement('option');
      option.value = call.id;

      let label = `${call.userName || 'Sin nombre'} - ${call.phoneNumber || 'Desconocido'}`;

      if (call.status === 'active') {
        label += ' 🟢';
      }

      if (call.isAgentActive) {
        label += ' 👤';
      }

      if (call.endReason === 'ghost_call_detection') {
        label += ' ⚠️';
      }

      option.textContent = label;
      elements.callSelector.appendChild(option);
    });

    // Restaurar selección si existe
    if (currentValue && Array.from(elements.callSelector.options).some(opt => opt.value === currentValue)) {
      elements.callSelector.value = currentValue;
    }
  }

  // Ver transcripción de una llamada
  async function viewTranscript(callId) {
    if (!callId) return;

    elements.callSelector.value = callId;
    currentSelectedCall = callId;

    // Mostrar loading
    elements.transcriptContainer.innerHTML = `
      <div class="flex items-center justify-center py-8">
        <svg class="animate-spin h-8 w-8 text-blue-500" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
    `;

    await fetchTranscripts(callId);

    // Activar auto-refresh si está habilitado
    if (elements.autoRefreshTranscripts.checked) {
      toggleAutoRefresh(true);
    }
  }

  // Obtener transcripciones
  async function fetchTranscripts(callId) {
    if (!callId) return;

    try {
      const transcriptions = await CallMonitor.fetchCallTranscriptions(callId);
      callTranscripts.set(callId, transcriptions);

      if (currentSelectedCall === callId) {
        updateTranscriptView(callId);
      }
    } catch (error) {
      console.error('Error obteniendo transcripciones:', error);
      elements.transcriptContainer.innerHTML = `
        <div class="text-center text-red-500 py-8">
          <p class="text-sm">Error al cargar transcripciones</p>
        </div>
      `;
    }
  }

  // Actualizar vista de transcripciones
  function updateTranscriptView(callId) {
    const transcripts = callTranscripts.get(callId);

    if (!transcripts || transcripts.length === 0) {
      elements.transcriptContainer.innerHTML = `
        <div class="text-center text-slate-400 py-8">
          <p class="text-sm">No hay transcripciones disponibles</p>
          <button 
            class="mt-2 text-xs text-blue-600 hover:text-blue-700 font-medium"
            onclick="UIController.fetchTranscripts('${callId}')"
          >
            Refrescar
          </button>
        </div>
      `;
      return;
    }

    elements.transcriptContainer.innerHTML = '';

    transcripts.forEach(transcript => {
      const msgDiv = document.createElement('div');
      msgDiv.className = 'mb-2';

      const time = new Date(transcript.timestamp).toLocaleTimeString();
      let bgColor, borderColor, label;

      switch (transcript.speakerType) {
        case 'client':
          bgColor = 'bg-green-50';
          borderColor = 'border-green-400';
          label = 'Cliente';
          break;
        case 'bot':
          bgColor = 'bg-blue-50';
          borderColor = 'border-blue-400';
          label = 'Bot';
          break;
        case 'agent':
          bgColor = 'bg-amber-50';
          borderColor = 'border-amber-400';
          label = 'Agente';
          break;
        default:
          bgColor = 'bg-slate-50';
          borderColor = 'border-slate-300';
          label = 'Sistema';
      }

      msgDiv.innerHTML = `
        <div class="${bgColor} border-l-3 ${borderColor} rounded-lg px-3 py-2">
          <div class="flex justify-between items-center mb-1">
            <span class="text-xs font-medium text-slate-600">${label}</span>
            <span class="text-xs text-slate-400">${time}</span>
          </div>
          <p class="text-sm text-slate-700">${transcript.text}</p>
        </div>
      `;

      elements.transcriptContainer.appendChild(msgDiv);
    });

    elements.transcriptContainer.scrollTop = elements.transcriptContainer.scrollHeight;
  }

  // Toggle auto-refresh de transcripciones
  function toggleAutoRefresh(enabled) {
    if (autoRefreshInterval) {
      clearInterval(autoRefreshInterval);
      autoRefreshInterval = null;
    }

    if (enabled && currentSelectedCall) {
      autoRefreshInterval = setInterval(() => {
        fetchTranscripts(currentSelectedCall);
      }, 3000);
    }
  }

  // Agregar log al sistema
  function addLog(text) {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] ${text}\n`;

    elements.systemLogs.innerHTML += logEntry;
    elements.systemLogs.scrollTop = elements.systemLogs.scrollHeight;

    // Limpiar logs antiguos si son demasiados
    const lines = elements.systemLogs.innerHTML.split('\n');
    if (lines.length > 500) {
      elements.systemLogs.innerHTML = lines.slice(-400).join('\n');
    }
  }

  // Mostrar notificación toast
  function showToast(message, duration = 3000) {
    elements.toastMessage.textContent = message;
    elements.toast.classList.remove('hidden', 'translate-y-full');

    setTimeout(() => {
      elements.toast.classList.add('translate-y-full');
      setTimeout(() => {
        elements.toast.classList.add('hidden');
      }, 300);
    }, duration);
  }

  // Actualizar estado de conexión
  function updateConnectionStatus(isConnected, customText = null) {
    if (isConnected) {
      elements.statusIndicator.classList.replace('bg-red-500', 'bg-green-500');
      elements.statusText.textContent = customText || 'Conectado';
    } else {
      elements.statusIndicator.classList.replace('bg-green-500', 'bg-red-500');
      elements.statusText.textContent = customText || 'Desconectado';
    }
  }

  // Finalizar una llamada
  async function endCall(callId, callSid) {
    if (!callId || !callSid) {
      showToast('Error: Información de llamada incompleta', 5000);
      return;
    }

    try {
      const response = await fetch('/end-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callSid, sessionId: callId })
      });

      const result = await response.json();

      if (result.success) {
        showToast('Llamada finalizada correctamente');
        window.dispatchEvent(new CustomEvent('dashboard:requestRefresh'));
      } else {
        showToast(`Error: ${result.error || 'Error desconocido'}`, 5000);
      }
    } catch (error) {
      console.error('Error finalizando llamada:', error);
      showToast('Error al comunicarse con el servidor', 5000);
    }
  }

  // Cambiar pestaña activa
  function setActiveTab(tab) {
    if (tab === 'active') {
      elements.tabActiveCalls.classList.add('border-blue-600', 'text-blue-600');
      elements.tabActiveCalls.classList.remove('border-transparent', 'text-slate-500');
      elements.tabRecentCalls.classList.remove('border-blue-600', 'text-blue-600');
      elements.tabRecentCalls.classList.add('border-transparent', 'text-slate-500');
    } else {
      elements.tabRecentCalls.classList.add('border-blue-600', 'text-blue-600');
      elements.tabRecentCalls.classList.remove('border-transparent', 'text-slate-500');
      elements.tabActiveCalls.classList.remove('border-blue-600', 'text-blue-600');
      elements.tabActiveCalls.classList.add('border-transparent', 'text-slate-500');
    }

    CallMonitor.setActiveTab(tab);
    window.dispatchEvent(new CustomEvent('dashboard:requestRefresh'));
  }

  // Inicializar event listeners
  function init() {
    // Botón de actualizar
    elements.refreshButton.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('dashboard:requestRefresh'));
    });

    // Selector de llamadas
    elements.callSelector.addEventListener('change', () => {
      const selectedCallId = elements.callSelector.value;
      if (selectedCallId) {
        viewTranscript(selectedCallId);
      } else {
        toggleAutoRefresh(false);
        currentSelectedCall = null;
        elements.transcriptContainer.innerHTML = `
          <div class="text-center text-slate-400 py-8">
            <svg class="w-12 h-12 mx-auto mb-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"></path>
            </svg>
            <p class="text-sm">Seleccione una llamada para ver transcripciones</p>
          </div>
        `;
      }
    });

    // Auto-refresh checkbox
    elements.autoRefreshTranscripts.addEventListener('change', (e) => {
      toggleAutoRefresh(e.target.checked);
    });

    // Tabs
    elements.tabActiveCalls.addEventListener('click', () => setActiveTab('active'));
    elements.tabRecentCalls.addEventListener('click', () => setActiveTab('recent'));
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