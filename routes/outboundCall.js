// src/routes/outboundCall.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { twilioCall } from "../services/twilioService.js";

// Para obtener __dirname en ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default async function outboundCallRoutes(fastify, options) {
  // Ruta que sirve el front end
  fastify.get("/", async (request, reply) => {
    try {
      // Lee el archivo HTML - corregimos la ruta relativa
      let html = fs.readFileSync(path.join(__dirname, "../views/index.html"), "utf8");
      // Supongamos que publicUrl está en options o en un objeto de configuración global
      const publicUrl = fastify.publicUrl || "http://localhost:8000";
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
    const { prompt, first_message, to_number } = request.body;
    try {
      const callResult = await twilioCall({ prompt, first_message, to_number });
      return reply.send(callResult);
    } catch (error) {
      console.error("[Outbound Call] Error:", error);
      return reply.code(500).send({
        success: false,
        error: `Fallo al iniciar la llamada: ${error.message}`,
      });
    }
  });

  // Ruta para generar TwiML
  fastify.all("/outbound-call-twiml", async (request, reply) => {
    const prompt = request.query.prompt || "";
    const first_message = request.query.first_message || "";
    const publicUrl = fastify.publicUrl || "http://localhost:8000";
    const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Connect>
          <Stream url="wss://${publicUrl.replace(/^https?:\/\//, "")}/outbound-media-stream">
            <Parameter name="prompt" value="${prompt}" />
            <Parameter name="first_message" value="${first_message}" />
          </Stream>
        </Connect>
      </Response>`;
    return reply.type("text/xml").send(twimlResponse);
  });
}
