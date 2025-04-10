// src/routes/outboundCall.js
import { handleIndexRoute, handleJsFileRoute } from "./outbound/routeHandler.js";
import { 
  initiateCall, 
  generateTwiML, 
  endCall,
  changeVoiceProvider 
} from "./outbound/callController.js";

export default async function outboundCallRoutes(fastify, options) {
  // Ruta que sirve el front end
  fastify.get("/", handleIndexRoute);

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

  // Ruta para iniciar la llamada
  fastify.post("/outbound-call", initiateCall);

  // Ruta para generar TwiML
  fastify.all("/outbound-call-twiml", generateTwiML);

  // Ruta para cortar la llamada
  fastify.post("/end-call", endCall);

  // Nueva ruta para cambiar el proveedor de voz
  fastify.post("/change-voice-provider", changeVoiceProvider);
}