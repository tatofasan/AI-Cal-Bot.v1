// Módulo para manejar la interfaz de usuario del operador
const UIController = (() => {
  // Elementos DOM y estado de la UI
  const elements = {
    callButton: document.getElementById('callButton'),
    monitorButton: document.getElementById('monitorAudioButton'),
    monitorIcon: document.getElementById('monitorIcon'),
    takeoverButton: document.getElementById('takeoverButton'),
    takeoverIcon: document.getElementById('takeoverIcon'),
    takeoverButtonText: document.getElementById('takeoverButtonText'),
    statusIndicator: document.getElementById('statusIndicator'),
    statusText: document.getElementById('statusText'),
    chatBox: document.getElementById('chatBox'),
    logs: document.getElementById('logs'),
    userName: document.getElementById('userName'),
    toNumber: document.getElementById('toNumber'),
    voiceSelected: document.getElementById('voiceSelected'),
    // Elementos de métricas
    metricsContainer: document.getElementById('audio-metrics'),
    toast: document.getElementById('toast'),
    toastMessage: document.getElementById('toastMessage')
  };

  // Estado de la UI
  let currentCallSid = null;
  let currentSessionId = null;
  let agentActive = false;
  let callMetrics = {
    latency: '--',
    chunksSent: 0,
    chunksReceived: 0,
    agentInterventions: 0
  };

  // Actualizar el ícono del botón de monitoreo según su estado
  function updateMonitorIcon(isMonitoring) {
    const iconHTML = isMonitoring
      ? `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />`
      : `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
         <line x1="21" y1="9" x2="21" y2="15" stroke="currentColor" stroke-width="2" stroke-linecap="round" />`;

    elements.monitorIcon.innerHTML = iconHTML;
  }

  // Actualizar el botón de toma de control según su estado
  function updateTakeoverButton(isActive) {
    if (isActive) {
      elements.takeoverButton.classList.remove("bg-amber-500", "hover:bg-amber-600");
      elements.takeoverButton.classList.add("bg-red-500", "hover:bg-red-600");
      elements.takeoverButtonText.textContent = "Dejar control";
      agentActive = true;

      // Actualizar métricas
      callMetrics.agentInterventions++;
      updateMetricsDisplay();
    } else {
      elements.takeoverButton.classList.remove("bg-red-500", "hover:bg-red-600");
      elements.takeoverButton.classList.add("bg-amber-500", "hover:bg-amber-600");
      elements.takeoverButtonText.textContent = "Intervenir";
      agentActive = false;
    }

    updateAgentStatusMetric();
  }

  // Activar o desactivar el botón de toma de control
  function enableTakeoverButton(enabled) {
    elements.takeoverButton.disabled = !enabled;
    if (enabled) {
      elements.takeoverButton.classList.remove("opacity-50", "cursor-not-allowed");
    } else {
      elements.takeoverButton.classList.add("opacity-50", "cursor-not-allowed");
      if (agentActive) {
        updateTakeoverButton(false);
      }
    }
  }

  // Actualizar estado del botón de llamada según estado actual
  function updateCallButton(isActive, isLoading = false) {
    const callButton = elements.callButton;
    const callIcon = document.getElementById('callIcon');
    const buttonText = callButton.querySelector('span');

    if (isLoading) {
      callButton.disabled = true;
      callIcon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.518 4.556a1 1 0 01-.21.915L8.532 11.97a11.01 11.01 0 005.516 5.517l1.822-1.797a1 1 0 01.915-.21l4.556 1.518a1 1 0 01.684.949V19a2 2 0 01-2 2h-1" />`;
      callIcon.classList.add('animate-spin');
      buttonText.textContent = 'Conectando';
      return;
    }

    callIcon.classList.remove('animate-spin');

    if (isActive) {
      // Llamada activa - mostrar botón de colgar
      callButton.classList.remove("bg-green-500", "hover:bg-green-600");
      callButton.classList.add("bg-red-500", "hover:bg-red-600");
      callIcon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />`;
      buttonText.textContent = 'Colgar';
      elements.statusIndicator.classList.replace('bg-red-500', 'bg-green-500');
      elements.statusText.textContent = 'Conectado';

      // Habilitar el botón de toma de control cuando hay una llamada activa
      enableTakeoverButton(true);

      // Reiniciar métricas
      resetCallMetrics();
    } else {
      // Sin llamada activa - mostrar botón de llamar
      callButton.classList.remove("bg-red-500", "hover:bg-red-600");
      callButton.classList.add("bg-green-500", "hover:bg-green-600");
      callIcon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.518 4.556a1 1 0 01-.21.915L8.532 11.97a11.01 11.01 0 005.516 5.517l1.822-1.797a1 1 0 01.915-.21l4.556 1.518a1 1 0 01.684.949V19a2 2 0 01-2 2h-1" />`;
      buttonText.textContent = 'Llamar';

      // Deshabilitar el botón de toma de control cuando no hay llamada activa
      enableTakeoverButton(false);
    }
    callButton.disabled = false;
  }

  // Actualizar estado de la conexión
  function updateConnectionStatus(isConnected, customText = null) {
    if (isConnected) {
      elements.statusIndicator.classList.replace('bg-red-500', 'bg-green-500');
      elements.statusText.textContent = customText || 'Conectado';
    } else {
      elements.statusIndicator.classList.replace('bg-green-500', 'bg-red-500');
      elements.statusText.textContent = customText || 'Desconectado';
    }
  }

  // Actualizar estado de la llamada en la UI
  function updateCallStatus(status, message) {
    let statusColor = 'bg-green-500';
    let statusMessage = message || status;

    switch (status) {
      case 'ringing':
        statusColor = 'bg-yellow-500';
        statusMessage = 'Llamando...';
        break;
      case 'connected':
        statusColor = 'bg-green-500';
        statusMessage = 'Conectado';
        break;
      case 'busy':
        statusColor = 'bg-red-500';
        statusMessage = 'Ocupado';
        break;
      case 'no-answer':
        statusColor = 'bg-orange-500';
        statusMessage = 'Sin respuesta';
        break;
      case 'failed':
      case 'canceled':
      case 'ended':
        statusColor = 'bg-red-500';
        statusMessage = message || 'Llamada finalizada';
        break;
      case 'starting':
        statusColor = 'bg-blue-500';
        statusMessage = 'Iniciando...';
        break;
    }

    elements.statusIndicator.className = `absolute w-3 h-3 rounded-full status-badge ${statusColor}`;
    elements.statusText.textContent = statusMessage;

    // Agregar mensaje al chat para estados importantes
    if (['connected', 'busy', 'no-answer', 'failed', 'ended'].includes(status)) {
      addChatMessage(statusMessage, 'system');
    }
  }

  // Agregar mensaje al chat con estilos mejorados
  function addChatMessage(text, type = 'client', isAgent = false) {
    const messageDiv = document.createElement("div");
    messageDiv.className = "animate-fadeIn";

    if (type === 'system') {
      // Mensajes del sistema
      messageDiv.className += " text-center py-2";
      messageDiv.innerHTML = `
        <span class="inline-block bg-slate-200 text-slate-600 text-xs px-3 py-1 rounded-full">
          ${text}
        </span>
      `;
    } else if (type === 'bot' || type === 'agent' || type === true) {
      // Mensajes del bot o agente
      const speaker = isAgent ? 'Agente' : 'Bot';
      const color = isAgent ? 'amber' : 'blue';

      messageDiv.className += " flex justify-start mb-3";
      messageDiv.innerHTML = `
        <div class="max-w-[70%]">
          <div class="flex items-center mb-1">
            <span class="text-xs font-medium text-${color}-600">${speaker}</span>
            <span class="text-xs text-slate-400 ml-2">${new Date().toLocaleTimeString()}</span>
          </div>
          <div class="bg-${color}-50 border-l-3 border-${color}-400 rounded-lg px-4 py-2">
            <p class="text-sm text-slate-700">${text}</p>
          </div>
        </div>
      `;
    } else {
      // Mensajes del cliente
      messageDiv.className += " flex justify-end mb-3";
      messageDiv.innerHTML = `
        <div class="max-w-[70%]">
          <div class="flex items-center justify-end mb-1">
            <span class="text-xs text-slate-400 mr-2">${new Date().toLocaleTimeString()}</span>
            <span class="text-xs font-medium text-green-600">Cliente</span>
          </div>
          <div class="bg-green-50 border-r-3 border-green-400 rounded-lg px-4 py-2">
            <p class="text-sm text-slate-700">${text}</p>
          </div>
        </div>
      `;
    }

    // Si el chatBox muestra el mensaje de placeholder, limpiarlo
    const placeholder = elements.chatBox.querySelector('.text-center.text-slate-400');
    if (placeholder) {
      placeholder.remove();
    }

    elements.chatBox.appendChild(messageDiv);
    elements.chatBox.scrollTop = elements.chatBox.scrollHeight;
  }

  // Limpiar el chat
  function clearChat() {
    elements.chatBox.innerHTML = `
      <div class="text-center text-slate-400 py-8">
        <svg class="w-12 h-12 mx-auto mb-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
        </svg>
        <p class="text-sm">Inicia una llamada para ver la conversación</p>
      </div>
    `;
  }

  // Agregar log al panel de logs con formato mejorado
  function addLog(text) {
    const timestamp = new Date().toLocaleTimeString();
    const formattedLog = `[${timestamp}] ${text}`;

    elements.logs.innerHTML += formattedLog + '\n';
    setTimeout(() => { 
      elements.logs.scrollTop = elements.logs.scrollHeight; 
    }, 10);
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

  // Actualizar métricas en la UI
  function updateMetricsDisplay() {
    if (!elements.metricsContainer) return;

    const metricsHTML = `
      <h3 class="text-lg font-semibold text-slate-800 mb-4">Métricas de Audio</h3>

      <div class="space-y-3">
        <div class="metric-card bg-slate-50 rounded-lg p-3">
          <div class="flex justify-between items-center">
            <span class="text-sm text-slate-600">Latencia</span>
            <span class="text-sm font-semibold text-slate-800 metric-value">${callMetrics.latency} ms</span>
          </div>
        </div>

        <div class="metric-card bg-slate-50 rounded-lg p-3">
          <div class="flex justify-between items-center">
            <span class="text-sm text-slate-600">Chunks enviados</span>
            <span class="text-sm font-semibold text-slate-800 metric-value">${callMetrics.chunksSent}</span>
          </div>
        </div>

        <div class="metric-card bg-slate-50 rounded-lg p-3">
          <div class="flex justify-between items-center">
            <span class="text-sm text-slate-600">Chunks recibidos</span>
            <span class="text-sm font-semibold text-slate-800 metric-value">${callMetrics.chunksReceived}</span>
          </div>
        </div>

        <div class="metric-card bg-slate-50 rounded-lg p-3">
          <div class="flex justify-between items-center">
            <span class="text-sm text-slate-600">Intervenciones</span>
            <span class="text-sm font-semibold text-slate-800 metric-value">${callMetrics.agentInterventions}</span>
          </div>
        </div>

        <div class="metric-card bg-slate-50 rounded-lg p-3">
          <div class="flex justify-between items-center">
            <span class="text-sm text-slate-600">Estado del agente</span>
            <span class="text-sm font-semibold ${agentActive ? 'text-amber-600' : 'text-blue-600'}">${agentActive ? 'Agente activo' : 'Bot activo'}</span>
          </div>
        </div>
      </div>
    `;

    elements.metricsContainer.innerHTML = metricsHTML;
  }

  // Actualizar solo el estado del agente en las métricas
  function updateAgentStatusMetric() {
    const statusElement = elements.metricsContainer?.querySelector('.metric-card:last-child span:last-child');
    if (statusElement) {
      statusElement.className = `text-sm font-semibold ${agentActive ? 'text-amber-600' : 'text-blue-600'}`;
      statusElement.textContent = agentActive ? 'Agente activo' : 'Bot activo';
    }
  }

  // Actualizar métricas de latencia
  function updateLatencyMetrics(metrics) {
    if (metrics.avgResponseLatency !== undefined) {
      callMetrics.latency = metrics.avgResponseLatency;
    }
    if (metrics.audioChunksReceived !== undefined) {
      callMetrics.chunksReceived = metrics.audioChunksReceived;
    }
    updateMetricsDisplay();
  }

  // Reiniciar métricas de llamada
  function resetCallMetrics() {
    callMetrics = {
      latency: '--',
      chunksSent: 0,
      chunksReceived: 0,
      agentInterventions: 0
    };
    updateMetricsDisplay();
  }

  // Obtener datos del formulario para iniciar llamada
  function getCallFormData() {
    const voiceSelect = elements.voiceSelected;
    return {
      user_name: elements.userName.value || 'Cliente',
      to_number: elements.toNumber.value || null,
      voice_id: voiceSelect.value,
      voice_name: voiceSelect.options[voiceSelect.selectedIndex].getAttribute('data-nombre')
    };
  }

  // Establecer CallSid actual
  function setCurrentCallSid(callSid) {
    currentCallSid = callSid;
  }

  // Obtener CallSid actual
  function getCurrentCallSid() {
    return currentCallSid;
  }

  // Establecer SessionId actual
  function setCurrentSessionId(sessionId) {
    currentSessionId = sessionId;
  }

  // Obtener SessionId actual
  function getCurrentSessionId() {
    return currentSessionId;
  }

  // Verificar si el agente está activo
  function isAgentActive() {
    return agentActive;
  }

  // API pública
  return {
    elements,
    updateMonitorIcon,
    updateTakeoverButton,
    enableTakeoverButton,
    updateCallButton,
    updateConnectionStatus,
    updateCallStatus,
    addChatMessage,
    clearChat,
    addLog,
    showToast,
    getCallFormData,
    setCurrentCallSid,
    getCurrentCallSid,
    setCurrentSessionId,
    getCurrentSessionId,
    isAgentActive,
    updateLatencyMetrics,
    updateMetricsDisplay
  };
})();

// Exportar el módulo
window.UIController = UIController;