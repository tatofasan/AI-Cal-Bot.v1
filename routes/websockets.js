// routes/websockets.js
import unifiedSessionService from "../services/unifiedSessionService.js";

export default function websocketsRoutes(fastify, options) {
  // WebSocket para logs - Simplificado
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
      message: `Conexión establecida para sesión: ${sessionId}`
    }));

    // Si hay URL pública, enviarla
    if (fastify.publicUrl) {
      ws.send(JSON.stringify({
        type: 'info',
        message: `URL pública: ${fastify.publicUrl}`
      }));
    }

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

      // Procesar posibles transcripciones en mensajes del WebSocket
      try {
        processTranscriptionsFromMessage(messageStr, sessionId);
      } catch (error) {
        // Ignorar errores al procesar transcripciones
      }
    });

    ws.on("error", (error) => {
      console.error("[WebSocket Error]", error, { sessionId });
    });
  });

  // WebSocket para el media stream - Simplificado
  fastify.get("/outbound-media-stream", { websocket: true }, async (ws, req) => {
    // Obtener sessionId del querystring
    const sessionId = req.query.sessionId;

    // Log de diagnóstico
    console.log("[WebSocket] Media stream request:", { 
      query: req.query, 
      url: req.url
    });

    // Validar sessionId
    if (!sessionId || !sessionId.startsWith('session_')) {
      console.error("[WebSocket] No se proporcionó sessionId válido para media stream");
      ws.close(1008, "SessionId no proporcionado o inválido");
      return;
    }

    console.info("[WebSocket] Conexión de media stream iniciada con sessionId:", sessionId);

    // Delegar todo el manejo al servicio unificado
    try {
      await unifiedSessionService.handleMediaStream(ws, sessionId);
    } catch (error) {
      console.error("[WebSocket] Error configurando media stream:", error);
      ws.close(1011, "Error interno configurando stream");
    }
  });

  // Función auxiliar para procesar posibles transcripciones en mensajes de texto
  function processTranscriptionsFromMessage(messageText, sessionId) {
    // Detectar transcripciones del usuario
    if (messageText.includes("[Twilio] Transcripción del usuario:")) {
      const text = messageText.replace(/.*Transcripción del usuario:\s*/, "").trim();
      if (text) {
        unifiedSessionService.addTranscription(sessionId, text, 'client');
        console.log(`[WebSocket] Transcripción de usuario capturada para sesión ${sessionId}`);
      }
    } 
    // Detectar respuestas del bot
    else if (messageText.includes("[Twilio] Respuesta del agente:")) {
      const text = messageText.replace(/.*Respuesta del agente:\s*/, "").trim();
      if (text) {
        const speakerType = messageText.includes("[AGENT]") ? 'agent' : 'bot';
        unifiedSessionService.addTranscription(sessionId, text, speakerType);
        console.log(`[WebSocket] Respuesta del ${speakerType} capturada para sesión ${sessionId}`);
      }
    }

    // Intentar procesar como objeto JSON
    try {
      const jsonData = JSON.parse(messageText);

      if (jsonData.type === 'user_transcript' && jsonData.text) {
        unifiedSessionService.addTranscription(sessionId, jsonData.text, 'client');
      }
      else if (jsonData.type === 'agent_response' && jsonData.text) {
        unifiedSessionService.addTranscription(sessionId, jsonData.text, 'bot');
      }
      else if (jsonData.type === 'agent_message' && jsonData.text) {
        unifiedSessionService.addTranscription(sessionId, jsonData.text, 'agent');
      }
    } catch (e) {
      // No es JSON, ignorar
    }
  }
}