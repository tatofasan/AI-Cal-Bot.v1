// src/routes/outboundCall.js
import { handleIndexRoute, handleJsFileRoute } from "./outbound/routeHandler.js";
import { 
  initiateCall, 
  generateTwiML, 
  endCall 
} from "./outbound/callController.js";
import { requireAuth } from "../middleware/auth-middleware.js"; // Ruta corregida

export default async function outboundCallRoutes(fastify, options) {
  // Ruta que sirve el front end - ahora requiere autenticación
  fastify.get("/", {
    preHandler: requireAuth // Agregar middleware de autenticación
  }, handleIndexRoute);

  // Rutas para servir los archivos JS estáticos
  fastify.get("/js/audioProcessor.js", (request, reply) => {
    return handleJsFileRoute(request, reply, "audioProcessor.js");
  });

  fastify.get("/js/uiController.js", (request, reply) => {
    return handleJsFileRoute(request, reply, "uiController.js");
  });

  fastify.get("/js/apiService.js", (request, reply) => {
    return handleJsFileRoute(request, reply, "apiService.js");
  });

  fastify.get("/js/webSocketHandler.js", (request, reply) => {
    return handleJsFileRoute(request, reply, "webSocketHandler.js");
  });

  fastify.get("/js/main.js", (request, reply) => {
    return handleJsFileRoute(request, reply, "main.js");
  });

  // Nuevo: Ruta para servir el archivo del agente de voz
  fastify.get("/js/agentVoiceCapture.js", (request, reply) => {
    return handleJsFileRoute(request, reply, "agentVoiceCapture.js");
  });

  // Ruta para iniciar la llamada - también requiere autenticación
  fastify.post("/outbound-call", {
    preHandler: requireAuth // Agregar middleware de autenticación
  }, initiateCall);

  // Ruta para generar TwiML
  fastify.all("/outbound-call-twiml", generateTwiML);

  // Ruta para cortar la llamada - también requiere autenticación
  fastify.post("/end-call", {
    preHandler: requireAuth // Agregar middleware de autenticación
  }, endCall);
}