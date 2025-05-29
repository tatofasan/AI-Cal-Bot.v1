// src/routes/websockets.js
import { setupMediaStream } from "../services/elevenLabsService.js";
import { 
  registerLogClient, 
  removeLogClient, 
  validateSessionId
} from '../utils/sessionManager.js';
import { getSession, addTranscription, getSessionStats } from "../services/sessionService.js";

export default function websocketsRoutes(fastify, options) {
  // WebSocket para logs
  fastify.get("/logs-websocket", { websocket: true }, (ws, req) => {
    // Obtener sessionId del querystring
    const sessionId = req.query.sessionId;

    // Validar que se proporcionó un sessionId y que sea válido
    if (!sessionId || !validateSessionId(sessionId)) {
      console.error("[WebSocket] Error: conexión websocket sin sessionId válido");
      ws.send("[ERROR] Se requiere un sessionId válido para establecer la conexión");
      ws.close(1008, "SessionId inválido o no proporcionado");
      return;
    }

    // Registrar nuevo cliente en el gestor de sesiones
    registerLogClient(sessionId, ws);

    // Asociar el sessionId directamente con el WebSocket para usarlo en respuestas
    ws.sessionId = sessionId;

    ws.send(`[INFO] Conexión establecida para session: ${sessionId}`);

    if (fastify.publicUrl) {
      ws.send(`[INFO] URL pública: ${fastify.publicUrl}`);
    }

    ws.on('close', () => {
      // Eliminar del gestor de sesiones
      removeLogClient(ws);
    });

    ws.on("message", (message) => {
      if (message.toString() === "heartbeat") {
        ws.send("[HEARTBEAT] Conexión activa");
      }

      // Intentar capturar mensajes con transcripciones
      try {
        const messageText = message.toString();

        // Procesar posibles transcripciones en mensajes del WebSocket
        processTranscriptionsFromMessage(messageText, sessionId);

      } catch (error) {
        // Ignorar errores al procesar transcripciones
      }
    });

    ws.on("error", (error) => {
      console.error("[WebSocket Error]", error, { sessionId });
    });

    ws.on("close", () => {
      console.log("[INFO] Cliente de logs desconectado", { sessionId });
    });
  });

  // WebSocket para el media stream outbound - Simplificado
  fastify.get("/outbound-media-stream", { websocket: true }, async (ws, req) => {
    // Obtener sessionId del querystring
    const sessionId = req.query.sessionId;

    // Log de diagnóstico
    console.log("[WebSocket] Media stream request:", { 
      query: req.query, 
      url: req.url
    });

    // Si no hay sessionId, intentar obtener el último activo
    if (!sessionId) {
      try {
        const stats = getSessionStats();
        const sessionInfo = stats.sessionInfo || [];

        if (sessionInfo.length > 0) {
          const sortedSessions = [...sessionInfo].sort((a, b) => b.createdAt - a.createdAt);
          const latestSessionId = sortedSessions[0].id;

          console.log(`[WebSocket] Usando la última sesión activa: ${latestSessionId}`);
          ws.sessionId = latestSessionId;

          // Configurar el media stream con el SDK
          await setupMediaStream(ws, latestSessionId);
          return;
        }
      } catch (error) {
        console.error("[WebSocket] Error obteniendo sesiones:", error);
      }

      console.error("[WebSocket] No se proporcionó sessionId y no hay sesiones activas");
      ws.close(1008, "SessionId no proporcionado");
      return;
    }

    console.info("[WebSocket] Conexión de media stream iniciada con sessionId:", sessionId);

    // Asociar sessionId con el WebSocket
    ws.sessionId = sessionId;

    // Configurar el media stream con el SDK
    try {
      await setupMediaStream(ws, sessionId);
    } catch (error) {
      console.error("[WebSocket] Error configurando media stream:", error);
      ws.close(1011, "Error interno configurando stream");
    }
  });

  // Función auxiliar para procesar posibles transcripciones en mensajes
  function processTranscriptionsFromMessage(messageText, sessionId) {
    // Detectar transcripciones del usuario
    if (messageText.includes("[Twilio] Transcripción del usuario:")) {
      const text = messageText.replace(/.*Transcripción del usuario:\s*/, "").trim();
      if (text) {
        addTranscription(sessionId, text, 'client');
        console.log(`[WebSocket] Transcripción de usuario capturada: "${text.substring(0, 30)}..."`, { sessionId });
      }
    } 
    // Detectar respuestas del bot
    else if (messageText.includes("[Twilio] Respuesta del agente:")) {
      const text = messageText.replace(/.*Respuesta del agente:\s*/, "").trim();
      if (text) {
        const speakerType = messageText.includes("[AGENT]") ? 'agent' : 'bot';
        addTranscription(sessionId, text, speakerType);
        console.log(`[WebSocket] Respuesta del ${speakerType} capturada: "${text.substring(0, 30)}..."`, { sessionId });
      }
    }

    // Intentar procesar como objeto JSON
    try {
      const jsonData = JSON.parse(messageText);

      if (jsonData.type === 'user_transcript' && jsonData.text) {
        addTranscription(sessionId, jsonData.text, 'client');
      }
      else if (jsonData.type === 'agent_response' && jsonData.text) {
        addTranscription(sessionId, jsonData.text, 'bot');
      }
      else if (jsonData.type === 'agent_message' && jsonData.text) {
        addTranscription(sessionId, jsonData.text, 'agent');
      }
    } catch (e) {
      // No es JSON, ignorar
    }
  }
}