// src/services/twilio/twilioConfig.js
import Twilio from "twilio";

// Constantes de configuración de Twilio desde variables de entorno
export const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
export const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
export const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;
export const TWILIO_BYOC_TRUNK_SID = process.env.TWILIO_BYOC_TRUNK_SID;
export const DEFAULT_TO_PHONE_NUMBER = process.env.DEFAULT_TO_PHONE_NUMBER;

/**
 * Crea e inicializa el cliente de Twilio
 * @returns {object} Cliente inicializado de Twilio
 */
export const initializeTwilioClient = () => {
  try {
    // Verificar que las credenciales estén disponibles
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
      throw new Error("Credenciales de Twilio no configuradas en variables de entorno");
    }

    const client = new Twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    console.log("[Twilio] Cliente inicializado correctamente");
    return client;
  } catch (error) {
    console.error("[Twilio] Error inicializando cliente:", error);
    throw error;
  }
};

// Crear y exportar la instancia del cliente
export const twilioClient = initializeTwilioClient();