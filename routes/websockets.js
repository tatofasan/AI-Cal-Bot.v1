// routes/websockets.js (MODIFICADO para Phone API)
import unifiedSessionService from "../services/unifiedSessionService.js";

export default function websocketsRoutes(fastify, options) {
  // WebSocket para logs - SIMPLIFICADO para Phone API
  fastify.get("/logs-websocket", { websocket: true }, (ws, req) => {
    // Obtener sessionId del querystring
    const sessionId = req.query.sessionId;

    // Validar que se proporcionó un sessionId
    if (!sessionId || !sessionId.startsWith('session_')) {
      console.error("[WebSocket] Error: conexión websocket sin sessionId válido");
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Se requiere un sessionId válido para establecer la conexión'
      }));
      ws.close(1008, "SessionId inválido o no proporcionado");
      return;
    }

    // Registrar cliente en el servicio unificado
    unifiedSessionService.addLogClient(sessionId, ws);

    // Enviar confirmación
    ws.send(JSON.stringify({
      type: 'connection_established',
      sessionId: sessionId,
      message: `Conexión establecida para sesión: ${sessionId}`,
      phoneAPI: true // Indicar que usamos Phone API
    }));

    // Manejar cierre
    ws.on('close', () => {
      unifiedSessionService.removeLogClient(ws);
      console.log("[WebSocket] Cliente de logs desconectado", { sessionId });
    });

    // Manejar mensajes
    ws.on("message", (message) => {
      const messageStr = message.toString();

      if (messageStr === "heartbeat") {
        ws.send(JSON.stringify({
          type: 'heartbeat',
          timestamp: Date.now()
        }));
        return;
      }

      // Phone API maneja las transcripciones a través de webhooks
      // Por lo que este procesamiento es menos crítico
      try {
        const jsonData = JSON.parse(messageStr);

        // Procesar comandos del cliente si es necesario
        if (jsonData.type === 'command') {
          console.log('[WebSocket] Comando recibido:', jsonData.command);
          // Procesar comandos según sea necesario
        }
      } catch (e) {
        // No es JSON, ignorar o procesar como texto
      }
    });

    ws.on("error", (error) => {
      console.error("[WebSocket Error]", error, { sessionId });
    });
  });

  /**
   * ELIMINADO: /outbound-media-stream
   * Ya no es necesario con Phone API ya que ElevenLabs maneja
   * el streaming de audio internamente
   */
}