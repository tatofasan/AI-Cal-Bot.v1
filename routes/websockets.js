
// src/routes/websockets.js
import WebSocket from "ws";
import { setupMediaStream } from "../services/elevenLabsService.js";
import { logClients } from '../utils/logger.js';

export default function websocketsRoutes(fastify, options) {
  // WebSocket para logs
  fastify.get("/logs-websocket", { websocket: true }, (ws, req) => {
    // Registrar nuevo cliente
    logClients.add(ws);
    
    ws.send("[INFO] Conexión establecida con logs");
    
    if (fastify.publicUrl) {
      ws.send(`[INFO] URL pública: ${fastify.publicUrl}`);
    }

    ws.on('close', () => {
      logClients.delete(ws);
    });

    ws.on("message", (message) => {
      if (message.toString() === "heartbeat") {
        ws.send("[HEARTBEAT] Conexión activa");
      }
    });

    ws.on("error", (error) => {
      console.error("[WebSocket Error]", error);
    });

    ws.on("close", () => {
      console.log("[INFO] Cliente de logs desconectado");
    });
  });

  // WebSocket para el media stream outbound
  fastify.get("/outbound-media-stream", { websocket: true }, (ws, req) => {
    console.info("[Server] Conexión WebSocket para stream de medios iniciada");
    setupMediaStream(ws);
  });
}
