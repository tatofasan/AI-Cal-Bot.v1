// Script principal que inicializa los módulos del dashboard
document.addEventListener('DOMContentLoaded', function() {
  // Inicializar controlador de UI
  UIController.init();

  // Añadir log inicial
  UIController.addLog('[INFO] Iniciando Dashboard...');
  UIController.addLog('[INFO] Sistema TalkFlow versión 1.0');

  // Función para procesar las actualizaciones de sesiones
  function processSessionUpdate(data) {
    if (!data || !data.stats) {
      console.error('[Dashboard] Datos inválidos recibidos:', data);
      return;
    }

    // Actualizar estadísticas generales
    UIController.updateStats(data.stats);

    // Si hay información detallada de sesiones, mostrarla
    if (data.stats.sessionDetails && Array.isArray(data.stats.sessionDetails)) {
      UIController.updateSessionsContainer(data.stats.sessionDetails);
    } 
    // Si hay información de sesiones en sessionInfo, usarla
    else if (data.stats.sessionInfo && Array.isArray(data.stats.sessionInfo)) {
      UIController.updateSessionsContainer(data.stats.sessionInfo);
    }
    // Sino, mostrar solo los IDs como sesiones básicas
    else if (data.stats.sessions && Array.isArray(data.stats.sessions)) {
      const basicSessions = data.stats.sessions.map(sessionId => {
        return {
          id: sessionId,
          createdAt: Date.now(), // No tenemos el timestamp real
          lastActivity: Date.now(),
          logClients: { size: 0 },
          callSid: null,
          isAgentActive: false
        };
      });
      UIController.updateSessionsContainer(basicSessions);
    }
  }

  // Función para procesar mensajes de WebSocket
  function processWebSocketMessage(event) {
    try {
      const messageText = event.data;

      // Primero registrar el mensaje en el panel de logs del sistema
      UIController.addLog(messageText);

      // Intentar identificar si es un mensaje procesable
      // 1. Intentar parsear como JSON
      try {
        const data = JSON.parse(messageText);

        // Si es una actualización de sesión, procesarla
        if (data.type === 'session_update') {
          // Solicitar actualización de datos
          SessionMonitor.refreshSessions(processSessionUpdate);
        } 
        // Si es una transcripción del usuario o del bot, procesarla para las transcripciones
        else if (data.type === 'user_transcript' || data.type === 'agent_response' || 
                 data.type === 'agent_speech' || data.type === 'client_audio') {
          processTranscriptionMessage(data);
        }
      } catch (e) {
        // No es JSON, procesar como texto normal

        // Comprobar si es un mensaje de transcripción
        if (messageText.includes("[Twilio] Transcripción del usuario:") || 
            messageText.includes("[Twilio] Respuesta del agente:") ||
            (messageText.includes("[AgentVoice]") && 
             (messageText.includes("Mensaje del agente:") || 
              messageText.includes("Respuesta sintetizada:")))) {

          // Ya se procesa en UIController.addLog, no necesitamos hacer nada adicional aquí
        }
      }
    } catch (error) {
      console.error("[Dashboard] Error procesando mensaje:", error);
    }
  }

  // Procesar mensajes específicos de transcripción
  function processTranscriptionMessage(data) {
    const sessionId = data.sessionId;
    if (!sessionId) return;

    if (data.type === 'user_transcript' && data.text) {
      UIController.addTranscript(sessionId, data.text, 'client');
    } 
    else if (data.type === 'agent_response' && data.text) {
      UIController.addTranscript(sessionId, data.text, 'bot');
    }
    else if (data.type === 'agent_speech' && data.text) {
      UIController.addTranscript(sessionId, data.text, data.isAgent ? 'agent' : 'bot');
    }
  }

  // Conectar al WebSocket
  async function setupDashboardConnection() {
    UIController.addLog('[INFO] Conectando al servidor...');

    try {
      await WebSocketClient.connectToDashboardWebSocket(
        // Callback onMessage - recibir mensajes del WebSocket
        processWebSocketMessage,

        // Callback onOpen - cuándo se establece la conexión
        function() {
          UIController.updateConnectionStatus(true);
          UIController.addLog('[INFO] Conexión establecida con el servidor');

          // Iniciar monitoreo de sesiones
          SessionMonitor.startMonitoring(processSessionUpdate);
        },

        // Callback onClose - cuándo se cierra la conexión
        function() {
          UIController.updateConnectionStatus(false, 'Desconectado');
          UIController.addLog('[INFO] Conexión cerrada con el servidor');

          // Detener monitoreo de sesiones
          SessionMonitor.stopMonitoring();
        }
      );
    } catch (error) {
      console.error('[Dashboard] Error estableciendo conexión:', error);
      UIController.addLog('[ERROR] No se pudo conectar al servidor');
      UIController.updateConnectionStatus(false, 'Error de conexión');
    }
  }

  // Configurar event listeners adicionales
  function setupEventListeners() {
    // Listener para solicitud de actualización manual
    window.addEventListener('dashboard:requestRefresh', async function() {
      UIController.addLog('[INFO] Actualización manual solicitada');
      try {
        await SessionMonitor.refreshSessions(processSessionUpdate);
      } catch (error) {
        console.error('[Dashboard] Error en actualización manual:', error);
      }
    });

    // Listener para cuando la ventana pierde el foco
    window.addEventListener('blur', function() {
      // Pausar actualizaciones automáticas para ahorrar recursos
      SessionMonitor.stopMonitoring();
      UIController.addLog('[INFO] Monitoreo pausado (ventana en segundo plano)');
    });

    // Listener para cuando la ventana recupera el foco
    window.addEventListener('focus', function() {
      // Reanudar actualizaciones automáticas
      SessionMonitor.startMonitoring(processSessionUpdate);
      UIController.addLog('[INFO] Monitoreo reanudado (ventana en primer plano)');
    });
  }

  // Iniciar la aplicación
  setupEventListeners();
  setupDashboardConnection();
});