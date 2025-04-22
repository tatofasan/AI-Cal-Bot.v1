// src/routes/dashboardRoutes.js
import { handleDashboardRoute, handleJsFileRoute } from "./dashboard/routeHandler.js";
import { getSessionStats } from "../services/sessionService.js";

export default async function dashboardRoutes(fastify, options) {
  // Ruta que sirve el dashboard
  fastify.get("/dashboard", handleDashboardRoute);

  // Rutas para servir los archivos JS específicos del dashboard
  fastify.get("/js/dashboard/dashboardMain.js", (request, reply) => {
    return handleJsFileRoute(request, reply, "dashboardMain.js");
  });

  fastify.get("/js/dashboard/sessionMonitor.js", (request, reply) => {
    return handleJsFileRoute(request, reply, "sessionMonitor.js");
  });

  fastify.get("/js/dashboard/callMonitor.js", (request, reply) => {
    return handleJsFileRoute(request, reply, "callMonitor.js");
  });

  fastify.get("/js/dashboard/uiController.js", (request, reply) => {
    return handleJsFileRoute(request, reply, "uiController.js");
  });

  fastify.get("/js/dashboard/webSocketClient.js", (request, reply) => {
    return handleJsFileRoute(request, reply, "webSocketClient.js");
  });

  // API para obtener estadísticas de sesiones en formato JSON
  fastify.get("/api/sessions", async (request, reply) => {
    try {
      const stats = getSessionStats();
      return reply.send({
        success: true,
        timestamp: Date.now(),
        stats
      });
    } catch (error) {
      console.error("[Dashboard] Error obteniendo estadísticas de sesiones:", error);
      return reply.code(500).send({
        success: false,
        error: "Error interno al obtener estadísticas de sesiones"
      });
    }
  });
}