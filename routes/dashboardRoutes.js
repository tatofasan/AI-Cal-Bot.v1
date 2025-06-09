// routes/dashboardRoutes.js
import { handleDashboardRoute, handleDashboardJsFileRoute } from "./dashboard/routeHandler.js";
import unifiedSessionService from "../services/unifiedSessionService.js";
import { requireSupervisor } from "../middleware/auth-middleware.js";

export default async function dashboardRoutes(fastify, options) {
  // Ruta que sirve el dashboard - ahora requiere ser supervisor
  fastify.get("/dashboard", {
    preHandler: requireSupervisor
  }, handleDashboardRoute);

  // Rutas para servir los archivos JS específicos del dashboard
  fastify.get("/js/dashboard/dashboardMain.js", (request, reply) => {
    return handleDashboardJsFileRoute(request, reply, "dashboardMain.js");
  });

  fastify.get("/js/dashboard/sessionMonitor.js", (request, reply) => {
    return handleDashboardJsFileRoute(request, reply, "sessionMonitor.js");
  });

  fastify.get("/js/dashboard/callMonitor.js", (request, reply) => {
    return handleDashboardJsFileRoute(request, reply, "callMonitor.js");
  });

  fastify.get("/js/dashboard/uiController.js", (request, reply) => {
    return handleDashboardJsFileRoute(request, reply, "uiController.js");
  });

  fastify.get("/js/dashboard/webSocketClient.js", (request, reply) => {
    return handleDashboardJsFileRoute(request, reply, "webSocketClient.js");
  });

  // API para obtener estadísticas de sesiones en formato JSON - también requiere ser supervisor
  fastify.get("/api/sessions", {
    preHandler: requireSupervisor
  }, async (request, reply) => {
    try {
      const stats = unifiedSessionService.getStats();
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