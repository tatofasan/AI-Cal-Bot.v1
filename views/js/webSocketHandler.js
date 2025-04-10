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

    // Procesar eventos de interrupción primero para asegurar respuesta inmediata
    if (data.type === "control" && data.action === "clear_buffer") {
      console.log("[WebSocketHandler] Recibido evento de interrupción, limpiando buffer de audio");
      // Detener solo el audio del bot para permitir que el usuario siga escuchando
      AudioProcessor.stopAllBotAudio();
      return;
    }

    // También detectar interrupciones en mensajes de texto
    if (typeof data.message === 'string' && data.message.includes("Recibido evento de interrupción")) {
      console.log("[WebSocketHandler] Detectada interrupción en log");
      AudioProcessor.stopAllBotAudio();
    }

    // Procesar según el tipo de mensaje
    if (data.type === "audio" || data.messageType === "bot_audio") {
      // Usar messageId si disponible (para prevenir duplicados)
      const messageId = data.id || null;
      // Comprobar si el payload está en diferentes niveles de anidación
      const payload = data.payload || data.audio?.chunk || data.audio_event?.audio_base_64;
      if (payload) {
        AudioProcessor.playBotAudioChunk(payload, messageId);
      }
      return;
    }

    if (data.type === "client_audio" || data.messageType === "client_audio") {
      const messageId = data.id || null;
      const payload = data.payload?.user_audio_chunk || data.payload;
      if (payload) {
        AudioProcessor.playClientAudioChunk(payload, messageId);
      }
      return;
    }

    // Procesar transcripciones estructuradas
    if (data.type === "transcript") {
      // Extraer texto y tipo
      const text = data.text || data.payload?.text || "";
      const isBot = data.isBot !== undefined ? data.isBot : (data.payload?.isBot !== undefined ? data.payload.isBot : false);

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

      // Si es una nueva respuesta del bot, limpiar el audio previo para evitar superposición
      if (isBot) {
        AudioProcessor.stopAllBotAudio();
      }

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