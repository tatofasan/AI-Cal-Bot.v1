// Módulo para manejar las conexiones WebSocket del dashboard
const WebSocketClient = (() => {
  // Variables privadas
  let logsWebSocket = null;
  let reconnectTimeout = null;
  let reconnectAttempts = 0;
  const MAX_RECONNECT_ATTEMPTS = 5;
  const INITIAL_RECONNECT_DELAY = 1000; // 1 segundo inicial

  // Establecer conexión al WebSocket para el dashboard
  async function connectToDashboardWebSocket(onMessageCallback, onOpenCallback, onCloseCallback) {
    // Cerrar cualquier conexión existente
    closeConnection();

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';

    // Generamos un sessionId específico para el dashboard con formato especial
    // Esto evita el error "[ERROR] Se requiere un sessionId válido para establecer la conexión"
    const dashboardId = `session_dashboard_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    try {
      console.log("[Dashboard] Conectando con sessionId:", dashboardId);
      logsWebSocket = new WebSocket(`${wsProtocol}//${window.location.host}/logs-websocket?sessionId=${dashboardId}`);

      logsWebSocket.onopen = function() {
        console.log('[Dashboard] Conexión WebSocket establecida');
        reconnectAttempts = 0; // Resetear intentos de reconexión
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

      logsWebSocket.onclose = function(event) {
        console.log(`[Dashboard] Conexión WebSocket cerrada. Código: ${event.code}, Razón: ${event.reason || 'Sin especificar'}`);
        if (onCloseCallback) onCloseCallback(event);

        // Intentar reconexión automática
        attemptReconnect(onMessageCallback, onOpenCallback, onCloseCallback);
      };

      logsWebSocket.onerror = function(error) {
        console.error('[Dashboard] Error en la conexión WebSocket:', error);
      };

      return true;
    } catch (error) {
      console.error('[Dashboard] Error estableciendo conexión WebSocket:', error);

      // Intentar reconexión automática
      attemptReconnect(onMessageCallback, onOpenCallback, onCloseCallback);
      return false;
    }
  }

  // Intentar reconexión en caso de fallos
  function attemptReconnect(onMessageCallback, onOpenCallback, onCloseCallback) {
    clearTimeout(reconnectTimeout);

    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.log('[Dashboard] Máximo de intentos de reconexión alcanzado');
      return;
    }

    reconnectAttempts++;

    // Backoff exponencial: esperar más tiempo con cada intento
    const delay = INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttempts - 1);

    console.log(`[Dashboard] Intentando reconexión en ${delay}ms (intento ${reconnectAttempts})`);

    reconnectTimeout = setTimeout(() => {
      connectToDashboardWebSocket(onMessageCallback, onOpenCallback, onCloseCallback);
    }, delay);
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

  // Verificar si la conexión está establecida
  function isConnected() {
    return logsWebSocket && logsWebSocket.readyState === WebSocket.OPEN;
  }

  // Cerrar la conexión WebSocket
  function closeConnection() {
    clearTimeout(reconnectTimeout);

    if (logsWebSocket) {
      try {
        if (logsWebSocket.readyState === WebSocket.OPEN) {
          logsWebSocket.close();
        }
      } catch (error) {
        console.error('[Dashboard] Error al cerrar conexión WebSocket:', error);
      }
      logsWebSocket = null;
    }
  }

  // API pública
  return {
    connectToDashboardWebSocket,
    sendMessage,
    isConnected,
    closeConnection
  };
})();

// Exportar el módulo
window.WebSocketClient = WebSocketClient;