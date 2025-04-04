// src/services/twilioService.js
import Twilio from "twilio";

// Constantes
const TWILIO_ACCOUNT_SID = "ACb593668600bd12b6cc9289e1b8e4f74d";
const TWILIO_AUTH_TOKEN = "c32049560b9edbc746c89823d42b4ac8";
const TWILIO_PHONE_NUMBER = "+17346276080";
const TWILIO_BYOC_TRUNK_SID = "BY95c610d7381f4a0c2e961ab2412a4c3c";
const TO_PHONE_NUMBER = "+541161728140";
import { REPLIT_URL } from './urlService.js';

// Crear cliente de Twilio
let twilioClient;
try {
  twilioClient = new Twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  console.log("[Twilio] Cliente inicializado correctamente");
} catch (error) {
  console.error("[Twilio] Error inicializando cliente:", error);
  throw error;
}

export const twilioCall = async ({ user_name, to_number, voice_id, customParameters }) => {
  console.log("[Twilio] Iniciando llamada con parámetros:", {
    userName: user_name,
    toNumber: to_number || TO_PHONE_NUMBER,
    voiceId: voice_id,
    customParameters: customParameters
  });

  const destinationNumber = to_number || TO_PHONE_NUMBER;

  // Usar la URL forzada para asegurar que Twilio se conecte correctamente
  const publicUrl = REPLIT_URL;

  // Construir la URL para TwiML con parámetros codificados, incluyendo voice_id si existe
  const queryParams =
    `user_name=${encodeURIComponent(user_name || "")}` +
    (voice_id ? `&voice_id=${encodeURIComponent(voice_id)}` : "") +
    (customParameters && customParameters.voice_name ? `&voice_name=${encodeURIComponent(customParameters.voice_name)}` : "");
  const twimlUrl = `${publicUrl}/outbound-call-twiml?${queryParams}`;

  console.log("[Twilio] URL TwiML:", twimlUrl);

  try {
    console.log("[Twilio] Enviando petición a API de Twilio...");

    const callOptions = {
      from: TWILIO_PHONE_NUMBER,
      to: destinationNumber,
      url: twimlUrl,
      byoc: TWILIO_BYOC_TRUNK_SID,
      machineDetection: true,
    };

    console.log("[Twilio] Opciones de llamada:", callOptions);

    const call = await twilioClient.calls.create(callOptions);

    console.log("[Twilio] Llamada iniciada con éxito:", call.sid);
    return {
      success: true,
      message: "Call initiated",
      callSid: call.sid,
      destinationNumber,
    };
  } catch (error) {
    console.error("[Twilio] Error al iniciar llamada:", error);
    console.error("[Twilio] Detalles adicionales:", {
      code: error.code,
      status: error.status,
      moreInfo: error.moreInfo,
    });
    throw error;
  }
};

export { twilioClient };