// src/routes/index.js
import * as outboundCallRoutes from "./outboundCall.js";
import * as websocketsRoutes from "./websockets.js";
import sessionRoutes from "./sessionRoutes.js";
import dashboardRoutes from "./dashboardRoutes.js";
import callRoutes from "./callRoutes.js";

export default async function routes(fastify, options) {
  fastify.register(outboundCallRoutes.default || outboundCallRoutes);
  fastify.register(websocketsRoutes.default || websocketsRoutes);
  fastify.register(sessionRoutes);
  fastify.register(dashboardRoutes);
  fastify.register(callRoutes);
}