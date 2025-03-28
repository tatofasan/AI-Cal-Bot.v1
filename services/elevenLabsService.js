// src/services/elevenLabsService.js
import WebSocket from "ws";
import fetch from "node-fetch";

// Configuración de ElevenLabs
const ELEVENLABS_API_KEY =
  "sk_6699a2f7d7c3982f82de20478e62ed188263055e53c25a88";
const ELEVENLABS_AGENT_ID = "KmPa2LWqjFasERSKkFsg";

/**
 * Obtiene una URL firmada para conectarse a la API de ElevenLabs
 */
export const getSignedUrl = async () => {
  try {
    console.log(
      "[ElevenLabs] Obteniendo signed URL para el agente:",
      ELEVENLABS_AGENT_ID,
    );
    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${ELEVENLABS_AGENT_ID}`,
      {
        method: "GET",
        headers: { "xi-api-key": ELEVENLABS_API_KEY },
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `[ElevenLabs] Error HTTP: ${response.status} ${response.statusText}`,
      );
      console.error(`[ElevenLabs] Respuesta de error:`, errorText);
      throw new Error(
        `Fallo al obtener signed URL: ${response.statusText} - ${errorText}`,
      );
    }

    const data = await response.json();
    console.log("[ElevenLabs] Signed URL obtenida exitosamente");
    return data.signed_url;
  } catch (error) {
    console.error("[ElevenLabs] Error en getSignedUrl:", error);
    throw error;
  }
};

/**
 * Configura el stream de medios para la comunicación entre Twilio y ElevenLabs
 */
export const setupMediaStream = async (ws) => {
  console.info(
    "[Server] WebSocket connection established for outbound media stream",
  );

  // Variables para mantener el estado
  let streamSid = null;
  let callSid = null;
  let elevenLabsWs = null;
  let customParameters = {};

  // Manejador de errores
  ws.on("error", (error) => {
    console.error("[WebSocket Error]", error);
  });

  // Función para configurar ElevenLabs
  const setupElevenLabs = async () => {
    try {
      console.log("[ElevenLabs] Iniciando conexión a ElevenLabs");
      const signedUrl = await getSignedUrl();

      elevenLabsWs = new WebSocket(signedUrl);

      elevenLabsWs.on("open", () => {
        console.log("[ElevenLabs] WebSocket conectado a ElevenLabs");

        try {
          console.log("[ElevenLabs] Enviando configuración inicial");

          // Configuración inicial
          const initialConfig = {
            type: "conversation_initiation_client_data",
            dynamic_variables: {
              user_name: customParameters.nombre || "el titular de la linea"},
          };

          elevenLabsWs.send(JSON.stringify(initialConfig));
        } catch (error) {
          console.error(
            "[ElevenLabs] Error enviando configuración inicial:",
            error,
          );
        }
      });

      elevenLabsWs.on("message", (data) => {
        try {
          const message = JSON.parse(data);

          switch (message.type) {
            case "conversation_initiation_metadata":
              console.log("[ElevenLabs] Recibido metadata de iniciación");
              break;

            case "audio":
              if (streamSid) {
                if (message.audio?.chunk) {
                  console.log("[ElevenLabs] Audio chunk recibido");
                  const audioData = {
                    event: "media",
                    streamSid,
                    media: {
                      payload: message.audio.chunk,
                    },
                  };
                  ws.send(JSON.stringify(audioData));
                } else if (message.audio_event?.audio_base_64) {
                  console.log(
                    "[ElevenLabs] Audio chunk (audio_event) recibido",
                  );
                  const audioData = {
                    event: "media",
                    streamSid,
                    media: {
                      payload: message.audio_event.audio_base_64,
                    },
                  };
                  ws.send(JSON.stringify(audioData));
                }
              } else {
                console.log(
                  "[ElevenLabs] Recibido audio pero aún no hay streamSid",
                );
              }
              break;

            case "interruption":
              console.log("[ElevenLabs] Recibido evento de interrupción");
              if (streamSid) {
                ws.send(
                  JSON.stringify({
                    event: "clear",
                    streamSid,
                  }),
                );
              }
              break;

            case "ping":
              if (message.ping_event?.event_id) {
                elevenLabsWs.send(
                  JSON.stringify({
                    type: "pong",
                    event_id: message.ping_event.event_id,
                  }),
                );
              }
              break;

            case "agent_response":
              console.log(
                `[Twilio] Respuesta del agente: ${message.agent_response_event?.agent_response}`,
              );
              // Si el bot decide terminar la llamada
              if (message.agent_response_event?.terminate_call) {
                console.log("[ElevenLabs] Bot solicitó terminar la llamada");
                ws.send(JSON.stringify({
                  event: "stop",
                  streamSid
                }));
                resetState();
              }
              break;

            case "user_transcript":
              console.log(
                `[Twilio] Transcripción del usuario: ${message.user_transcription_event?.user_transcript}`,
              );
              break;

            default:
              console.log(
                `[ElevenLabs] Tipo de mensaje no manejado: ${message.type}`,
              );
          }
        } catch (error) {
          console.error("[ElevenLabs] Error procesando mensaje:", error);
        }
      });

      elevenLabsWs.on("error", (error) => {
        console.error("[ElevenLabs] Error en WebSocket:", error);
      });

      elevenLabsWs.on("close", (code, reason) => {
        console.log(
          `[ElevenLabs] WebSocket cerrado. Código: ${code}, Razón: ${reason || "No especificada"}`,
        );
      });
    } catch (error) {
      console.error("[ElevenLabs] Error configurando ElevenLabs:", error);
    }
  };

  // Procesar mensajes de Twilio
  ws.on("message", (message) => {
    try {
      const msg = JSON.parse(message);

      if (msg.event !== "media") {
        console.log(`[Twilio] Recibido evento de Twilio: ${msg.event}`);
      }

      switch (msg.event) {
        case "start":
          streamSid = msg.start.streamSid;
          callSid = msg.start.callSid;

          // Extraer y guardar los parámetros personalizados
          if (msg.start.customParameters) {
            customParameters = msg.start.customParameters;
            console.log("[Twilio] Parámetros personalizados recibidos");
          }

          console.log(`[Twilio] Stream iniciado - StreamSid: ${streamSid}`);

          // Solo iniciar ElevenLabs después de recibir los parámetros
          setupElevenLabs();
          break;

        case "media":
          if (elevenLabsWs?.readyState === WebSocket.OPEN) {
            try {
              const audioMessage = {
                user_audio_chunk: Buffer.from(
                  msg.media.payload,
                  "base64",
                ).toString("base64"),
              };
              elevenLabsWs.send(JSON.stringify(audioMessage));
            } catch (error) {
              console.error(
                "[Twilio] Error enviando audio a ElevenLabs:",
                error,
              );
            }
          }
          break;

        case "stop":
          console.log(`[Twilio] Stream ${streamSid} finalizado`);
          if (elevenLabsWs?.readyState === WebSocket.OPEN) {
            elevenLabsWs.close();
          }
          break;

        default:
          console.log(`[Twilio] Evento no manejado: ${msg.event}`);
          break;
      }
    } catch (error) {
      console.error("[Twilio] Error procesando mensaje de Twilio:", error);
    }
  });

  // Función para reiniciar el estado
  const resetState = () => {
    streamSid = null;
    callSid = null;
    customParameters = {};
    if (elevenLabsWs?.readyState === WebSocket.OPEN) {
      elevenLabsWs.close();
    }
    elevenLabsWs = null;
  };

  // Manejar cierre de conexión
  ws.on("close", () => {
    console.log("[Twilio] Cliente desconectado");
    // Notificar a ElevenLabs
    if (elevenLabsWs?.readyState === WebSocket.OPEN) {
      elevenLabsWs.send(JSON.stringify({
        type: "call_terminated",
        reason: "client_disconnected"
      }));
    }
    resetState();
  });

  // Manejar evento de stop
  ws.on("message", (message) => {
    try {
      const msg = JSON.parse(message);
      if (msg.event === "stop") {
        console.log(`[Twilio] Stream ${streamSid} finalizado`);
        // Notificar a ElevenLabs
        if (elevenLabsWs?.readyState === WebSocket.OPEN) {
          elevenLabsWs.send(JSON.stringify({
            type: "call_terminated",
            reason: "stream_stopped"
          }));
        }
        resetState();
      }
    } catch (error) {
      console.error("[Twilio] Error procesando mensaje de cierre:", error);
    }
  });
};
