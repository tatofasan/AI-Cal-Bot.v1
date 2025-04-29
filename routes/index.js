// src/routes/index.js
import * as outboundCallRoutes from "./outboundCall.js";
import * as websocketsRoutes from "./websockets.js";
import sessionRoutes from "./sessionRoutes.js";
import dashboardRoutes from "./dashboardRoutes.js";
import callRoutes from "./callRoutes.js";
import twilioCallbackRoutes from "./twilioCallbacks.js";
import authRoutes from "./authRoutes.js"; // Importar las nuevas rutas de autenticación

export default async function routes(fastify, options) {
  fastify.register(outboundCallRoutes.default || outboundCallRoutes);
  fastify.register(websocketsRoutes.default || websocketsRoutes);
  fastify.register(sessionRoutes);
  fastify.register(dashboardRoutes);
  fastify.register(callRoutes);
  fastify.register(twilioCallbackRoutes);
  fastify.register(authRoutes); // Registrar rutas de autenticación
}