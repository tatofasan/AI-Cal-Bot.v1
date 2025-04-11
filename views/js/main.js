// Script principal que inicializa y conecta los módulos
document.addEventListener('DOMContentLoaded', function() {
  // Inicialización de la UI
  UIController.updateMonitorIcon(AudioProcessor.isMonitoring());
  UIController.enableTakeoverButton(false);

  // Configurar event listeners
  setupEventListeners();

  // Conectar al WebSocket
  setupWebSocket();
});

// Configurar los event listeners
function setupEventListeners() {
  // Event listener para el botón de monitoreo
  UIController.elements.monitorButton.addEventListener('click', function() {
    const isMonitoring = AudioProcessor.toggleMonitoring();
    UIController.updateMonitorIcon(isMonitoring);
  });

  // Event listener para el botón de llamada
  UIController.elements.callButton.addEventListener('click', async function() {
    const currentCallSid = UIController.getCurrentCallSid();

    // Si no hay llamada activa, iniciarla
    if (!currentCallSid) {
      startNewCall();
    } else {
      // Si hay una llamada activa, finalizarla
      endCurrentCall();
    }
  });

  // Event listener para el botón de toma de control
  UIController.elements.takeoverButton.addEventListener('click', async function() {
    const isAgentActive = UIController.isAgentActive();

    if (!isAgentActive) {
      // Iniciar control del agente
      const success = await AgentVoiceCapture.startCapturing(WebSocketHandler.getSessionId());
      if (success) {
        UIController.updateTakeoverButton(true);
        UIController.addLog('[INFO] Tomando control de la llamada como agente humano');
      } else {
        alert("No se pudo activar el micrófono. Por favor, verifica los permisos.");
      }
    } else {
      // Detener control del agente
      AgentVoiceCapture.stopCapturing();
      UIController.updateTakeoverButton(false);
      UIController.addLog('[INFO] Dejando el control de la llamada');
    }
  });
}

// Iniciar una nueva llamada
async function startNewCall() {
  // Limpiar el chat para la nueva llamada
  UIController.clearChat();

  // Mostrar estado de "cargando" en el botón
  UIController.updateCallButton(false, true);

  try {
    // Obtener datos del formulario
    const callData = UIController.getCallFormData();

    // Log de depuración para verificar que voice_name está correctamente incluido
    console.log("Enviando datos de llamada:", callData);

    // Llamar a la API
    const result = await ApiService.initiateCall(callData);

    // Actualizar UI con la llamada activa
    UIController.setCurrentCallSid(result.callSid);
    UIController.updateCallButton(true);
    UIController.updateConnectionStatus(true);

    // Si estaba en modo agente, desactivarlo para la nueva llamada
    if (UIController.isAgentActive()) {
      AgentVoiceCapture.stopCapturing();
      UIController.updateTakeoverButton(false);
    }
  } catch (error) {
    console.error(error);
    UIController.updateCallButton(false);
    alert(error.toString());
  }
}

// Finalizar la llamada actual
async function endCurrentCall() {
  try {
    const callSid = UIController.getCurrentCallSid();
    const result = await ApiService.endCall(callSid);

    console.log("Llamada cortada:", result.message);
    AudioProcessor.clearAudioQueues();

    // Si estaba en modo agente, desactivarlo
    if (UIController.isAgentActive()) {
      AgentVoiceCapture.stopCapturing();
      UIController.updateTakeoverButton(false);
    }

    // Actualizar UI para reflejar llamada finalizada
    UIController.setCurrentCallSid(null);
    UIController.updateCallButton(false);
    UIController.updateConnectionStatus(false, 'Llamada cortada');
  } catch (error) {
    console.error("Error al cortar la llamada:", error);
    alert("Error al cortar la llamada.");
  }
}

// Configurar la conexión WebSocket
function setupWebSocket() {
  WebSocketHandler.connectToLogsWebSocket(
    // Callback onMessage
    function(event) {
      let data;
      try {
        data = JSON.parse(event.data);
      }
      catch (e) {
        data = { type: "log", message: event.data };
      }

      // Procesar según el tipo de mensaje
      if (data.type === "audio") {
        // Usar messageId si disponible (para prevenir duplicados)
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

      // Procesar logs y transcripciones
      const log = data.message || event.data;
      console.log("Log recibido:", log);

      if (log.includes("Recibido evento de interrupción")) {
        AudioProcessor.clearAudioQueues();
      }

      UIController.addLog(log);

      // Detectar si un agente tomó o dejó el control
      if (log.includes("[INFO] Un agente ha tomado el control de la conversación")) {
        UIController.addLog("[INFO] Un agente humano está controlando la conversación");
      } else if (log.includes("[INFO] El agente ha dejado el control de la conversación")) {
        UIController.addLog("[INFO] El bot ha retomado el control de la conversación");
      }

      // Manejar transcripciones para el chat
      if (log.includes("[LOG] [Twilio] Respuesta del agente:")) {
        const messageText = log.replace("[LOG] [Twilio] Respuesta del agente:", "").trim();
        // Determinar si es un mensaje de agente humano o del bot
        const isFromHumanAgent = log.includes("[AGENT]");
        UIController.addChatMessage(messageText, true, isFromHumanAgent);
        UIController.updateConnectionStatus(true);
      } else if (log.includes("[LOG] [Twilio] Transcripción del usuario:")) {
        const messageText = log.replace("[LOG] [Twilio] Transcripción del usuario:", "").trim();
        UIController.addChatMessage(messageText, false);
      } else if (log.includes("[LOG] [AgentVoice]")) {
        // Capturar mensajes específicos del agente
        if (log.includes("Respuesta sintetizada:")) {
          const messageText = log.replace(/.*Respuesta sintetizada: /g, "").trim();
          UIController.addChatMessage(messageText, true, true);
        }
      }
    },

    // Callback onOpen
    function() {
      UIController.addLog('[INFO] Conexión a logs establecida\n');
    },

    // Callback onClose
    function() {
      UIController.addLog('[Conexión a logs cerrada]\n');
      UIController.updateConnectionStatus(false);
    }
  );
}