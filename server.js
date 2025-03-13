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

    // Iniciar túnel ngrok y almacenar la URL pública (por ejemplo, en una variable global o en un servicio)
    const publicUrl = await startNgrokTunnel(PORT);
    // Podrías almacenar publicUrl en un objeto de configuración global o pasarlo a las rutas
    console.log(`[ngrok] Tunnel creado en: ${publicUrl}`);
  } catch (error) {
    console.error("[Server] Error al iniciar el servidor:", error);
    process.exit(1);
  }
};

// Se inicia el servidor desde este archivo o desde un index principal
startServer();
