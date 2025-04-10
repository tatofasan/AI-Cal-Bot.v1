// Script principal que inicializa y conecta los módulos
document.addEventListener('DOMContentLoaded', function() {
  // Inicialización de la UI
  UIController.updateMonitorIcon(AudioProcessor.isMonitoring());

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

      // Manejar transcripciones para el chat
      if (log.includes("[LOG] [Twilio] Respuesta del agente:")) {
        const messageText = log.replace("[LOG] [Twilio] Respuesta del agente:", "").trim();
        UIController.addChatMessage(messageText, true);
        UIController.updateConnectionStatus(true);
      } else if (log.includes("[LOG] [Twilio] Transcripción del usuario:")) {
        const messageText = log.replace("[LOG] [Twilio] Transcripción del usuario:", "").trim();
        UIController.addChatMessage(messageText, false);
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