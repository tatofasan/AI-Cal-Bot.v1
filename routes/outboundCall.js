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
      // Lee el archivo HTML - corregimos la ruta relativa
      let html = fs.readFileSync(
        path.join(__dirname, "../views/index.html"),
        "utf8",
      );
      // Usar la URL correcta
      const publicUrl = REPLIT_URL;
      // Reemplaza el placeholder {{publicUrl}} con el valor actual
      html = html.replace(/{{publicUrl}}/g, publicUrl);
      return reply.type("text/html").send(html);
    } catch (error) {
      console.error("Error leyendo el archivo HTML:", error);
      return reply.code(500).send("Error interno");
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

    const { user_name = "el titular de la linea", to_number, voice_id } = request.body;

    console.log("[DEBUG] Iniciando llamada con parámetros:", {
      user_name,
      to_number: to_number || "+541161728140",
      voice_id,
    });

    try {
      const callResult = await twilioCall({ user_name, to_number, voice_id });
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

      // Usar la URL correcta
      const publicUrl = REPLIT_URL;
      const voice_name = request.query.voice_name || '';

      // Construir la URL del WebSocket
      let wsProtocol = publicUrl.startsWith("https://") ? "wss://" : "ws://";
      let wsHost = publicUrl.replace(/^https?:\/\//, "");
      let wsUrl = `${wsProtocol}${wsHost}/outbound-media-stream`;

      console.log(`[TwiML] Generando TwiML con WebSocket URL: ${wsUrl} y voice_name: ${voice_name}`);

      // Generar TwiML
      const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${wsUrl}">
      <Parameter name="user_name" value="${user_name}" />
      <Parameter name="voice_id" value="${voice_id}" />
      <Parameter name="voice_name" value="${request.query.voice_name || ''}" />
    </Stream>
  </Connect>
</Response>`;

      return reply.type("text/xml").send(twimlResponse);
    } catch (error) {
      console.error(`[TwiML] Error generando TwiML: ${error}`);
      // TwiML de fallback
      const fallbackTwiML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Lo sentimos, ha ocurrido un error en la aplicación.</Say>
</Response>`;
      return reply.type("text/xml").send(fallbackTwiML);
    }
  });
}
