import WebSocket from "ws";
import fetch from "node-fetch";

const ELEVENLABS_API_KEY = "sk_6699a2f7d7c3982f82de20478e62ed188263055e53c25a88";
// Nota: en el código que funciona, el agent_id es "5cG7MbIu2oAyVy1r6RUG". Asegúrate de usar el mismo
const ELEVENLABS_AGENT_ID = "5cG7MbIu2oAyVy1r6RUG";

export const getSignedUrl = async () => {
  try {
    console.log("[ElevenLabs] Requesting signed URL...");
    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${ELEVENLABS_AGENT_ID}`,
      {
        method: "GET",
        headers: { "xi-api-key": ELEVENLABS_API_KEY },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get signed URL: ${response.statusText}`);
    }

    const data = await response.json();
    console.log("[ElevenLabs] Received signed URL:", data.signed_url);
    return data.signed_url;
  } catch (error) {
    console.error("[ElevenLabs] Error in getSignedUrl:", error);
    throw error;
  }
};

export const setupMediaStream = async (ws) => {
  console.info("[Server] Twilio connected to outbound media stream");

  let streamSid = null;
  let callSid = null;
  let elevenLabsWs = null;
  let customParameters = null;

  ws.on("error", console.error);

  const setupElevenLabs = async () => {
    try {
      const signedUrl = await getSignedUrl();
      console.log("[ElevenLabs] Attempting connection to:", signedUrl);
      elevenLabsWs = new WebSocket(signedUrl);

      elevenLabsWs.on("open", () => {
        console.log("[ElevenLabs] Connected to Conversational AI. readyState:", elevenLabsWs.readyState);
        const initialConfig = {
          type: "conversation_initiation_client_data",
          dynamic_variables: { user_name: "Ezequiel" },
          // Si fuese necesario, se puede habilitar conversation_config_override aquí
        };
        console.log("[ElevenLabs] Sending initial config:", initialConfig);
        elevenLabsWs.send(JSON.stringify(initialConfig));
      });

      elevenLabsWs.on("message", (data) => {
        console.log("[ElevenLabs] Raw message received:", data);
        try {
          const message = JSON.parse(data);
          switch (message.type) {
            case "conversation_initiation_metadata":
              console.log("[ElevenLabs] Received initiation metadata");
              break;
            case "audio":
              if (streamSid) {
                if (message.audio?.chunk) {
                  console.log("[ElevenLabs] Audio chunk received. Base64 length:", message.audio.chunk.length);
                  const audioData = {
                    event: "media",
                    streamSid,
                    media: { payload: message.audio.chunk },
                  };
                  ws.send(JSON.stringify(audioData));
                } else if (message.audio_event?.audio_base_64) {
                  console.log("[ElevenLabs] Audio chunk (audio_event) received. Base64 length:", message.audio_event.audio_base_64.length);
                  const audioData = {
                    event: "media",
                    streamSid,
                    media: { payload: message.audio_event.audio_base_64 },
                  };
                  ws.send(JSON.stringify(audioData));
                } else {
                  console.log("[ElevenLabs] Audio message without chunk.");
                }
              } else {
                console.log("[ElevenLabs] Received audio but streamSid not set yet.");
              }
              break;
            case "interruption":
              if (streamSid) {
                ws.send(JSON.stringify({ event: "clear", streamSid }));
              }
              break;
            case "ping":
              if (message.ping_event?.event_id) {
                console.log("[ElevenLabs] Ping received; replying with pong");
                elevenLabsWs.send(JSON.stringify({ type: "pong", event_id: message.ping_event.event_id }));
              }
              break;
            case "agent_response":
              console.log(`[Twilio] Agent response: ${message.agent_response_event?.agent_response}`);
              break;
            case "user_transcript":
              console.log(`[Twilio] User transcript: ${message.user_transcription_event?.user_transcript}`);
              break;
            default:
              console.log(`[ElevenLabs] Unhandled message type: ${message.type}`);
          }
        } catch (error) {
          console.error("[ElevenLabs] Error processing message:", error);
        }
      });

      elevenLabsWs.on("error", (error) => {
        console.error("[ElevenLabs] WebSocket error:", error);
      });

      elevenLabsWs.on("close", () => {
        console.log("[ElevenLabs] Disconnected. Final readyState:", elevenLabsWs ? elevenLabsWs.readyState : "undefined");
      });
    } catch (error) {
      console.error("[ElevenLabs] Setup error:", error);
    }
  };

  setupElevenLabs();

  ws.on("message", (message) => {
    try {
      const msg = JSON.parse(message);
      if (msg.event !== "media") {
        console.log(`[Twilio] Received event: ${msg.event}`);
      }
      switch (msg.event) {
        case "start":
          streamSid = msg.start.streamSid;
          callSid = msg.start.callSid;
          customParameters = msg.start.customParameters;
          console.log(`[Twilio] Stream started - StreamSid: ${streamSid}, CallSid: ${callSid}`);
          console.log("[Twilio] Start parameters:", customParameters);
          break;
        case "media":
          if (elevenLabsWs && elevenLabsWs.readyState === WebSocket.OPEN) {
            // Se convierte el payload utilizando Buffer, como en el código de trabajo
            const audioMessage = {
              user_audio_chunk: Buffer.from(msg.media.payload, "base64").toString("base64"),
            };
            // Removed excessive logging here
            elevenLabsWs.send(JSON.stringify(audioMessage));
          } else {
            console.log("[Twilio] ElevenLabs WebSocket not open. Current state:", elevenLabsWs ? elevenLabsWs.readyState : "undefined");
          }
          break;
        case "stop":
          console.log(`[Twilio] Stream ${streamSid} ended`);
          if (elevenLabsWs && elevenLabsWs.readyState === WebSocket.OPEN) {
            elevenLabsWs.close();
          }
          break;
        default:
          console.log(`[Twilio] Unhandled event: ${msg.event}`);
      }
    } catch (error) {
      console.error("[Twilio] Error processing message:", error);
    }
  });

  ws.on("close", () => {
    console.log("[Twilio] Client disconnected");
    if (elevenLabsWs && elevenLabsWs.readyState === WebSocket.OPEN) {
      elevenLabsWs.close();
    }
  });
};
