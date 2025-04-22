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

    // Elementos de transcripción
    sessionSelector: document.getElementById('sessionSelector'),
    transcriptContainer: document.getElementById('transcriptContainer')
  };

  // Mapa para almacenar las sesiones mostradas
  let displayedSessions = new Map();

  // Mapa para almacenar transcripciones por sesión
  let sessionTranscripts = new Map();

  // Sesión seleccionada actualmente para mostrar transcripciones
  let currentSelectedSession = null;

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
    } else if (stats.sessionInfo && Array.isArray(stats.sessionInfo)) {
      stats.sessionInfo.forEach(session => {
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

      // Crear entrada en el mapa de transcripciones si no existe
      if (!sessionTranscripts.has(sessionId)) {
        sessionTranscripts.set(sessionId, []);
      }

      // Actualizar el selector de sesiones
      updateSessionSelector();

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

    // Obtener una versión corta del ID para mostrar
    const shortId = sessionId.substring(0, 12);

    // Construir contenido de la tarjeta
    card.innerHTML = `
      <div class="flex justify-between items-start mb-2">
        <div>
          <h3 class="text-lg font-semibold text-gray-800 truncate" title="${sessionId}">
            ${shortId}...
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
        <div class="mt-2 text-xs flex justify-between items-center">
          <p>Clientes log: ${session.logClients?.size || session.connections?.logClients || 0}</p>
          <div class="flex space-x-2">
            <button 
              class="text-blue-500 hover:text-blue-700 focus:outline-none" 
              onclick="UIController.viewTranscript('${sessionId}')"
              aria-label="Ver transcripción"
            >
              Ver transcripción
            </button>
            ${hasActiveCall ? 
            `<button 
              class="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-xs" 
              onclick="UIController.endCall('${sessionId}', '${session.callSid}')"
              aria-label="Cortar llamada"
            >
              Cortar llamada
            </button>` : 
            `<button 
              class="bg-gray-500 hover:bg-gray-600 text-white px-2 py-1 rounded text-xs" 
              onclick="UIController.terminateSession('${sessionId}')"
              aria-label="Eliminar sesión"
            >
              Eliminar sesión
            </button>`
            }
          </div>
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

        // También remover del selector de sesiones
        updateSessionSelector();
      }
    }
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
      // Detectar transcripciones del usuario
      if (text.includes("Transcripción del usuario:")) {
        const messageText = text.replace(/.*Transcripción del usuario:\s*/, "").trim();
        const sessionIdMatch = text.match(/sessionId['":\s]+([^'\s",}]+)/i) || text.match(/Session ID: ([^\s]+)/i);

        if (sessionIdMatch && sessionIdMatch[1] && messageText) {
          const sessionId = sessionIdMatch[1];
          addTranscript(sessionId, messageText, 'client');
          console.log("Transcripción del usuario detectada:", sessionId, messageText);
        }
      } 
      // Detectar respuestas del bot
      else if (text.includes("Respuesta del agente:")) {
        const messageText = text.replace(/.*Respuesta del agente:\s*/, "").trim();
        const sessionIdMatch = text.match(/sessionId['":\s]+([^'\s",}]+)/i) || text.match(/Session ID: ([^\s]+)/i);

        if (sessionIdMatch && sessionIdMatch[1] && messageText) {
          const sessionId = sessionIdMatch[1];

          // Determinar si es el bot o un agente humano
          const isHumanAgent = text.includes("[AGENT]") || text.includes("agente humano");
          addTranscript(sessionId, messageText, isHumanAgent ? 'agent' : 'bot');
          console.log("Respuesta del agente detectada:", sessionId, messageText, isHumanAgent ? '(humano)' : '(bot)');
        }
      }
      // Detectar mensajes del agente
      else if (text.includes("[AgentVoice]")) {
        if (text.includes("Respuesta sintetizada:") || text.includes("Mensaje del agente:")) {
          let messageText;
          if (text.includes("Respuesta sintetizada:")) {
            messageText = text.replace(/.*Respuesta sintetizada:\s*/, "").trim();
          } else {
            messageText = text.replace(/.*Mensaje del agente:\s*/, "").trim();
          }

          const sessionIdMatch = text.match(/sessionId['":\s]+([^'\s",}]+)/i) || text.match(/Session ID: ([^\s]+)/i);

          if (sessionIdMatch && sessionIdMatch[1] && messageText) {
            const sessionId = sessionIdMatch[1];
            addTranscript(sessionId, messageText, 'agent');
            console.log("Mensaje del agente humano detectado:", sessionId, messageText);
          }
        }
      }

      // También intentar procesar mensajes de chat directos
      if (text.includes("El agente humano ha tomado el control de la llamada") || 
          text.includes("El agente humano ha dejado el control de la llamada")) {
        const sessionIdMatch = text.match(/sessionId['":\s]+([^'\s",}]+)/i) || text.match(/Session ID: ([^\s]+)/i);
        if (sessionIdMatch && sessionIdMatch[1]) {
          const sessionId = sessionIdMatch[1];
          addTranscript(sessionId, text, 'system');
          console.log("Mensaje del sistema detectado:", sessionId, text);
        }
      }
    } catch (error) {
      console.error("Error procesando log para transcripción:", error);
    }
  }

  // Añadir una transcripción a una sesión
  function addTranscript(sessionId, text, speakerType) {
    if (!sessionId || !text) return;

    // Inicializar array de transcripciones para esta sesión si no existe
    if (!sessionTranscripts.has(sessionId)) {
      sessionTranscripts.set(sessionId, []);
    }

    // Añadir la transcripción
    const transcript = {
      text,
      speakerType, // 'bot', 'agent', 'client', 'system'
      timestamp: Date.now()
    };

    sessionTranscripts.get(sessionId).push(transcript);

    // Si esta es la sesión actualmente seleccionada, actualizar la vista
    if (currentSelectedSession === sessionId) {
      updateTranscriptView(sessionId);
    }
  }

  // Actualizar la vista de transcripciones para una sesión
  function updateTranscriptView(sessionId) {
    if (!sessionId || !sessionTranscripts.has(sessionId)) {
      elements.transcriptContainer.innerHTML = `
        <div class="text-center text-gray-500 py-10">
          No hay transcripciones disponibles para esta sesión
        </div>
      `;
      return;
    }

    const transcripts = sessionTranscripts.get(sessionId);

    if (!transcripts || transcripts.length === 0) {
      elements.transcriptContainer.innerHTML = `
        <div class="text-center text-gray-500 py-10">
          No hay transcripciones disponibles para esta sesión
        </div>
      `;
      return;
    }

    // Limpiar el contenedor
    elements.transcriptContainer.innerHTML = '';

    // Añadir cada transcripción
    transcripts.forEach(transcript => {
      const messageDiv = document.createElement('div');
      let cssClass = '';

      if (transcript.speakerType === 'system') {
        cssClass = 'text-center text-gray-500 italic my-2';
        messageDiv.className = cssClass;
        messageDiv.textContent = transcript.text;
      } else {
        cssClass = `chat-message ${transcript.speakerType}`;
        messageDiv.className = cssClass;

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

      elements.transcriptContainer.appendChild(messageDiv);
    });

    // Desplazar automáticamente al final
    elements.transcriptContainer.scrollTop = elements.transcriptContainer.scrollHeight;
  }

  // Actualizar el selector de sesiones
  function updateSessionSelector() {
    // Guardar la selección actual
    const currentValue = elements.sessionSelector.value;

    // Limpiar opciones excepto la primera (placeholder)
    while (elements.sessionSelector.options.length > 1) {
      elements.sessionSelector.remove(1);
    }

    // Añadir opciones para cada sesión activa
    for (const [sessionId, session] of displayedSessions.entries()) {
      const option = document.createElement('option');
      option.value = sessionId;

      // Crear una etiqueta descriptiva
      let label = `Sesión ${sessionId.substring(0, 8)}...`;

      // Añadir información adicional sobre la sesión
      if (session.callSid) {
        label += ` (Llamada: ${session.callSid.substring(0, 6)}...)`;
      }

      option.textContent = label;
      elements.sessionSelector.appendChild(option);
    }

    // Restaurar la selección si todavía existe
    if (currentValue && Array.from(elements.sessionSelector.options).some(opt => opt.value === currentValue)) {
      elements.sessionSelector.value = currentValue;
    }
  }

  // Ver transcripción de una sesión específica
  function viewTranscript(sessionId) {
    if (!sessionId) return;

    // Actualizar el selector
    if (elements.sessionSelector.value !== sessionId) {
      elements.sessionSelector.value = sessionId;
    }

    currentSelectedSession = sessionId;
    updateTranscriptView(sessionId);
  }

  // Finalizar una llamada
  async function endCall(sessionId, callSid) {
    if (!sessionId || !callSid) {
      console.error("Se requiere sessionId y callSid para finalizar la llamada");
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
          sessionId
        })
      });

      const result = await response.json();

      if (result.success) {
        showToast(`Llamada ${callSid.substring(0, 6)}... finalizada correctamente`);

        // Actualizar la sesión inmediatamente para reflejar el cambio
        if (displayedSessions.has(sessionId)) {
          const session = displayedSessions.get(sessionId);
          session.callSid = null;
          updateSessionCard(session);
        }

        // Solicitar actualización de todas las sesiones
        window.dispatchEvent(new CustomEvent('dashboard:requestRefresh'));
      } else {
        showToast(`Error al finalizar la llamada: ${result.error || 'Error desconocido'}`, 5000);
      }
    } catch (error) {
      console.error("Error finalizando llamada:", error);
      showToast('Error al comunicarse con el servidor', 5000);
    }
  }

  // Terminar una sesión (eliminarla)
  async function terminateSession(sessionId) {
    if (!sessionId) {
      console.error("Se requiere sessionId para terminar la sesión");
      return;
    }

    try {
      // Crear endpoint para terminar sesión si no existe
      // Como alternativa, podemos usar una llamada genérica y manejarla en el lado del cliente
      const response = await fetch('/terminate-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sessionId
        })
      });

      // Por simplicidad, incluso si hay un error en el servidor,
      // eliminamos la sesión del UI
      displayedSessions.delete(sessionId);
      sessionTranscripts.delete(sessionId);

      // Eliminar la tarjeta
      const card = document.getElementById(`session-${sessionId}`);
      if (card) {
        card.remove();
      }

      // Actualizar el selector
      updateSessionSelector();

      // Si era la sesión seleccionada, limpiar la vista
      if (currentSelectedSession === sessionId) {
        currentSelectedSession = null;
        elements.transcriptContainer.innerHTML = `
          <div class="text-center text-gray-500 py-10">
            Seleccione una sesión para ver las transcripciones
          </div>
        `;
      }

      showToast(`Sesión ${sessionId.substring(0, 8)}... eliminada`);

      // Refrescar todas las sesiones
      window.dispatchEvent(new CustomEvent('dashboard:requestRefresh'));
    } catch (error) {
      console.error("Error terminando sesión:", error);
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

    // Event listener para el selector de sesiones
    elements.sessionSelector.addEventListener('change', () => {
      const selectedSessionId = elements.sessionSelector.value;

      if (selectedSessionId) {
        currentSelectedSession = selectedSessionId;
        updateTranscriptView(selectedSessionId);
      } else {
        // Mostrar mensaje predeterminado cuando no hay selección
        elements.transcriptContainer.innerHTML = `
          <div class="text-center text-gray-500 py-10">
            Seleccione una sesión para ver las transcripciones
          </div>
        `;
        currentSelectedSession = null;
      }
    });
  }

  // API pública
  return {
    elements,
    init,
    updateStats,
    updateSessionsContainer,
    addLog,
    addTranscript,
    viewTranscript,
    endCall,
    terminateSession,
    showToast,
    updateConnectionStatus
  };
})();

// Exportar el módulo
window.UIController = UIController;