import WebSocket from "ws";
import { logClients } from "../utils/logger.js";
import { setupMediaStream } from "../services/elevenLabsService.js";

export default async function websocketsRoutes(fastify, options) {
  // WebSocket para logs
  fastify.get("/logs-websocket", { websocket: true }, (ws, req) => {
    logClients.add(ws);

    try {
      ws.send("[TEST] Probando conexión de logs 1");
      ws.send("[TEST] Probando conexión de logs 2");
      ws.send("[INFO] Conexión establecida con los logs del servidor");

      const publicUrl = fastify.publicUrl || "URL no definida";
      ws.send(`[INFO] URL pública: ${publicUrl}`);
      ws.send("[SERVER] Sistema de logs inicializado");
      ws.send("[SERVER] Escuchando en el puerto 8000");
    } catch (error) {
      console.error("[WebSocket Send Error]", error);
    }

    ws.on("message", (message) => {
      if (message.toString() === "heartbeat") {
        ws.send("[HEARTBEAT] Conexión activa");
      }
    });

    ws.on("error", (error) => {
      console.error("[WebSocket Error]", error);
      logClients.delete(ws);
    });

    ws.on("close", () => {
      logClients.delete(ws);
      console.log("[INFO] Cliente de logs desconectado");
    });
  });

  // WebSocket para el media stream de la llamada (Twilio -> ElevenLabs)
  fastify.get("/outbound-media-stream", { websocket: true }, (ws, req) => {
    console.log("[DEBUG] Conexión entrante a /outbound-media-stream");
    setupMediaStream(ws);
  });
}
