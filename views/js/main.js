// Script principal que inicializa y conecta los módulos
document.addEventListener('DOMContentLoaded', function() {
  // Inicialización de la UI
  UIController.updateMonitorIcon(AudioProcessor.isMonitoring());
  UIController.enableTakeoverButton(false);
  UIController.updateMetricsDisplay();

  // Configurar event listeners
  setupEventListeners();

  // Conectar al WebSocket
  setupWebSocket();

  // Iniciar actualización periódica de métricas
  setupMetricsUpdater();
});

// Configurar los event listeners
function setupEventListeners() {
  // Event listener para el botón de monitoreo
  UIController.elements.monitorButton.addEventListener('click', function() {
    const isMonitoring = AudioProcessor.toggleMonitoring();
    UIController.updateMonitorIcon(isMonitoring);

    // Notificar cambio de estado
    UIController.showToast(isMonitoring ? 'Monitoreo activado' : 'Monitoreo desactivado', 2000);
  });

  // Event listener para el botón de llamada
  UIController.elements.callButton.addEventListener('click', async function() {
    const currentCallSid = UIController.getCurrentCallSid();

    if (!currentCallSid) {
      startNewCall();
    } else {
      endCurrentCall();
    }
  });

  // Event listener para el botón de toma de control
  UIController.elements.takeoverButton.addEventListener('click', async function() {
    const isAgentActive = UIController.isAgentActive();

    if (!isAgentActive) {
      // Interrumpir cualquier reproducción de audio en curso
      AudioProcessor.clearAudioQueues();

      // Añadir un mensaje de log
      UIController.addLog('[INFO] Interrumpiendo bot y tomando control de la llamada...');

      // Obtener sessionId actual
      const sessionId = await WebSocketHandler.getSessionId();
      UIController.setCurrentSessionId(sessionId);

      // Iniciar control del agente
      const success = await AgentVoiceCapture.startCapturing(sessionId);
      if (success) {
        UIController.updateTakeoverButton(true);
        UIController.addLog('[INFO] Agente humano ha tomado el control');
        UIController.addChatMessage("El agente humano ha tomado el control de la llamada", 'system');
        UIController.showToast('Control de agente activado', 2000);
      } else {
        UIController.showToast('Error: No se pudo activar el micrófono', 3000);
      }
    } else {
      // Detener control del agente
      AgentVoiceCapture.stopCapturing();
      UIController.updateTakeoverButton(false);
      UIController.addLog('[INFO] Agente humano ha liberado el control');
      UIController.addChatMessage("El agente humano ha dejado el control de la llamada", 'system');
      UIController.showToast('Control devuelto al bot', 2000);
    }
  });

  // Validación del formulario
  UIController.elements.userName.addEventListener('input', function(e) {
    if (e.target.value.length > 50) {
      e.target.value = e.target.value.substring(0, 50);
    }
  });

  UIController.elements.toNumber.addEventListener('input', function(e) {
    // Permitir solo números, + y espacios
    e.target.value = e.target.value.replace(/[^0-9+\s-]/g, '');
  });
}

// Iniciar una nueva llamada
async function startNewCall() {
  // Validar que al menos el nombre esté presente
  const userName = UIController.elements.userName.value.trim();
  if (!userName) {
    UIController.showToast('Por favor ingrese el nombre del contacto', 3000);
    UIController.elements.userName.focus();
    return;
  }

  // Limpiar el chat para la nueva llamada
  UIController.clearChat();

  // Mostrar estado de "cargando" en el botón
  UIController.updateCallButton(false, true);

  try {
    // Obtener datos del formulario
    const callData = UIController.getCallFormData();

    // Asegurar que tenemos un sessionId antes de iniciar la llamada
    callData.sessionId = await WebSocketHandler.getSessionId();
    UIController.setCurrentSessionId(callData.sessionId);

    console.log("Iniciando llamada con datos:", callData);

    // Llamar a la API
    const result = await ApiService.initiateCall(callData);

    if (result.success) {
      // Actualizar UI con la llamada activa
      UIController.setCurrentCallSid(result.callSid);
      UIController.updateCallButton(true);
      UIController.updateConnectionStatus(true, 'Conectando...');

      // Añadir mensaje de inicio de llamada al chat
      UIController.addChatMessage("Iniciando llamada...", 'system');

      // Log
      UIController.addLog(`[INFO] Llamada iniciada - ID: ${result.callSid}`);
      UIController.showToast('Llamada iniciada correctamente', 2000);

      // Si estaba en modo agente, desactivarlo para la nueva llamada
      if (UIController.isAgentActive()) {
        AgentVoiceCapture.stopCapturing();
        UIController.updateTakeoverButton(false);
      }
    } else {
      throw new Error(result.error || 'Error desconocido');
    }
  } catch (error) {
    console.error("Error iniciando llamada:", error);
    UIController.updateCallButton(false);
    UIController.showToast(`Error: ${error.message}`, 5000);
    UIController.addLog(`[ERROR] ${error.message}`);
  }
}

