// Módulo para manejar la interfaz de usuario
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
    voiceSelected: document.getElementById('voiceSelected')
  };

  // Estado de la UI
  let currentCallSid = null;
  let agentActive = false;

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

  // Actualizar el botón de toma de control según su estado
  function updateTakeoverButton(isActive) {
    if (isActive) {
      elements.takeoverButton.classList.remove("bg-yellow-500", "hover:bg-yellow-600");
      elements.takeoverButton.classList.add("bg-red-500", "hover:bg-red-600");
      elements.takeoverButtonText.textContent = "Dejar control";
      agentActive = true;
    } else {
      elements.takeoverButton.classList.remove("bg-red-500", "hover:bg-red-600");
      elements.takeoverButton.classList.add("bg-yellow-500", "hover:bg-yellow-600");
      elements.takeoverButtonText.textContent = "Tomar control";
      agentActive = false;
    }
  }

  // Activar o desactivar el botón de toma de control
  function enableTakeoverButton(enabled) {
    elements.takeoverButton.disabled = !enabled;
    if (enabled) {
      elements.takeoverButton.classList.remove("opacity-50", "cursor-not-allowed");
    } else {
      elements.takeoverButton.classList.add("opacity-50", "cursor-not-allowed");
      // Si estaba activo, desactivarlo
      if (agentActive) {
        updateTakeoverButton(false);
      }
    }
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
      // Habilitar el botón de toma de control cuando hay una llamada activa
      enableTakeoverButton(true);
    } else {
      // Sin llamada activa - mostrar botón de llamar
      elements.callButton.classList.remove("bg-red-500", "hover:bg-red-600");
      elements.callButton.classList.add("bg-green-500", "hover:bg-green-600");
      elements.callButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 inline-block" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.518 4.556a1 1 0 01-.21.915L8.532 11.97a11.01 11.01 0 005.516 5.517l1.822-1.797a1 1 0 01.915-.21l4.556 1.518a1 1 0 01.684.949V19a2 2 0 01-2 2h-1" /></svg>';
      // Deshabilitar el botón de toma de control cuando no hay llamada activa
      enableTakeoverButton(false);
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

  // Nueva función: Actualizar estado de la llamada en la UI
  function updateCallStatus(status, message) {
    // Actualizar el indicador visual de estado
    let statusColor = 'bg-green-500';  // Por defecto verde para estados "buenos"

    switch (status) {
      case 'ringing':
        statusColor = 'bg-yellow-500';  // Amarillo para llamando
        break;
      case 'connected':
        statusColor = 'bg-green-500';   // Verde para conectado
        break;
      case 'busy':
      case 'no-answer':
      case 'failed':
      case 'canceled':
      case 'ended':
        statusColor = 'bg-red-500';     // Rojo para estados finalizados o de error
        break;
      case 'starting':
        statusColor = 'bg-blue-500';    // Azul para iniciando
        break;
      default:
        statusColor = 'bg-gray-500';    // Gris para otros estados
    }

    // Actualizar el indicador de estado
    elements.statusIndicator.className = `w-3 h-3 rounded-full ${statusColor}`;
    elements.statusText.textContent = message || status;

    // Si es un estado final, también agregar un mensaje al chat
    if (['busy', 'no-answer', 'failed', 'canceled', 'ended'].includes(status)) {
      addChatMessage(message || `Llamada finalizada: ${status}`, true, false);
    }

    // Si es un estado inicial, también agregar mensaje
    if (status === 'starting' || status === 'ringing') {
      addChatMessage(message || `Estado: ${status}`, true, false);
    }

    // Si la llamada está conectada, agregar mensaje de conexión
    if (status === 'connected') {
      addChatMessage(message || 'Llamada conectada', true, false);
    }

    // Log para depuración
    console.log(`[UIController] Estado de llamada actualizado: ${status} - ${message}`);
  }

  // Agregar mensaje al chat con los nuevos estilos
  function addChatMessage(text, isBot, isAgent = false) {
    const messageDiv = document.createElement("div");

    if (isBot) {
      // Mensajes del bot o agente
      messageDiv.className = "chat-message server bg-gray-200 p-2 rounded-lg mb-2 max-w-[70%]";

      // Indicador visual según si es agente o bot
      if (isAgent) {
        // Estilo para el agente (amarillo)
        messageDiv.classList.add("border-l-4", "border-yellow-500");
        const agentIndicator = document.createElement("div");
        agentIndicator.className = "text-xs text-yellow-600 font-bold mb-1";
        agentIndicator.textContent = "Agente";
        messageDiv.prepend(agentIndicator);
      } else {
        // Estilo para el bot (azul)
        messageDiv.classList.add("border-l-4", "border-blue-500");
        const botIndicator = document.createElement("div");
        botIndicator.className = "text-xs text-blue-600 font-bold mb-1";
        botIndicator.textContent = "Bot";
        messageDiv.prepend(botIndicator);
      }
    } else {
      // Mensajes del cliente (verde)
      messageDiv.className = "chat-message client bg-green-100 p-2 rounded-lg mb-2 max-w-[70%] ml-auto border-r-4 border-green-500";

      // Agregar indicador para el cliente
      const clientIndicator = document.createElement("div");
      clientIndicator.className = "text-xs text-green-600 font-bold mb-1 text-right";
      clientIndicator.textContent = "Cliente";
      messageDiv.prepend(clientIndicator);
    }

    const textContainer = document.createElement("div");
    textContainer.textContent = text;
    messageDiv.appendChild(textContainer);

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
    updateCallStatus,  // Nueva función expuesta
    addChatMessage,
    clearChat,
    addLog,
    getCallFormData,
    setCurrentCallSid,
    getCurrentCallSid,
    isAgentActive
  };
})();

// Exportar el módulo
window.UIController = UIController;