// src/routes/websockets.js
import WebSocket from "ws";
import { setupMediaStream } from "../services/elevenLabsService.js";
import { logClients } from '../utils/logger.js';
import { 
  registerLogClient, 
  removeLogClient, 
  getOrCreateSession,
  registerAgentConnection,
  removeAgentConnection
} from '../utils/sessionManager.js';
import { processAgentAudio, processAgentTranscript, processAgentInterrupt } from "../services/speechService.js";

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
      if (message.toString() === "heartbeat") {
        ws.send("[HEARTBEAT] Conexión activa");
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

    // Configurar el media stream con el sessionId
    setupMediaStream(ws, sessionId);

    // Manejar mensajes iniciales que podrían contener el sessionId
    ws.on("message", function firstMessage(message) {
      try {
        const data = JSON.parse(message.toString());
        if (data.sessionId && !ws.sessionId) {
          console.log("[Server] sessionId recibido en primer mensaje:", data.sessionId);
          ws.sessionId = data.sessionId;
          // Reconfigurar el stream con el nuevo sessionId
          setupMediaStream(ws, data.sessionId);
        }
        // Eliminar este handler después del primer mensaje
        ws.removeListener("message", firstMessage);
      } catch (e) {
        // No es un JSON o no tiene sessionId, ignorar
      }
    });
  });

  // Nueva ruta para mensajes de texto directos (para que el agente pueda escribir mensajes)
  fastify.post("/agent-direct-message", async (request, reply) => {
    try {
      const { sessionId, message } = request.body;

      if (!sessionId || !message) {
        return reply.code(400).send({ 
          success: false, 
          error: "Se requiere sessionId y message" 
        });
      }

      // Obtener la sesión y verificar que existe
      const session = getOrCreateSession(sessionId);
      if (!session) {
        return reply.code(404).send({ 
          success: false, 
          error: "Sesión no encontrada" 
        });
      }

      // Procesar el mensaje de texto
      await processAgentTranscript(sessionId, message);

      return reply.send({ 
        success: true, 
        message: "Mensaje enviado correctamente" 
      });
    } catch (error) {
      console.error("[AgentAPI] Error procesando mensaje directo:", error);
      return reply.code(500).send({ 
        success: false, 
        error: "Error interno al procesar el mensaje" 
      });
    }
  });

  // Nueva ruta WebSocket para la voz del agente
  fastify.get("/agent-voice-stream", { websocket: true }, (ws, req) => {
    // Obtener sessionId del querystring
    const sessionId = req.query.sessionId;
    if (!sessionId) {
      console.error("[AgentVoice] Error: WebSocket iniciado sin sessionId");
      ws.close(1008, "SessionId requerido");
      return;
    }

    console.log("[AgentVoice] Conexión WebSocket establecida para voz de agente con sessionId:", sessionId);

    // Registrar la conexión del agente en el gestor de sesiones
    registerAgentConnection(sessionId, ws);

    // Asociar sessionId con el WebSocket
    ws.sessionId = sessionId;

    // Manejar mensajes de audio del agente
    ws.on("message", async (message) => {
      try {
        const data = JSON.parse(message.toString());

        if (data.type === 'agent_connect') {
          // Mensaje de conexión inicial
          console.log("[AgentVoice] Agente conectado:", data.message, { sessionId });

          // Al conectar, enviar inmediatamente un comando de interrupción
          // para asegurar que el bot deje de hablar cuando el agente toma control
          await processAgentInterrupt(sessionId);
        }
        else if (data.type === 'agent_disconnect') {
          // Mensaje de desconexión
          console.log("[AgentVoice] Agente desconectado", { sessionId });
        }
        else if (data.type === 'agent_audio' && data.payload) {
          // Procesar el audio del agente y enviarlo directo a Twilio
          await processAgentAudio(sessionId, data);
        }
        else if (data.type === 'interrupt_bot') {
          // Comando para interrumpir al bot
          console.log("[AgentVoice] Recibido comando para interrumpir bot", { sessionId });
          await processAgentInterrupt(sessionId);
        }
      } catch (error) {
        console.error("[AgentVoice] Error procesando mensaje:", error, { sessionId });
      }
    });

    // Manejar cierre de conexión
    ws.on("close", () => {
      console.log("[AgentVoice] Conexión terminada para voz de agente", { sessionId });
      removeAgentConnection(ws);
    });

    // Manejar errores
    ws.on("error", (error) => {
      console.error("[AgentVoice] Error en WebSocket:", error, { sessionId });
    });
  });
}