// src/services/elevenLabsService.js
import WebSocket from "ws";
import fetch from "node-fetch";
import { amplifyAudio } from "../utils/audioAmplifier.js";  // <== NUEVO: Importar la función de amplificación

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
          // Extraer el nombre del usuario de los parámetros
          const userName = customParameters?.user_name || "Usuario";

          console.log("[ElevenLabs] Enviando configuración inicial");
          console.log("[ElevenLabs] Voiceid", customParameters?.voice_id);

          // Lista de voces disponibles
          const availableVoices = [
            {id: "15bJsujCI3tcDWeoZsQP", name: "Ernesto Ferran"},
            {id: "dXzxF8F6baTsuGSxeorB", name: "Valeria Rodriguez"},
            {id: "ukupJ4zdf9bo1Py6MiO6", name: "Bruno Fernandez"},
            {id: "YExhVa4bZONzeingloMX", name: "Juan Carlos Gutierrez"},
            {id: "rEVYTKPqwSMhytFPayIb", name: "Sandra Valenzuela"},
            {id: "B5TKeu06uYzJCV6Pss3g", name: "Fernando Mansilla"},
            {id: "qHkrJuifPpn95wK3rm2A", name: "Andrea Chamorro"}
          ];

          // Si se seleccionó random, elegir una voz aleatoria
          let selectedVoiceId = customParameters?.voice_id;
          let selectedVoiceName = customParameters?.voice_name;

          if (selectedVoiceId === 'random') {
            const randomVoice = availableVoices[Math.floor(Math.random() * availableVoices.length)];
            selectedVoiceId = randomVoice.id;
            selectedVoiceName = randomVoice.name;
            console.log("[ElevenLabs] Voz aleatoria seleccionada:", selectedVoiceName);
          }

          // Configuración inicial con conversation_config_override para tts utilizando la estructura requerida
          const initialConfig = {
            type: "conversation_initiation_client_data",
            dynamic_variables: {
              user_name: userName,
              voice_name: selectedVoiceName || ""
            },
            conversation_config_override: {
              tts: {
                voice_id: selectedVoiceId || ""
              }
            }
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
                const payload = message.audio?.chunk || message.audio_event?.audio_base_64;
                if (payload) {
                  console.log("[ElevenLabs] Audio chunk recibido");

                  // Enviar a Twilio
                  const audioData = {
                    event: "media",
                    streamSid,
                    media: {
                      payload,
                    },
                  };
                  ws.send(JSON.stringify(audioData));

                  // Enviar a todos los clientes de logs (frontend) para el audio del bot
                  import('../utils/logger.js').then(({ logClients }) => {
                    logClients.forEach(client => {
                      if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify({
                          type: "audio",
                          payload
                        }));
                      }
                    });
                  });
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

      elevenLabsWs.on("close", async (code, reason) => {
        console.log(
          `[ElevenLabs] WebSocket cerrado. Código: ${code}, Razón: ${reason || "No especificada"}`,
        );

        if (callSid) {
          try {
            const { twilioClient } = await import("./twilioService.js");
            // Verificar estado actual de la llamada
            const call = await twilioClient.calls(callSid).fetch();

            if (call.status !== "completed" && call.status !== "canceled") {
              await twilioClient.calls(callSid).update({ status: "completed" });
              console.log(
                `[ElevenLabs] Llamada ${callSid} finalizada correctamente via twilioService`,
              );
            } else {
              console.log(
                `[ElevenLabs] Llamada ${callSid} ya estaba finalizada (estado: ${call.status})`,
              );
            }
          } catch (error) {
            console.error(
              "[ElevenLabs] Error al verificar/finalizar la llamada:",
              error,
            );
          }
        }
      });
    } catch (error) {
      console.error("[ElevenLabs] Error configurando ElevenLabs:", error);
    }
  };

  // Procesar mensajes de Twilio
  ws.on("message", (message) => {
    try {
      const msg = JSON.parse(message);

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
              // Aplicar amplificación al audio recibido antes de enviarlo a ElevenLabs
              const amplifiedPayload = amplifyAudio(msg.media.payload, 2.0);
              const audioMessage = {
                user_audio_chunk: amplifiedPayload,
              };
              elevenLabsWs.send(JSON.stringify(audioMessage));
            } catch (error) {
              console.error("[Twilio] Error enviando audio a ElevenLabs:", error);
            }
          }
          // Reenviar el audio del cliente a los log clients para monitoreo
          import('../utils/logger.js').then(({ logClients }) => {
            logClients.forEach(client => {
              if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({
                  type: "client_audio",
                  payload: msg.media.payload
                }));
              }
            });
          });
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

  // Manejar cierre de conexión
  ws.on("close", () => {
    console.log("[Twilio] Cliente desconectado");
    if (elevenLabsWs?.readyState === WebSocket.OPEN) {
      elevenLabsWs.close();
    }
  });
};
