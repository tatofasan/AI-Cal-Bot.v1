// server.js
import Fastify from "fastify";
import fastifyWs from "@fastify/websocket";
import fastifyFormBody from "@fastify/formbody";
import fastifyCors from "@fastify/cors";
import routes from "./routes/index.js";
import { startNgrokTunnel } from "./services/ngrokService.js";

const PORT = process.env.PORT || 8000;

import { REPLIT_URL } from './services/urlService.js';

export const startServer = async () => {
  const fastify = Fastify({
    logger: true,
    trustProxy: true,
  });

  // Registrar plugins
  try {
    await fastify.register(fastifyCors);
  } catch (err) {
    console.warn(
      "[Server] Error registrando CORS, continuando sin ello:",
      err.message,
    );
  }

  await fastify.register(fastifyFormBody);
  await fastify.register(fastifyWs, {
    options: {
      maxPayload: 1048576, // 1MB max payload
    },
  });
  // Registrar rutas
  fastify.register(routes);
  // Iniciar el servidor
  try {
    await fastify.listen({ port: PORT, host: "0.0.0.0" });
    console.log(`[Server] Escuchando en el puerto ${PORT}`);
    //console.log(`[Server] Servidor disponible en: ${publicUrl}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
 
  // Obtener URL pública
  let publicUrl;
  try {
    publicUrl = await startNgrokTunnel(PORT);
    console.log(`[ngrok] Tunnel creado en: ${publicUrl}`);
  } catch (error) {
    console.error("[ngrok] Error con ngrok:", error.message);
    // Usar la URL correcta de Replit si ngrok falla
    //publicUrl = REPLIT_URL;
    console.log(`[ngrok] Usando URL de Replit: ${publicUrl}`);
  }

  // Hacer disponible la URL pública para todas las rutas
  //fastify.decorate("publicUrl", publicUrl);
  global.publicUrl = publicUrl;




  return fastify;
};

// Si este archivo se ejecuta directamente, iniciar el servidor
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer();
}
