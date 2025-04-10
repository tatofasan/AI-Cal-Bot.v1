// Módulo para manejar las conexiones WebSocket
const WebSocketHandler = (() => {
  // Variables privadas
  let logsWebSocket = null;
  let sessionId = null;

  // Set para controlar transcripciones duplicadas
  const processedTranscriptions = new Set();

  // Generar o recuperar el sessionId
  function getSessionId() {
    if (!sessionId) {
      // Intentar recuperar de localStorage
      sessionId = localStorage.getItem('callBotSessionId');

      // Si no existe, generar uno nuevo
      if (!sessionId) {
        sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
        localStorage.setItem('callBotSessionId', sessionId);
      }
    }

    return sessionId;
  }

  // Generar un hash simple para identificar una transcripción
  function generateTranscriptionHash(text, isBot) {
    return `${isBot ? 'bot' : 'user'}_${text}_${Date.now().toString().substr(0, 8)}`;
  }

  // Procesar datos recibidos
  function processWebSocketData(event) {
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

    // Procesar transcripciones estructuradas
    if (data.type === "transcript") {
      // Extraer texto y tipo
      const text = data.text || "";
      const isBot = Boolean(data.isBot);

      // Crear un hash simple para evitar duplicados
      const transcriptionHash = generateTranscriptionHash(text, isBot);

      // Verificar si ya hemos procesado esta transcripción recientemente
      if (processedTranscriptions.has(transcriptionHash)) {
        console.log("Transcripción duplicada ignorada:", text.substring(0, 30) + "...");
        return;
      }

      // Registrar este hash por un tiempo limitado (3 segundos)
      processedTranscriptions.add(transcriptionHash);
      setTimeout(() => {
        processedTranscriptions.delete(transcriptionHash);
      }, 3000);

      // Mostrar la transcripción
      UIController.addChatMessage(text, isBot);
      if (isBot) {
        UIController.updateConnectionStatus(true);
      }
      return;
    }

    // Procesar logs regulares
    const log = data.message || event.data;
    UIController.addLog(log);

    // Eventos de interrupción
    if (log.includes("Recibido evento de interrupción")) {
      AudioProcessor.clearAudioQueues();
    }
  }

  // Conectar al WebSocket de logs
  function connectToLogsWebSocket(onOpenCallback, onCloseCallback) {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';

    // Incluir sessionId como parámetro de consulta
    const wsSessionId = getSessionId();
    logsWebSocket = new WebSocket(`${wsProtocol}//${window.location.host}/logs-websocket?sessionId=${wsSessionId}`);

    logsWebSocket.onopen = function() {
      if (onOpenCallback) onOpenCallback();

      // Configurar heartbeat para mantener la conexión viva
      const heartbeatInterval = setInterval(() => {
        if (logsWebSocket.readyState === WebSocket.OPEN) { 
          logsWebSocket.send('heartbeat'); 
        } else { 
          clearInterval(heartbeatInterval); 
        }
      }, 30000);

      logsWebSocket.addEventListener('close', () => { 
        clearInterval(heartbeatInterval); 
      });
    };

    logsWebSocket.onmessage = processWebSocketData;

    logsWebSocket.onclose = function() {
      if (onCloseCallback) onCloseCallback();
    };
  }

  // Cerrar la conexión WebSocket
  function closeConnection() {
    if (logsWebSocket && logsWebSocket.readyState === WebSocket.OPEN) {
      logsWebSocket.close();
    }
  }

  // API pública
  return {
    connectToLogsWebSocket,
    closeConnection,
    getSessionId
  };
})();

// Exportar el módulo
window.WebSocketHandler = WebSocketHandler;