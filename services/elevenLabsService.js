// src/services/elevenLabsService.js
import WebSocket from "ws";
import fetch from "node-fetch"; // O la forma en que hagas las peticiones

const ELEVENLABS_API_KEY = "sk_6699a2f7d7c3982f82de20478e62ed188263055e53c25a88";
const ELEVENLABS_AGENT_ID = "KmPa2LWqjFasERSKkFsg";

export const getSignedUrl = async () => {
  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${ELEVENLABS_AGENT_ID}`,
      {
        method: "GET",
        headers: { "xi-api-key": ELEVENLABS_API_KEY },
      },
    );

    if (!response.ok) {
      throw new Error(`Fallo al obtener signed URL: ${response.statusText}`);
    }
    const data = await response.json();
    return data.signed_url;
  } catch (error) {
    console.error("[ElevenLabs] Error en getSignedUrl:", error);
    throw error;
  }
};

export const setupMediaStream = async (clientWs) => {
  // Función para iniciar el WebSocket con ElevenLabs y gestionar mensajes
  let elevenLabsWs = null;

  const connectToElevenLabs = async () => {
    try {
      const signedUrl = await getSignedUrl();
      elevenLabsWs = new WebSocket(signedUrl);

      elevenLabsWs.on("open", () => {
        console.log("[ElevenLabs] Conectado a la API Conversacional");
        const initialConfig = {
          type: "conversation_initiation_client_data",
          dynamic_variables: { user_name: "Ezequiel" },
        };
        elevenLabsWs.send(JSON.stringify(initialConfig));
      });

      elevenLabsWs.on("message", (data) => {
        // Procesar mensajes y reenviarlos al WebSocket de Twilio si es necesario
        const message = JSON.parse(data);
        // Ejemplo: reenviar audio chunk
        if (message.audio && message.audio.chunk) {
          const audioData = {
            event: "media",
            media: { payload: message.audio.chunk },
          };
          clientWs.send(JSON.stringify(audioData));
        }
      });

      elevenLabsWs.on("error", (error) => {
        console.error("[ElevenLabs] Error en WebSocket:", error);
      });

      elevenLabsWs.on("close", () => {
        console.log("[ElevenLabs] Desconectado");
      });
    } catch (error) {
      console.error("[ElevenLabs] Error en setupMediaStream:", error);
    }
  };

  connectToElevenLabs();

  clientWs.on("message", (message) => {
    // Procesa los mensajes del cliente (por ejemplo, iniciar o detener el stream)
    try {
      const msg = JSON.parse(message);
      switch (msg.event) {
        case "start":
          console.log("[Media] Stream iniciado");
          break;
        case "media":
          if (elevenLabsWs?.readyState === WebSocket.OPEN) {
            // Envía el chunk de audio a ElevenLabs
            elevenLabsWs.send(JSON.stringify({ user_audio_chunk: msg.media.payload }));
          }
          break;
        case "stop":
          console.log("[Media] Stream detenido");
          if (elevenLabsWs?.readyState === WebSocket.OPEN) {
            elevenLabsWs.close();
          }
          break;
        default:
          console.log("[Media] Evento no manejado:", msg.event);
      }
    } catch (error) {
      console.error("[Media] Error procesando mensaje:", error);
    }
  });

  clientWs.on("close", () => {
    console.log("[Media] Conexión del cliente cerrada");
    if (elevenLabsWs?.readyState === WebSocket.OPEN) {
      elevenLabsWs.close();
    }
  });
};
