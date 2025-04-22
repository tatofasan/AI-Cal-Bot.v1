// Módulo para manejar las conexiones WebSocket
const WebSocketHandler = (() => {
  // Variables privadas
  let logsWebSocket = null;
  let sessionId = null;

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

  // Conectar al WebSocket de logs
  function connectToLogsWebSocket(onMessageCallback, onOpenCallback, onCloseCallback) {
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

    logsWebSocket.onmessage = function(event) {
      // Procesar el mensaje antes de pasarlo al callback
      try {
        let data = event.data;

        // Intentar parsear como JSON si es posible
        try {
          data = JSON.parse(event.data);

          // Detectar comando de interrupción
          if (data.type === "interruption" || 
              (data.type === "log" && data.message && data.message.includes("interrupción")) ||
              (typeof data === 'string' && data.includes("interrupción"))) {

            console.log("[WebSocketHandler] Recibido comando de interrupción, limpiando colas de audio");

            // Limpiar cualquier audio reproduciéndose en el cliente
            if (window.AudioProcessor && typeof window.AudioProcessor.clearAudioQueues === 'function') {
              window.AudioProcessor.clearAudioQueues();
            }
          }
        } catch (e) {
          // No es JSON, verificar si contiene texto de interrupción
          if (typeof event.data === 'string' && 
              (event.data.includes("interrupción") || 
               event.data.includes("Interruption") || 
               event.data.includes("Agente"))) {

            console.log("[WebSocketHandler] Mensaje de interrupción detectado:", event.data);

            // Limpiar cualquier audio reproduciéndose en el cliente
            if (window.AudioProcessor && typeof window.AudioProcessor.clearAudioQueues === 'function') {
              window.AudioProcessor.clearAudioQueues();
            }
          }
        }

        // Continuar con el procesamiento normal
        if (onMessageCallback) onMessageCallback(event);
      } catch (error) {
        console.error("[WebSocketHandler] Error procesando mensaje:", error);
        // En caso de error, permitir que el callback original procese el mensaje
        if (onMessageCallback) onMessageCallback(event);
      }
    };

    logsWebSocket.onclose = function() {
      if (onCloseCallback) onCloseCallback();
    };
  }

  // Enviar mensaje a través del WebSocket
  function sendMessage(message) {
    if (logsWebSocket && logsWebSocket.readyState === WebSocket.OPEN) {
      if (typeof message === 'object') {
        logsWebSocket.send(JSON.stringify(message));
      } else {
        logsWebSocket.send(message);
      }
      return true;
    }
    return false;
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
    sendMessage,
    closeConnection,
    getSessionId
  };
})();

// Exportar el módulo
window.WebSocketHandler = WebSocketHandler;