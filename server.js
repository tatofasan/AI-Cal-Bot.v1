// src/server.js
import Fastify from "fastify";
import fastifyFormBody from "@fastify/formbody";
import fastifyWs from "@fastify/websocket";
import { startNgrokTunnel } from "./services/ngrokService.js";
import routes from "./routes/index.js";
import "./utils/logger.js";

const PORT = 8000;
const fastify = Fastify();

fastify.register(fastifyFormBody);
fastify.register(fastifyWs);

// Registrar rutas (incluyendo websockets, llamadas, etc.)
fastify.register(routes);

// Definir una propiedad global en fastify para la URL pública
fastify.decorate("publicUrl", null);

export const startServer = async () => {
  try {
    await fastify.listen({ port: PORT, host: "0.0.0.0" });
    console.log(`[Server] Escuchando en el puerto ${PORT}`);

    // Determinar la URL pública según el entorno
    let publicUrl;
    try {
      // Intenta iniciar el túnel ngrok; si falla, se captura el error
      publicUrl = await startNgrokTunnel(PORT);
      console.log(`[ngrok] Tunnel creado en: ${publicUrl}`);
    } catch (ngrokError) {
      console.error("[ngrok] Error con ngrok, usando URL de Replit:", ngrokError.message);
      // Usar la URL de Replit como alternativa, si están definidas las variables de entorno
      publicUrl = process.env.REPL_SLUG 
        ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.replit.dev` 
        : `https://${process.env.REPL_ID}.id.repl.co`;
      console.log(`[Server] URL pública: ${publicUrl}`);
    }

    // Establecer la URL pública para usarla en la aplicación
    fastify.publicUrl = publicUrl;
    global.publicUrl = publicUrl;
    process.env.PUBLIC_URL = publicUrl;

    console.log(`[Server] Servidor disponible en: ${publicUrl}`);
  } catch (serverError) {
    console.error("[Server] Error al iniciar el servidor:", serverError);
    process.exit(1);
  }
};

startServer();
