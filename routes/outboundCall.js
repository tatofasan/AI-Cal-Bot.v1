// src/routes/outboundCall.js
import { twilioCall } from "../services/twilioService.js";

export default async function outboundCallRoutes(fastify, options) {
  // Ruta de interfaz web (HTML)
  fastify.get("/", async (_, reply) => {
    // Puedes mover el HTML a un archivo de plantilla o mantenerlo aquí
    const htmlInterface = `<!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Prueba de Llamadas</title>
      </head>
      <body>
        <h1>Interfaz de llamada</h1>
        <!-- Resto del HTML -->
      </body>
    </html>`;
    return reply.type("text/html").send(htmlInterface);
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
    // Aquí genera el TwiML usando los parámetros y la URL del stream
    const publicUrl = "TU_PUBLIC_URL_AQUI"; // Puedes inyectar la URL desde una configuración global
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
