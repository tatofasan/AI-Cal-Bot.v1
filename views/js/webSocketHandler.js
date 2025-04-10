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
      if (onMessageCallback) onMessageCallback(event);
    };

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