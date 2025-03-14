// src/server.js
import Fastify from "fastify";
import fastifyFormBody from "@fastify/formbody";
import fastifyWs from "@fastify/websocket";
import { startNgrokTunnel } from "./services/ngrokService.js";
import routes from "./routes/index.js";
import "./utils/logger.js";

const PORT = 3000;
const fastify = Fastify();

fastify.register(fastifyFormBody);
fastify.register(fastifyWs);

// Registrar rutas
fastify.register(routes);

// Aquí definimos una propiedad global en fastify para la URL pública
fastify.decorate("publicUrl", null);

export const startServer = async () => {
  try {
    await fastify.listen({ port: PORT, host: "0.0.0.0" });
    console.log(`[Server] Escuchando en el puerto ${PORT}`);

    // Determinar la URL pública basada en el entorno de Replit
    let publicUrl;
    try {
      // Intenta iniciar túnel ngrok, pero no es obligatorio para continuar
      publicUrl = await startNgrokTunnel(PORT);
      console.log(`[ngrok] Tunnel creado en: ${publicUrl}`);
    } catch (ngrokError) {
      console.error("[ngrok] Error con ngrok, usando URL de Replit:", ngrokError.message);
      // Usar la URL de Replit como alternativa
      publicUrl = process.env.REPL_SLUG 
        ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.replit.dev` 
        : `https://${process.env.REPL_ID}.id.repl.co`;
      console.log(`[Server] URL pública: ${publicUrl}`);
    }
    
    // Establecer la URL pública para su uso en toda la aplicación
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
