// Módulo para manejar la interfaz de usuario
const UIController = (() => {
  // Elementos DOM y estado de la UI
  const elements = {
    callButton: document.getElementById('callButton'),
    monitorButton: document.getElementById('monitorAudioButton'),
    monitorIcon: document.getElementById('monitorIcon'),
    statusIndicator: document.getElementById('statusIndicator'),
    statusText: document.getElementById('statusText'),
    chatBox: document.getElementById('chatBox'),
    logs: document.getElementById('logs'),
    userName: document.getElementById('userName'),
    toNumber: document.getElementById('toNumber'),
    voiceSelected: document.getElementById('voiceSelected')
  };

  // Estado de la UI
  let currentCallSid = null;

  // Actualizar el ícono del botón de monitoreo según su estado
  function updateMonitorIcon(isMonitoring) {
    if (isMonitoring) {
      elements.monitorIcon.outerHTML = `<svg id="monitorIcon" xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 inline-block" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M11 5h2m-2 14h2m-2-7h2m6.586-3.586A2 2 0 0018 7H6a2 2 0 00-1.414.586L3 9v6l1.586 1.414A2 2 0 006 17h12a2 2 0 001.414-.586L21 15V9l-1.414-1.414z" />
      </svg>`;
    } else {
      elements.monitorIcon.outerHTML = `<svg id="monitorIcon" xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 inline-block" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M11 5h2m-2 14h2m-2-7h2m6.586-3.586A2 2 0 0018 7H6a2 2 0 00-1.414.586L3 9v6l1.586 1.414A2 2 0 006 17h12a2 2 0 001.414-.586L21 15V9l-1.414-1.414z" />
        <line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      </svg>`;
    }
    // Actualizar la referencia al ícono después de cambiarlo
    elements.monitorIcon = document.getElementById('monitorIcon');
  }

  // Actualizar estado del botón de llamada según estado actual
  function updateCallButton(isActive, isLoading = false) {
    if (isLoading) {
      elements.callButton.disabled = true;
      elements.callButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 inline-block animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.518 4.556a1 1 0 01-.21.915L8.532 11.97a11.01 11.01 0 005.516 5.517l1.822-1.797a1 1 0 01.915-.21l4.556 1.518a1 1 0 01.684.949V19a2 2 0 01-2 2h-1" /></svg>';
      return;
    }

    if (isActive) {
      // Llamada activa - mostrar botón de colgar
      elements.callButton.classList.remove("bg-green-500", "hover:bg-green-600");
      elements.callButton.classList.add("bg-red-500", "hover:bg-red-600");
      elements.callButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 inline-block" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>';
      elements.statusIndicator.classList.replace('bg-red-500', 'bg-green-500');
      elements.statusText.textContent = 'Conectado';
    } else {
      // Sin llamada activa - mostrar botón de llamar
      elements.callButton.classList.remove("bg-red-500", "hover:bg-red-600");
      elements.callButton.classList.add("bg-green-500", "hover:bg-green-600");
      elements.callButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 inline-block" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.518 4.556a1 1 0 01-.21.915L8.532 11.97a11.01 11.01 0 005.516 5.517l1.822-1.797a1 1 0 01.915-.21l4.556 1.518a1 1 0 01.684.949V19a2 2 0 01-2 2h-1" /></svg>';
    }
    elements.callButton.disabled = false;
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

  // Agregar mensaje al chat
  function addChatMessage(text, isBot) {
    const messageDiv = document.createElement("div");
    if (isBot) {
      messageDiv.className = "chat-message server bg-gray-200 p-2 rounded-lg mb-2 max-w-[70%]";
    } else {
      messageDiv.className = "chat-message client bg-green-100 p-2 rounded-lg mb-2 max-w-[70%] ml-auto";
    }
    messageDiv.textContent = text;
    elements.chatBox.appendChild(messageDiv);
    elements.chatBox.scrollTop = elements.chatBox.scrollHeight;
  }

  // Limpiar el chat
  function clearChat() {
    elements.chatBox.innerHTML = "";
  }

  // Agregar log al panel de logs
  function addLog(text) {
    elements.logs.innerHTML += text + '\n';
    setTimeout(() => { elements.logs.scrollTop = elements.logs.scrollHeight; }, 10);
  }

  // Procesar mensaje de transcripción
  function processTranscription(data) {
    if (!data || (!data.text && !data.payload?.text)) {
      return;
    }

    const text = data.text || data.payload.text;
    const isBot = data.isBot === undefined ? 
      (data.payload?.isBot || false) : data.isBot;

    addChatMessage(text, isBot);
  }

  // Obtener datos del formulario para iniciar llamada
  function getCallFormData() {
    const voiceSelect = elements.voiceSelected;
    // Corregido: Usamos las variables con snake_case para mantener compatibilidad
    return {
      user_name: elements.userName.value,
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

  // API pública
  return {
    elements,
    updateMonitorIcon,
    updateCallButton,
    updateConnectionStatus,
    addChatMessage,
    clearChat,
    addLog,
    processTranscription,
    getCallFormData,
    setCurrentCallSid,
    getCurrentCallSid
  };
})();

// Exportar el módulo
window.UIController = UIController;