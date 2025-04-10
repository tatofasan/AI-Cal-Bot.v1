// src/services/elevenlabs/elevenLabsApi.js
import fetch from "node-fetch";

// Configuración de ElevenLabs
const ELEVENLABS_API_KEY =
  "sk_6699a2f7d7c3982f82de20478e62ed188263055e53c25a88";
const ELEVENLABS_AGENT_ID = "KmPa2LWqjFasERSKkFsg";

/**
 * Obtiene una URL firmada para conectarse a la API de ElevenLabs
 * @returns {Promise<string>} URL firmada para la conexión
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