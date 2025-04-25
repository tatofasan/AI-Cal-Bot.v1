// src/routes/websockets.js
import WebSocket from "ws";
import { setupMediaStream } from "../services/elevenLabsService.js";
import { logClients } from '../utils/logger.js';
import { 
  registerLogClient, 
  removeLogClient, 
  validateSessionId,
  registerAgentConnection,
  removeAgentConnection
} from '../utils/sessionManager.js';
import { processAgentAudio, processAgentTranscript, processAgentInterrupt } from "../services/speechService.js";
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

  // WebSocket para el media stream outbound
  fastify.get("/outbound-media-stream", { websocket: true }, (ws, req) => {
    // Obtener sessionId del querystring - posible problema con Twilio enviando sessionId
    const sessionId = req.query.sessionId;

    // Log de diagnóstico para ver qué contiene la solicitud
    console.log("[WebSocket] Params en solicitud media-stream:", { 
      query: req.query, 
      url: req.url, 
      headers: req.headers 
    });

    // Si no hay sessionId en querystring, usar el último sessionId activo
    // Este es un workaround para cuando Twilio no pasa correctamente el sessionId
    if (!sessionId) {
      // Código de emergencia - usar la última sesión creada si existe
      try {
        // Usar la función importada en la parte superior del archivo
        const stats = getSessionStats();
        const sessionInfo = stats.sessionInfo || [];

        if (sessionInfo.length > 0) {
          // Ordenar sesiones por creación, la más reciente primero
          const sortedSessions = [...sessionInfo].sort((a, b) => b.createdAt - a.createdAt);
          const latestSessionId = sortedSessions[0].id;

          console.log(`[WebSocket] No se proporcionó sessionId, usando la última sesión activa: ${latestSessionId}`);

          // Asociar sessionId con el WebSocket
          ws.sessionId = latestSessionId;

          // Configurar el media stream con el sessionId
          setupMediaStream(ws, latestSessionId);
          return;
        }
      } catch (error) {
        console.error("[WebSocket] Error obteniendo sesiones:", error);
      }

      console.error("[WebSocket] Error: Media stream sin sessionId proporcionado y no hay sesiones activas");
      ws.close(1008, "SessionId no proporcionado");
      return;
    }

    console.info("[Server] Conexión WebSocket para stream de medios iniciada con sessionId:", sessionId);

    // Asociar sessionId con el WebSocket
    ws.sessionId = sessionId;

    // Configurar el media stream con el sessionId
    setupMediaStream(ws, sessionId);
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

      // Validar que el sessionId sea válido
      if (!validateSessionId(sessionId)) {
        return reply.code(404).send({ 
          success: false, 
          error: "SessionId inválido" 
        });
      }

      // Obtener la sesión y verificar que existe
      const session = getSession(sessionId);
      if (!session) {
        return reply.code(404).send({ 
          success: false, 
          error: "Sesión no encontrada" 
        });
      }

      // Guardar el mensaje como transcripción (del agente)
      addTranscription(sessionId, message, 'agent');

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

    // Validar que se proporcionó un sessionId y que sea válido
    if (!sessionId || !validateSessionId(sessionId)) {
      console.error("[AgentVoice] Error: WebSocket iniciado sin sessionId válido");
      ws.close(1008, "SessionId inválido o no proporcionado");
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

          // Guardar como mensaje del sistema
          addTranscription(sessionId, "El agente humano ha tomado el control de la llamada", 'system');

          // Al conectar, enviar inmediatamente un comando de interrupción
          // para asegurar que el bot deje de hablar cuando el agente toma control
          await processAgentInterrupt(sessionId);
        }
        else if (data.type === 'agent_disconnect') {
          // Mensaje de desconexión
          console.log("[AgentVoice] Agente desconectado", { sessionId });

          // Guardar como mensaje del sistema
          addTranscription(sessionId, "El agente humano ha dejado el control de la llamada", 'system');
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

  // Función auxiliar para procesar posibles transcripciones en mensajes
  function processTranscriptionsFromMessage(messageText, sessionId) {
    // Detectar transcripciones del usuario
    if (messageText.includes("[Twilio] Transcripción del usuario:")) {
      const text = messageText.replace(/.*Transcripción del usuario:\s*/, "").trim();
      if (text) {
        addTranscription(sessionId, text, 'client');
        console.log(`[WebSocket] Transcripción de usuario capturada y guardada: "${text.substring(0, 30)}..."`, { sessionId });
      }
    } 
    // Detectar respuestas del bot
    else if (messageText.includes("[Twilio] Respuesta del agente:")) {
      const text = messageText.replace(/.*Respuesta del agente:\s*/, "").trim();
      if (text) {
        // Determinar si es bot o agente humano
        const speakerType = messageText.includes("[AGENT]") ? 'agent' : 'bot';
        addTranscription(sessionId, text, speakerType);
        console.log(`[WebSocket] Respuesta del ${speakerType} capturada y guardada: "${text.substring(0, 30)}..."`, { sessionId });
      }
    }
    // Detectar mensajes del agente
    else if (messageText.includes("[AgentVoice]")) {
      if (messageText.includes("Mensaje del agente:")) {
        const text = messageText.replace(/.*Mensaje del agente:\s*/, "").trim();
        if (text) {
          addTranscription(sessionId, text, 'agent');
          console.log(`[WebSocket] Mensaje del agente capturado y guardado: "${text.substring(0, 30)}..."`, { sessionId });
        }
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
      else if (jsonData.type === 'agent_speech' && jsonData.text) {
        addTranscription(sessionId, jsonData.text, jsonData.isAgent ? 'agent' : 'bot');
      }
    } catch (e) {
      // No es JSON, ignorar
    }
  }
}