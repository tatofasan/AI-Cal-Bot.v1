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
      // Interrumpir cualquier reproducción de audio en curso
      AudioProcessor.clearAudioQueues();

      // Añadir un mensaje de log
      UIController.addLog('[INFO] Interrumpiendo bot y tomando control de la llamada...');

      // Iniciar control del agente
      const success = await AgentVoiceCapture.startCapturing(WebSocketHandler.getSessionId());
      if (success) {
        UIController.updateTakeoverButton(true);
        UIController.addLog('[INFO] Tomando control de la llamada como agente humano');

        // Añadir mensaje al chat indicando que el agente ha tomado el control
        UIController.addChatMessage("El agente humano ha tomado el control de la llamada", true, true);
      } else {
        alert("No se pudo activar el micrófono. Por favor, verifica los permisos.");
      }
    } else {
      // Detener control del agente
      AgentVoiceCapture.stopCapturing();
      UIController.updateTakeoverButton(false);
      UIController.addLog('[INFO] Dejando el control de la llamada');

      // Añadir mensaje al chat indicando que el agente ha dejado el control
      UIController.addChatMessage("El agente humano ha dejado el control de la llamada", true, true);
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

    // Añadir mensaje de inicio de llamada al chat
    UIController.addChatMessage("Llamada iniciada. Conectando...", true, false);

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

    // Añadir mensaje de finalización al chat
    UIController.addChatMessage("Llamada finalizada", true, false);
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
        // Si el agente está activo, no reproducir el audio del bot
        if (UIController.isAgentActive()) {
          console.log("[WebSocket] Audio del bot ignorado porque el agente está activo");
          return;
        }

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

      // Verificar si es una interrupción
      if (data.type === "interruption" || 
          (typeof data.message === 'string' && data.message.includes("interrupción"))) {
        console.log("[WebSocket] Interrupción detectada, limpiando colas de audio");
        AudioProcessor.clearAudioQueues();
      }

      // Procesar logs y transcripciones
      const log = data.message || event.data;
      console.log("Log recibido:", log);

      if (log.includes("Recibido evento de interrupción") || 
          log.includes("interrupción") || 
          log.includes("Agente") || 
          log.includes("interrupting")) {
        console.log("[WebSocket] Comando de interrupción detectado en logs");
        AudioProcessor.clearAudioQueues();
      }

      UIController.addLog(log);

      // Detectar si un agente tomó o dejó el control
      if (log.includes("[INFO] Un agente ha tomado el control de la conversación")) {
        UIController.addLog("[INFO] Un agente humano está controlando la conversación");
        AudioProcessor.clearAudioQueues();
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
        if (log.includes("Respuesta sintetizada:") || log.includes("Mensaje del agente:")) {
          // Extraer el mensaje del log
          let messageText;
          if (log.includes("Respuesta sintetizada:")) {
            messageText = log.replace(/.*Respuesta sintetizada: /g, "").trim();
          } else {
            messageText = log.replace(/.*Mensaje del agente: /g, "").trim();
          }
          // Añadir el mensaje al chat como agente humano
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