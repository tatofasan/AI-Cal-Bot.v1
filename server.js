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

// Registrar rutas
fastify.register(routes);

// Aquí definimos una propiedad global en fastify para la URL pública
fastify.decorate("publicUrl", null);

export const startServer = async () => {
  try {
    await fastify.listen({ port: PORT, host: "0.0.0.0" });
    console.log(`[Server] Escuchando en el puerto ${PORT}`);

    // Iniciar túnel ngrok
    const publicUrl = await startNgrokTunnel(PORT);
    fastify.publicUrl = publicUrl; // Inyectamos la URL pública en fastify
    console.log(`[ngrok] Tunnel creado en: ${publicUrl}`);
  } catch (error) {
    console.error("[Server] Error al iniciar el servidor:", error);
    process.exit(1);
  }
};

startServer();
