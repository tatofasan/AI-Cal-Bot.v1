// server.js
import Fastify from "fastify";
import fastifyWs from "@fastify/websocket";
import fastifyFormBody from "@fastify/formbody";
import fastifyCors from "@fastify/cors";
import fastifyCookie from "@fastify/cookie"; // Para manejo de sesiones
import fastifyStatic from "@fastify/static"; // Para servir archivos estáticos
import { join } from "path"; // Para construir rutas
import { fileURLToPath } from 'url'; // Para obtener __dirname
import { dirname } from 'path';
import routes from "./routes/index.js";

import { appConfig, getPublicUrl } from "./services/config/appConfig.js";

// Para obtener __dirname en ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = appConfig.server.port;

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

  // Registrar cookie plugin para manejo de sesiones
  await fastify.register(fastifyCookie, {
    secret: process.env.COOKIE_SECRET || "default-secret-key-change-in-production", // Idealmente usar una clave secreta
    hook: 'onRequest'
  });

  // Registrar el plugin static para servir archivos estáticos
  await fastify.register(fastifyStatic, {
    root: join(__dirname, 'views'),
    prefix: '/static/', // Opcional: prefijo para las URLs de archivos estáticos
  });

  await fastify.register(fastifyFormBody);
  await fastify.register(fastifyWs, {
    options: {
      maxPayload: 1048576, // 1MB max payload
    },
  });

  // Obtener URL pública directamente del servicio
  const publicUrl = getPublicUrl();
  console.log(`[Server] Usando URL pública: ${publicUrl}`);

  // Hacer disponible la URL pública para todas las rutas
  fastify.decorate("publicUrl", publicUrl);

  // Registrar rutas
  fastify.register(routes);

  // Iniciar el servidor
  try {
    await fastify.listen({ port: PORT, host: appConfig.server.host });
    // Removed the ngrok log messages
    console.log(`[Server] Escuchando en el puerto ${PORT}`);
    console.log(`[Server] Servidor disponible en: ${publicUrl}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }

  return fastify;
};

// Si este archivo se ejecuta directamente, iniciar el servidor
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer();
}