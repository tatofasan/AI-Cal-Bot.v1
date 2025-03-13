// src/routes/index.js
import outboundCallRoutes from "./outboundCall.js";
import websocketsRoutes from "./websockets.js";

export default async function routes(fastify, options) {
  fastify.register(outboundCallRoutes);
  fastify.register(websocketsRoutes);
}
