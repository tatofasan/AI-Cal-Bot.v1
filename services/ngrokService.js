
import Fastify from "fastify";
import routes from "../routes/index.js";
import { startNgrokTunnel } from "./ngrokService.js";

const PORT = process.env.PORT || 8000;
const fastify = Fastify();

// Registra las rutas de la aplicación
fastify.register(routes);

const startServer = async () => {
  try {
    await fastify.listen({ port: PORT, host: "0.0.0.0" });
    console.log(`[Server] Escuchando en el puerto ${PORT}`);

    // Inicia el túnel de ngrok y lo asigna como URL pública
    const publicUrl = await startNgrokTunnel(PORT);
    global.publicUrl = publicUrl;
    fastify.publicUrl = publicUrl;

    console.log(`[ngrok] Tunnel creado en: ${publicUrl}`);
    console.log(`[Server] Servidor disponible en: ${publicUrl}`);
  } catch (err) {
    console.error("[Server] Error starting server:", err);
    process.exit(1);
  }
};

startServer();
