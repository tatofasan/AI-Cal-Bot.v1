// Script principal que inicializa los módulos del dashboard
document.addEventListener('DOMContentLoaded', function() {
  console.log('[DashboardMain] Inicializando...');

  // Verificar que los módulos estén disponibles
  if (!window.UIController) {
    console.error('[DashboardMain] ERROR: UIController no está disponible');
  } else {
    console.log('[DashboardMain] UIController cargado correctamente');
  }

  if (!window.CallMonitor) {
    console.error('[DashboardMain] ERROR: CallMonitor no está disponible');
  } else {
    console.log('[DashboardMain] CallMonitor cargado correctamente');
  }

  if (!window.WebSocketClient) {
    console.error('[DashboardMain] ERROR: WebSocketClient no está disponible');
  } else {
    console.log('[DashboardMain] WebSocketClient cargado correctamente');
  }

  // Inicializar controlador de UI
  UIController.init();

  // Añadir log inicial
  UIController.addLog('[INFO] Iniciando Dashboard...');
  UIController.addLog('[INFO] Sistema TalkFlow versión 1.0');

  // Función para procesar las actualizaciones de llamadas
  function processCallUpdate(data) {
    console.log('[DashboardMain] Procesando actualización de llamadas:', data);
    if (!data || !data.calls) {
      console.error('[Dashboard] Datos inválidos recibidos:', data);
      return;
    }

    // Actualizar estadísticas generales
    UIController.updateStats(data);

    // Actualizar el contenedor de llamadas
    UIController.updateCallsContainer(data.calls);
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
        if (data.type === 'session_update' || data.type === 'call_update') {
          // Solicitar actualización de datos
          CallMonitor.refreshCalls(processCallUpdate);
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
    const callId = data.sessionId;
    if (!callId) return;

    // Solicitar refrescar transcripciones si está viendo esta llamada
    const selectedCallId = document.getElementById('callSelector').value;
    if (selectedCallId === callId) {
      UIController.fetchTranscripts(callId);
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

          // Iniciar monitoreo de llamadas
          CallMonitor.startMonitoring(processCallUpdate);
        },

        // Callback onClose - cuándo se cierra la conexión
        function() {
          UIController.updateConnectionStatus(false, 'Desconectado');
          UIController.addLog('[INFO] Conexión cerrada con el servidor');

          // Detener monitoreo de llamadas
          CallMonitor.stopMonitoring();
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
        await CallMonitor.refreshCalls(processCallUpdate);
      } catch (error) {
        console.error('[Dashboard] Error en actualización manual:', error);
      }
    });

    // Listener para cuando la ventana pierde el foco
    window.addEventListener('blur', function() {
      // Pausar actualizaciones automáticas para ahorrar recursos
      if (window.CallMonitor) {
        CallMonitor.stopMonitoring();
        UIController.addLog('[INFO] Monitoreo pausado (ventana en segundo plano)');
      }
    });

    // Listener para cuando la ventana recupera el foco
    window.addEventListener('focus', function() {
      // Reanudar actualizaciones automáticas
      if (window.CallMonitor) {
        CallMonitor.startMonitoring(processCallUpdate);
        UIController.addLog('[INFO] Monitoreo reanudado (ventana en primer plano)');
      }
    });
  }

  // Iniciar la aplicación
  try {
    setupEventListeners();
    setupDashboardConnection();

    // Hacer una actualización inicial después de un breve retraso
    setTimeout(() => {
      console.log('[DashboardMain] Solicitando actualización inicial...');
      if (window.CallMonitor) {
        CallMonitor.refreshCalls(processCallUpdate);
      }
    }, 1000);
  } catch (error) {
    console.error('[DashboardMain] Error durante la inicialización:', error);
  }
});