// Finalizar la llamada actual
async function endCurrentCall() {
  try {
    const callSid = UIController.getCurrentCallSid();
    const sessionId = UIController.getCurrentSessionId() || await WebSocketHandler.getSessionId();

    UIController.addLog('[INFO] Finalizando llamada...');

    const result = await ApiService.endCall(callSid, sessionId);

    if (result.success) {
      console.log("Llamada finalizada:", result.message);

      // Limpiar audio
      AudioProcessor.clearAudioQueues();

      // Si estaba en modo agente, desactivarlo
      if (UIController.isAgentActive()) {
        AgentVoiceCapture.stopCapturing();
        UIController.updateTakeoverButton(false);
      }

      // Actualizar UI para reflejar llamada finalizada
      UIController.setCurrentCallSid(null);
      UIController.updateCallButton(false);
      UIController.updateConnectionStatus(false, 'Llamada finalizada');

      // Añadir mensaje de finalización al chat
      UIController.addChatMessage("Llamada finalizada", 'system');

      // Log y notificación
      UIController.addLog('[INFO] Llamada finalizada correctamente');
      UIController.showToast('Llamada finalizada', 2000);
    } else {
      throw new Error(result.error || 'Error desconocido');
    }
  } catch (error) {
    console.error("Error al finalizar la llamada:", error);
    UIController.showToast(`Error: ${error.message}`, 5000);
    UIController.addLog(`[ERROR] ${error.message}`);
  }
}

// Configurar la conexión WebSocket
async function setupWebSocket() {
  try {
    await WebSocketHandler.connectToLogsWebSocket(
      // Callback onMessage
      function(event) {
        let data;
        try {
          data = JSON.parse(event.data);
        } catch (e) {
          data = { type: "log", message: event.data };
        }

        // Procesar según el tipo de mensaje
        if (data.type === "audio") {
          // Si el agente está activo, no reproducir el audio del bot
          if (UIController.isAgentActive()) {
            console.log("[WebSocket] Audio del bot ignorado - agente activo");
            return;
          }

          const messageId = data.id || null;
          if (data.payload) {
            AudioProcessor.playBotAudioChunk(data.payload, messageId);
          }
          return;
        }

        if (data.type === "client_audio") {
          const messageId = data.id || null;
          if (data.payload) {
            AudioProcessor.playClientAudioChunk(data.payload, messageId);
          }
          return;
        }

        // Actualización del estado de llamada
        if (data.type === "call_status_update") {
          UIController.updateCallStatus(data.status, data.message);
          return;
        }

        // Verificar si es una interrupción
        if (data.type === "interruption" || 
            (typeof data.message === 'string' && data.message.includes("interrupción"))) {
          console.log("[WebSocket] Interrupción detectada");
          AudioProcessor.clearAudioQueues();
        }

        // Procesar transcripciones
        if (data.type === "user_transcript") {
          UIController.addChatMessage(data.text, 'client');
          return;
        }

        if (data.type === "agent_response") {
          UIController.addChatMessage(data.text, 'bot');
          return;
        }

        if (data.type === "agent_message") {
          UIController.addChatMessage(data.text, 'agent', true);
          return;
        }

        // Procesar logs y transcripciones desde texto
        const log = data.message || event.data;
        console.log("Log recibido:", log);

        // Agregar al panel de logs
        UIController.addLog(log);

        // Detectar transcripciones en el formato de log
        if (log.includes("[Twilio] Respuesta del agente:")) {
          const messageText = log.replace(/.*\[Twilio\] Respuesta del agente:\s*/g, "").trim();
          const isFromHumanAgent = log.includes("[AGENT]");
          UIController.addChatMessage(messageText, isFromHumanAgent ? 'agent' : 'bot', isFromHumanAgent);
        } else if (log.includes("[Twilio] Transcripción del usuario:")) {
          const messageText = log.replace(/.*\[Twilio\] Transcripción del usuario:\s*/g, "").trim();
          UIController.addChatMessage(messageText, 'client');
        }

        // Detectar cambios de estado del agente
        if (log.includes("Un agente ha tomado el control")) {
          UIController.addLog("[INFO] Agente activo en la conversación");
          AudioProcessor.clearAudioQueues();
        } else if (log.includes("El agente ha dejado el control")) {
          UIController.addLog("[INFO] Bot retomó el control");
        }

        // Actualizar estado de conexión basado en logs
        if (log.includes("Conversación conectada") || log.includes("Stream iniciado")) {
          UIController.updateConnectionStatus(true, 'Conectado');
        }
      },

      // Callback onOpen
      function() {
        UIController.addLog('[INFO] Conexión WebSocket establecida');
        UIController.updateConnectionStatus(true, 'Sistema listo');
      },

      // Callback onClose
      function() {
        UIController.addLog('[INFO] Conexión WebSocket cerrada');
        UIController.updateConnectionStatus(false, 'Sin conexión');
      }
    );
  } catch (error) {
    console.error("Error al configurar WebSocket:", error);
    UIController.addLog('[ERROR] No se pudo establecer la conexión WebSocket');
    UIController.showToast('Error de conexión', 5000);
  }
}

// Configurar actualización periódica de métricas
function setupMetricsUpdater() {
  // Actualizar métricas cada 2 segundos si hay una llamada activa
  setInterval(() => {
    if (UIController.getCurrentCallSid()) {
      // Obtener métricas del AudioProcessor
      const metrics = AudioProcessor.getLatencyMetrics();

      // Actualizar UI con las métricas
      UIController.updateLatencyMetrics(metrics);
    }
  }, 2000);
}

// Manejar cierre de ventana/pestaña
window.addEventListener('beforeunload', function(e) {
  if (UIController.getCurrentCallSid()) {
    e.preventDefault();
    e.returnValue = '¿Está seguro de que desea salir? Hay una llamada en curso.';
  }
});

// Manejar errores globales
window.addEventListener('error', function(e) {
  console.error('Error global:', e.error);
  UIController.addLog(`[ERROR] ${e.error?.message || 'Error desconocido'}`);
});

// Manejar promesas rechazadas
window.addEventListener('unhandledrejection', function(e) {
  console.error('Promesa rechazada:', e.reason);
  UIController.addLog(`[ERROR] ${e.reason?.message || e.reason || 'Error desconocido'}`);
});