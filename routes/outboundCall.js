// src/routes/outboundCall.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { twilioCall } from "../services/twilioService.js";

// Para obtener __dirname en ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { REPLIT_URL } from '../services/urlService.js';

export default async function outboundCallRoutes(fastify, options) {
  // Ruta que sirve el front end
  fastify.get("/", async (request, reply) => {
    try {
      let html = fs.readFileSync(
        path.join(__dirname, "../views/index.html"),
        "utf8",
      );
      const publicUrl = REPLIT_URL;
      html = html.replace(/{{publicUrl}}/g, publicUrl);
      return reply.type("text/html").send(html);
    } catch (error) {
      console.error("Error leyendo el archivo HTML:", error);
      return reply.code(500).send("Error interno");
    }
  });

  // Rutas para servir los archivos JS estáticos
  fastify.get("/js/audioProcessor.js", (request, reply) => {
    try {
      const filePath = path.join(__dirname, "../views/js/audioProcessor.js");
      if (fs.existsSync(filePath)) {
        const jsContent = fs.readFileSync(filePath, "utf8");
        return reply.type("application/javascript").send(jsContent);
      } else {
        // Si el archivo no existe, servirlo desde la ruta en websockets.js
        return reply.redirect("/logs-websocket/js/audioProcessor.js");
      }
    } catch (error) {
      console.error("Error sirviendo audioProcessor.js:", error);
      return reply.code(500).send({ error: "Error al cargar el archivo JS" });
    }
  });

  fastify.get("/js/uiController.js", (request, reply) => {
    try {
      const filePath = path.join(__dirname, "../views/js/uiController.js");
      if (fs.existsSync(filePath)) {
        const jsContent = fs.readFileSync(filePath, "utf8");
        return reply.type("application/javascript").send(jsContent);
      } else {
        // Si el archivo no existe, servirlo desde la ruta en websockets.js
        return reply.redirect("/logs-websocket/js/uiController.js");
      }
    } catch (error) {
      console.error("Error sirviendo uiController.js:", error);
      return reply.code(500).send({ error: "Error al cargar el archivo JS" });
    }
  });

  fastify.get("/js/apiService.js", (request, reply) => {
    try {
      const filePath = path.join(__dirname, "../views/js/apiService.js");
      if (fs.existsSync(filePath)) {
        const jsContent = fs.readFileSync(filePath, "utf8");
        return reply.type("application/javascript").send(jsContent);
      } else {
        // Si el archivo no existe, servirlo desde la ruta en websockets.js
        return reply.redirect("/logs-websocket/js/apiService.js");
      }
    } catch (error) {
      console.error("Error sirviendo apiService.js:", error);
      return reply.code(500).send({ error: "Error al cargar el archivo JS" });
    }
  });

  fastify.get("/js/webSocketHandler.js", (request, reply) => {
    try {
      const filePath = path.join(__dirname, "../views/js/webSocketHandler.js");
      if (fs.existsSync(filePath)) {
        const jsContent = fs.readFileSync(filePath, "utf8");
        return reply.type("application/javascript").send(jsContent);
      } else {
        // Si el archivo no existe, servirlo desde la ruta en websockets.js
        return reply.redirect("/logs-websocket/js/webSocketHandler.js");
      }
    } catch (error) {
      console.error("Error sirviendo webSocketHandler.js:", error);
      return reply.code(500).send({ error: "Error al cargar el archivo JS" });
    }
  });

  fastify.get("/js/main.js", (request, reply) => {
    try {
      const filePath = path.join(__dirname, "../views/js/main.js");
      if (fs.existsSync(filePath)) {
        const jsContent = fs.readFileSync(filePath, "utf8");
        return reply.type("application/javascript").send(jsContent);
      } else {
        // Si el archivo no existe, servirlo desde la ruta en websockets.js
        return reply.redirect("/logs-websocket/js/main.js");
      }
    } catch (error) {
      console.error("Error sirviendo main.js:", error);
      return reply.code(500).send({ error: "Error al cargar el archivo JS" });
    }
  });

  // Ruta para iniciar la llamada
  fastify.post("/outbound-call", async (request, reply) => {
    if (!request.body) {
      console.error("[ERROR] No se recibió el cuerpo de la solicitud");
      return reply.code(400).send({
        success: false,
        error: "No request body provided",
      });
    }
    const { user_name = "el titular de la linea", to_number, voice_id, voice_name } = request.body;
    console.log("[DEBUG] Iniciando llamada con parámetros:", {
      user_name,
      to_number: to_number || "+541161728140",
      voice_id,
      voice_name
    });
    try {
      const callResult = await twilioCall({ user_name, to_number, voice_id, voice_name });
      return reply.send(callResult);
    } catch (error) {
      console.error("[Outbound Call] Error:", error);
      return reply.code(500).send({
        success: false,
        error: `Fallo al iniciar la llamada: ${error.message}`,
        errorDetails: error.stack ? error.stack : "No stack trace available",
      });
    }
  });

  // Ruta para generar TwiML
  fastify.all("/outbound-call-twiml", async (request, reply) => {
    try {
      const user_name = request.query.user_name || "el titular de la linea";
      const voice_id = request.query.voice_id || "";
      const voice_name = request.query.voice_name || '';
      const publicUrl = REPLIT_URL;
      let wsProtocol = publicUrl.startsWith("https://") ? "wss://" : "ws://";
      let wsHost = publicUrl.replace(/^https?:\/\//, "");
      let wsUrl = `${wsProtocol}${wsHost}/outbound-media-stream`;
      console.log(`[TwiML] Generando TwiML con WebSocket URL: ${wsUrl} y voice_name: ${voice_name}`);
      const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${wsUrl}">
      <Parameter name="user_name" value="${user_name}" />
      <Parameter name="voice_id" value="${voice_id}" />
      <Parameter name="voice_name" value="${voice_name}" />
    </Stream>
  </Connect>
</Response>`;
      return reply.type("text/xml").send(twimlResponse);
    } catch (error) {
      console.error(`[TwiML] Error generando TwiML: ${error}`);
      const fallbackTwiML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Lo sentimos, ha ocurrido un error en la aplicación.</Say>
</Response>`;
      return reply.type("text/xml").send(fallbackTwiML);
    }
  });

  // Nueva ruta para cortar la llamada
  fastify.post("/end-call", async (request, reply) => {
    if (!request.body || !request.body.callSid) {
      console.error("[ERROR] No callSid provided in end-call request");
      return reply.code(400).send({
        success: false,
        error: "No callSid provided",
      });
    }
    const { callSid } = request.body;
    try {
      const { twilioClient } = await import("../services/twilioService.js");
      const call = await twilioClient.calls(callSid).update({ status: "completed" });
      console.log(`[Twilio] Llamada ${callSid} finalizada exitosamente.`);
      return reply.send({
        success: true,
        message: `Call ${callSid} ended`,
      });
    } catch (error) {
      console.error(`[Twilio] Error cortando la llamada ${callSid}:`, error);
      return reply.code(500).send({
        success: false,
        error: `Error ending call: ${error.message}`,
      });
    }
  });
}