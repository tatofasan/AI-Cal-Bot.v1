// src/routes/websockets.js
import WebSocket from "ws";
import { setupMediaStream } from "../services/elevenlabs/mediaStreamService.js";
import { logClients } from '../utils/logger.js';
import { 
  registerLogClient, 
  removeLogClient, 
  getOrCreateSession
} from '../utils/sessionManager.js';
import { orchestrator } from "../services/orchestrator/index.js";

export default function websocketsRoutes(fastify, options) {
  // WebSocket para logs
  fastify.get("/logs-websocket", { websocket: true }, (ws, req) => {
    // Obtener sessionId del querystring o generar uno nuevo si no existe
    const sessionId = req.query.sessionId || `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

    // Registrar nuevo cliente en el gestor de sesiones
    registerLogClient(sessionId, ws);

    // También registrar en logClients para mantener compatibilidad con código existente
    logClients.add(ws);

    ws.send("[INFO] Conexión establecida con logs");
    ws.send(`[INFO] Session ID: ${sessionId}`);

    if (fastify.publicUrl) {
      ws.send(`[INFO] URL pública: ${fastify.publicUrl}`);
    }

    ws.on('close', () => {
      // Eliminar del gestor de sesiones
      removeLogClient(ws);

      // También eliminar de logClients para mantener compatibilidad
      logClients.delete(ws);
    });

    ws.on("message", (message) => {
      try {
        const data = JSON.parse(message.toString());

        // Si es un comando para el orquestador, procesarlo
        if (data.command && data.command !== "heartbeat") {
          orchestrator.handleFrontendCommand(
            data.command,
            data.params || {},
            sessionId
          );
          return;
        }

        // Heartbeat estándar
        if (message.toString() === "heartbeat" || data.command === "heartbeat") {
          ws.send("[HEARTBEAT] Conexión activa");
        }
      } catch (e) {
        // Si no es JSON o hay error, tratar como mensaje normal
        if (message.toString() === "heartbeat") {
          ws.send("[HEARTBEAT] Conexión activa");
        }
      }
    });

    ws.on("error", (error) => {
      console.error("[WebSocket Error]", error, { sessionId });
    });

    ws.on("close", () => {
      console.log("[INFO] Cliente de logs desconectado", { sessionId });
    });
  });

  // WebSocket para el media stream outbound
  fastify.get("/outbound-media-stream", { websocket: true }, (ws, req) => {
    // Debugging: Registrar todas las queries recibidas
    console.log("[Server] WebSocket query params:", req.query);

    // Obtener sessionId del querystring o de los parámetros del Stream
    let sessionId = req.query.sessionId;

    // Comprobar si fue proporcionado como un parámetro de mensaje inicial en la conexión
    if (!sessionId && req.body && req.body.sessionId) {
      sessionId = req.body.sessionId;
      console.log("[Server] sessionId obtenido del cuerpo del mensaje:", sessionId);
    }

    // Si todavía no hay sessionId, intentar obtenerlo de los headers personalizados
    if (!sessionId && req.headers && req.headers['x-session-id']) {
      sessionId = req.headers['x-session-id'];
      console.log("[Server] sessionId obtenido de los headers:", sessionId);
    }

    // Si no hay sessionId, crear uno nuevo
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      console.log("[Server] Generando nuevo sessionId porque no se proporcionó uno:", sessionId);
    }

    console.info("[Server] Conexión WebSocket para stream de medios iniciada con sessionId:", sessionId);

    // Asociar sessionId con el WebSocket
    ws.sessionId = sessionId;

    // Configurar el media stream con el sessionId utilizando el orquestrador
    setupMediaStream(ws, sessionId);

    // Manejar mensajes iniciales que podrían contener el sessionId
    ws.on("message", function firstMessage(message) {
      try {
        const data = JSON.parse(message.toString());
        if (data.sessionId && !ws.sessionId) {
          console.log("[Server] sessionId recibido en primer mensaje:", data.sessionId);
          ws.sessionId = data.sessionId;

          // Notificar al orquestador del cambio de sessionId
          orchestrator.streamManager.removeConnection(ws);
          setupMediaStream(ws, data.sessionId);
        }
        // Eliminar este handler después del primer mensaje
        ws.removeListener("message", firstMessage);
      } catch (e) {
        // No es un JSON o no tiene sessionId, ignorar
      }
    });
  });
}