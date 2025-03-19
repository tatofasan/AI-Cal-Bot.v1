// src/routes/index.js
import * as outboundCallRoutes from "./outboundCall.js";
import * as websocketsRoutes from "./websockets.js";

export default async function routes(fastify, options) {
  fastify.register(outboundCallRoutes.default || outboundCallRoutes);
  fastify.register(websocketsRoutes.default || websocketsRoutes);
}