// src/routes/outbound/routeHandler.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { REPLIT_URL } from '../../services/urlService.js';

// Para obtener __dirname en ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Maneja la ruta principal que sirve el frontend
 * @param {object} request - Objeto de solicitud Fastify
 * @param {object} reply - Objeto de respuesta Fastify
 */
export const handleIndexRoute = async (request, reply) => {
  try {
    let html = fs.readFileSync(
      path.join(__dirname, "../../views/index.html"),
      "utf8",
    );
    const publicUrl = REPLIT_URL;
    html = html.replace(/{{publicUrl}}/g, publicUrl);
    return reply.type("text/html").send(html);
  } catch (error) {
    console.error("Error leyendo el archivo HTML:", error);
    return reply.code(500).send("Error interno");
  }
};

/**
 * Maneja las rutas para servir archivos JavaScript estáticos
 * @param {object} request - Objeto de solicitud Fastify
 * @param {object} reply - Objeto de respuesta Fastify
 * @param {string} filename - Nombre del archivo JS a servir
 */
export const handleJsFileRoute = (request, reply, filename) => {
  try {
    const filePath = path.join(__dirname, `../../views/js/${filename}`);
    if (fs.existsSync(filePath)) {
      const jsContent = fs.readFileSync(filePath, "utf8");
      return reply.type("application/javascript").send(jsContent);
    } else {
      // Si el archivo no existe, servirlo desde la ruta en websockets.js
      return reply.redirect(`/logs-websocket/js/${filename}`);
    }
  } catch (error) {
    console.error(`Error sirviendo ${filename}:`, error);
    return reply.code(500).send({ error: "Error al cargar el archivo JS" });
  }
};