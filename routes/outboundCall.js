// src/routes/outboundCall.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { twilioCall } from "../services/twilioService.js";
import { getPublicUrl } from "../services/urlService.js"; // Import the getPublicUrl function


// Para obtener __dirname en ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// URL correcta de Replit
//const REPLIT_URL = "https://7ef42203-2693-4235-a62c-c257fc10813e-00-2y0p0wpxah3dz.picard.replit.dev";

export default async function outboundCallRoutes(fastify, options) {
  // Ruta que sirve el front end
  fastify.get("/", async (request, reply) => {
    try {
      // Lee el archivo HTML - corregimos la ruta relativa
      let html = fs.readFileSync(path.join(__dirname, "../views/index.html"), "utf8");
      // Usar la URL correcta
      const publicUrl = getPublicUrl();
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

    const { prompt, first_message, to_number } = request.body;

    console.log("[DEBUG] Iniciando llamada con parámetros:", {
      prompt,
      first_message,
      to_number: to_number || "+541161728140",
    });

    try {
      const callResult = await twilioCall({ prompt, first_message, to_number });
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
      const prompt = request.query.prompt || "";
      const first_message = request.query.first_message || "";

      // Usar la URL correcta
      const publicUrl = getPublicUrl();

      // Construir la URL del WebSocket
      const baseUrl = publicUrl.startsWith('http') ? publicUrl : `https://${publicUrl}`;
      const wsHost = baseUrl.replace(/^https?:\/\//, '');
      const wsUrl = `wss://${wsHost}/outbound-media-stream`;

      console.log(`[TwiML] Generando TwiML con WebSocket URL: ${wsUrl}`);

      // Generar TwiML
      const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${wsUrl}">
      <Parameter name="prompt" value="${prompt}" />
      <Parameter name="first_message" value="${first_message}" />
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