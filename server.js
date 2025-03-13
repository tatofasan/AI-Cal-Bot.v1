// src/server.js
import Fastify from "fastify";
import fastifyFormBody from "@fastify/formbody";
import fastifyWs from "@fastify/websocket";
import { startNgrokTunnel } from "./services/ngrokService.js";
import routes from "./routes/index.js";
import "./utils/logger.js"; // Se interceptan los logs

const PORT = 8000;
const fastify = Fastify();

fastify.register(fastifyFormBody);
fastify.register(fastifyWs);

// Registrar todas las rutas
fastify.register(routes);

export const startServer = async () => {
  try {
    await fastify.listen({ port: PORT, host: "0.0.0.0" });
    console.log(`[Server] Escuchando en el puerto ${PORT}`);

    try {
      // Iniciar túnel ngrok y almacenar la URL pública en una variable global
      const publicUrl = await startNgrokTunnel(PORT);
      global.publicUrl = publicUrl; // Make it available globally
      process.env.PUBLIC_URL = publicUrl; // Also set as environment variable
      console.log(`[ngrok] Tunnel creado en: ${publicUrl}`);
    } catch (ngrokError) {
      console.error("[ngrok] Error al iniciar el túnel, continuando sin él:", ngrokError);
      // Use Replit's domain as fallback when ngrok fails
      const replitDomain = process.env.REPL_SLUG ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.replit.dev` : `http://0.0.0.0:${PORT}`;
      global.publicUrl = replitDomain;
      process.env.PUBLIC_URL = replitDomain;
      console.log(`[Server] El servidor sigue funcionando en ${replitDomain}`);
    }
  } catch (error) {
    console.error("[Server] Error al iniciar el servidor:", error);
    process.exit(1);
  }
};

// Se inicia el servidor desde este archivo o desde un index principal
// startServer(); // Commented out as it's now called from index.jsr();
