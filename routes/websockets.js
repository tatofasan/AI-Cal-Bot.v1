// src/routes/websockets.js
import WebSocket from "ws";
import { setupMediaStream } from "../services/elevenLabsService.js";

export default async function websocketsRoutes(fastify, options) {
  // WebSocket para logs
  fastify.get("/logs-websocket", { websocket: true }, (ws, req) => {
    // Aquí gestionas la conexión y envías logs al cliente
    ws.send("[INFO] Conexión establecida con logs");
    ws.on("message", (message) => {
      if (message === "heartbeat") {
        ws.send("[HEARTBEAT] Conexión activa");
      }
    });
  });

  // WebSocket para el media stream outbound
  fastify.get("/outbound-media-stream", { websocket: true }, (ws, req) => {
    console.info("[Server] Conexión WebSocket para stream de medios iniciada");
    setupMediaStream(ws);
  });
}
