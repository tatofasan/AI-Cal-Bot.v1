// src/routes/dashboard/routeHandler.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { APP_PUBLIC_URL } from '../../services/config/appConfig.js';

// Para obtener __dirname en ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Maneja la ruta principal que sirve el frontend de llamadas
 * @param {object} request - Objeto de solicitud Fastify
 * @param {object} reply - Objeto de respuesta Fastify
 */
export const handleIndexRoute = async (request, reply) => {
  try {
    let html = fs.readFileSync(
      path.join(__dirname, "../../views/index.html"),
      "utf8",
    );
    const publicUrl = APP_PUBLIC_URL;
    html = html.replace(/{{publicUrl}}/g, publicUrl);
    return reply.type("text/html").send(html);
  } catch (error) {
    console.error("Error leyendo el archivo HTML:", error);
    return reply.code(500).send("Error interno");
  }
};

/**
 * Maneja la ruta principal del dashboard que sirve el frontend
 * @param {object} request - Objeto de solicitud Fastify
 * @param {object} reply - Objeto de respuesta Fastify
 */
export const handleDashboardRoute = async (request, reply) => {
  try {
    let html = fs.readFileSync(
      path.join(__dirname, "../../views/dashboard.html"),
      "utf8",
    );
    const publicUrl = APP_PUBLIC_URL;
    html = html.replace(/{{publicUrl}}/g, publicUrl);
    return reply.type("text/html").send(html);
  } catch (error) {
    console.error("Error leyendo el archivo HTML:", error);
    return reply.code(500).send("Error interno");
  }
};

/**
 * Maneja las rutas para servir archivos JavaScript estáticos del dashboard
 * @param {object} request - Objeto de solicitud Fastify
 * @param {object} reply - Objeto de respuesta Fastify
 * @param {string} filename - Nombre del archivo JS a servir
 */
export const handleDashboardJsFileRoute = (request, reply, filename) => {
  try {
    const filePath = path.join(__dirname, `../../views/js/dashboard/${filename}`);
    if (fs.existsSync(filePath)) {
      console.log(`[Dashboard] Sirviendo archivo JS: ${filename} desde ${filePath}`);
      const jsContent = fs.readFileSync(filePath, "utf8");
      return reply.type("application/javascript").send(jsContent);
    } else {
      console.error(`[Dashboard] Archivo JS no encontrado: ${filename} en ${filePath}`);
      return reply.code(404).send({ error: `Archivo ${filename} no encontrado` });
    }
  } catch (error) {
    console.error(`[Dashboard] Error sirviendo ${filename}:`, error);
    return reply.code(500).send({ error: "Error al cargar el archivo JS" });
  }
};

/**
 * Maneja las rutas para servir archivos JavaScript estáticos principales
 * @param {object} request - Objeto de solicitud Fastify
 * @param {object} reply - Objeto de respuesta Fastify
 * @param {string} filename - Nombre del archivo JS a servir
 */
export const handleJsFileRoute = (request, reply, filename) => {
  try {
    const filePath = path.join(__dirname, `../../views/js/${filename}`);
    if (fs.existsSync(filePath)) {
      console.log(`[Routes] Sirviendo archivo JS: ${filename} desde ${filePath}`);
      const jsContent = fs.readFileSync(filePath, "utf8");
      return reply.type("application/javascript").send(jsContent);
    } else {
      console.error(`[Routes] Archivo JS no encontrado: ${filename} en ${filePath}`);
      return reply.code(404).send({ error: `Archivo ${filename} no encontrado` });
    }
  } catch (error) {
    console.error(`[Routes] Error sirviendo ${filename}:`, error);
    return reply.code(500).send({ error: "Error al cargar el archivo JS" });
  }
};