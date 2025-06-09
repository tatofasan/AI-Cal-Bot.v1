// views/js/webSocketHandler.js (MODIFICADO)
// Módulo para manejar las conexiones WebSocket
const WebSocketHandler = (() => {
  // Variables privadas
  let logsWebSocket = null;
  let sessionId = null;

  // Solicitar un nuevo sessionId desde el servidor
  async function requestSessionId() {
    try {
      const response = await fetch('/create-session');
      if (!response.ok) {
        throw new Error(`Error requesting session: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      if (data.success && data.sessionId) {
        sessionId = data.sessionId;
        console.log(`[WebSocketHandler] Nuevo sessionId obtenido del servidor: ${sessionId}`);
        return sessionId;
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error) {
      console.error('[WebSocketHandler] Error obteniendo sessionId:', error);
      sessionId = `local_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      console.warn(`[WebSocketHandler] Usando sessionId local de emergencia: ${sessionId}`);
      return sessionId;
    }
  }

  // Obtener el sessionId actual, o solicitar uno nuevo si no existe
  async function getSessionId() {
    if (!sessionId) {
      await requestSessionId();
    }
    return sessionId;
  }

  // Conectar al WebSocket de logs - SIMPLIFICADO para Phone API
  async function connectToLogsWebSocket(onMessageCallback, onOpenCallback, onCloseCallback) {
    await getSessionId();

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    logsWebSocket = new WebSocket(`${wsProtocol}//${window.location.host}/logs-websocket?sessionId=${sessionId}`);

    logsWebSocket.onopen = function() {
      if (onOpenCallback) onOpenCallback();

      // Heartbeat para mantener la conexión viva
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
      try {
        let data = event.data;

        // Intentar parsear como JSON
        try {
          data = JSON.parse(event.data);

          // SIMPLIFICADO: Phone API maneja el audio internamente
          // Solo procesamos eventos de estado y transcripciones

          // Procesar actualizaciones de estado de llamada (ambos formatos)
          if (data.type === "call_status_update" || data.type === "call_status") {
            console.log(`[WebSocketHandler] Estado de llamada: ${data.status} - ${data.message}`);

            if (window.UIController && typeof window.UIController.updateCallStatus === 'function') {
              window.UIController.updateCallStatus(data.status, data.message);
            }

            // Para estados finales, actualizar UI
            if (['ended', 'failed', 'busy', 'no-answer', 'canceled'].includes(data.status)) {
              if (window.UIController) {
                window.UIController.updateCallButton(false);
                window.UIController.setCurrentCallSid(null);
              }
            }

            // Para estados activos, actualizar UI
            if (['active', 'connected', 'ringing'].includes(data.status)) {
              if (window.UIController) {
                window.UIController.updateCallButton(true);
                if (data.phoneCallId) {
                  window.UIController.setCurrentCallSid(data.phoneCallId);
                }
              }
            }
          }

          // Procesar transcripciones
          if (data.type === "user_transcript") {
            if (window.UIController) {
              window.UIController.addChatMessage(data.text, 'client');
            }
          }

          if (data.type === "agent_response") {
            if (window.UIController) {
              window.UIController.addChatMessage(data.text, 'bot');
            }
          }

          // Nuevos eventos de Phone API
          if (data.type === "user_speaking") {
            console.log(`[WebSocketHandler] Usuario ${data.status === 'started' ? 'hablando' : 'dejó de hablar'}`);
          }

          if (data.type === "agent_speaking") {
            console.log(`[WebSocketHandler] Agente ${data.status === 'started' ? 'hablando' : 'dejó de hablar'}`);
          }

        } catch (e) {
          // No es JSON, procesar como texto de log
        }

        // Continuar con el procesamiento normal
        if (onMessageCallback) onMessageCallback(event);
      } catch (error) {
        console.error("[WebSocketHandler] Error procesando mensaje:", error);
        if (onMessageCallback) onMessageCallback(event);
      }
    };

    logsWebSocket.onclose = function() {
      if (onCloseCallback) onCloseCallback();
    };

    logsWebSocket.onerror = function(error) {
      console.error("[WebSocketHandler] Error en WebSocket:", error);
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