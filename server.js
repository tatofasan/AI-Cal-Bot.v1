// server.js
import dotenv from 'dotenv';
import Fastify from "fastify";
import fastifyWs from "@fastify/websocket";
import fastifyFormBody from "@fastify/formbody";
import fastifyCors from "@fastify/cors";
import fastifyCookie from "@fastify/cookie";
import fastifyStatic from "@fastify/static";
import fastifyMultipart from "@fastify/multipart"; // Nuevo para upload de archivos
import { join } from "path";
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import routes from "./routes/index.js";

// Cargar variables de entorno
dotenv.config();

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
    secret: process.env.COOKIE_SECRET || "default-secret-key-change-in-production",
    hook: 'onRequest'
  });

  // Registrar el plugin static para servir archivos estáticos
  await fastify.register(fastifyStatic, {
    root: join(__dirname, 'views'),
    prefix: '/static/',
  });

  await fastify.register(fastifyFormBody);

  // Registrar multipart para upload de archivos
  await fastify.register(fastifyMultipart, {
    limits: {
      fileSize: 10 * 1024 * 1024 // 10MB máximo
    }
  });

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

  // Hook para limpiar conversaciones al cerrar
  fastify.addHook('onClose', async (instance) => {
    try {
      const { closeAllConversations } = await import('./services/elevenLabsService.js');
      await closeAllConversations();
    } catch (error) {
      console.error('[Server] Error cerrando conversaciones:', error);
    }
  });

  // Iniciar el servidor
  try {
    await fastify.listen({ port: PORT, host: appConfig.server.host });
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