// Módulo para manejar las conexiones WebSocket
const WebSocketHandler = (() => {
  // Variables privadas
  let logsWebSocket = null;

  // Conectar al WebSocket de logs
  function connectToLogsWebSocket(onMessageCallback, onOpenCallback, onCloseCallback) {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    logsWebSocket = new WebSocket(wsProtocol + '//' + window.location.host + '/logs-websocket');

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
    closeConnection
  };
})();

// Exportar el módulo
window.WebSocketHandler = WebSocketHandler;