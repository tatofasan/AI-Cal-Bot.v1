// src/services/twilioService.js
import Twilio from "twilio";
import { getPublicUrl } from "../services/urlService.js";
// Constantes
const TWILIO_ACCOUNT_SID = "ACb593668600bd12b6cc9289e1b8e4f74d";
const TWILIO_AUTH_TOKEN = "c32049560b9edbc746c89823d42b4ac8";
const TWILIO_PHONE_NUMBER = "+17346276080";
const TWILIO_BYOC_TRUNK_SID = "BY95c610d7381f4a0c2e961ab2412a4c3c";
const TO_PHONE_NUMBER = "+541161728140";

// Crear cliente de Twilio
let twilioClient;
try {
  twilioClient = new Twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  console.log("[Twilio] Cliente inicializado correctamente");
} catch (error) {
  console.error("[Twilio] Error inicializando cliente:", error);
  throw error;
}

export const twilioCall = async ({ to_number }) => {
  console.log("[Twilio] Iniciando llamada con parámetros:", {
    toNumber: to_number || TO_PHONE_NUMBER,
  });

  const destinationNumber = to_number || TO_PHONE_NUMBER;

  // Usar la URL forzada para asegurar que Twilio se conecte correctamente
  const publicUrl = getPublicUrl();

  // Construir la URL para TwiML con parámetros codificados
  // Ensure the URL has https:// prefix
  const baseUrl = publicUrl.startsWith('http') ? publicUrl : `https://${publicUrl}`;
  const twimlUrl = `${baseUrl}/outbound-call-twiml`;

  console.log("[Twilio] URL TwiML:", twimlUrl);

  try {
    console.log("[Twilio] Enviando petición a API de Twilio...");

    const callOptions = {
      from: TWILIO_PHONE_NUMBER,
      to: destinationNumber,
      url: twimlUrl,
      byoc: TWILIO_BYOC_TRUNK_SID,
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