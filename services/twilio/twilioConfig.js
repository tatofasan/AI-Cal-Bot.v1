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
 * @returns {object|null} Cliente inicializado de Twilio o null si no hay credenciales
 */
export const initializeTwilioClient = () => {
  try {
    // Verificar que las credenciales estén disponibles
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN ||
        TWILIO_ACCOUNT_SID === 'your_twilio_account_sid_here' ||
        TWILIO_AUTH_TOKEN === 'your_twilio_auth_token_here') {
      console.warn("[Twilio] Credenciales no configuradas. El servidor iniciará pero las llamadas no funcionarán.");
      console.warn("[Twilio] Configura TWILIO_ACCOUNT_SID y TWILIO_AUTH_TOKEN en el archivo .env");
      return null;
    }

    const client = new Twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    console.log("[Twilio] Cliente inicializado correctamente");
    return client;
  } catch (error) {
    console.error("[Twilio] Error inicializando cliente:", error);
    return null;
  }
};

// Crear y exportar la instancia del cliente
export const twilioClient = initializeTwilioClient();