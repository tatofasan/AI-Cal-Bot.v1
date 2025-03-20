// server.js
import Fastify from "fastify";
import fastifyWs from "@fastify/websocket";
import fastifyFormBody from "@fastify/formbody";
import routes from "./routes/index.js";
import { startNgrokTunnel } from "./services/ngrokService.js";

const PORT =  8000;
// Inicializamos Fastify sin opciones adicionales (sin trustProxy)
const fastify = Fastify();

// Registrar plugins
await fastify.register(fastifyFormBody);
await fastify.register(fastifyWs);
// Registrar rutas
fastify.register(routes);

export const startServer = async () => {



  // Iniciar el servidor
  try {
    await fastify.listen({ port: PORT, host: "0.0.0.0" });
    console.log(`[Server] Listening on port ${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }

  // Obtener la URL pública directamente desde ngrok
  try {
    const publicUrl = await startNgrokTunnel(PORT);
    console.log(`[ngrok] Tunnel created successfully. Public URL: ${publicUrl}`);
    // Guardamos la URL pública en una variable global para su uso en toda la aplicación
    global.publicUrl = publicUrl;
  } catch (error) {
    console.error("[ngrok] Error connecting to ngrok:", error.message);
  }

  return fastify;
};

// Iniciar el servidor si este archivo se ejecuta directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer();
}
