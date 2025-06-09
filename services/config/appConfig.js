// src/services/config/appConfig.js

/**
 * Configuración general de la aplicación
 */

// Cargar variables de entorno ANTES de definir las configuraciones
import dotenv from 'dotenv';
dotenv.config();

// Configuración de URL y entorno
export const APP_ENV = process.env.NODE_ENV || 'development';
export const APP_PUBLIC_URL = `https://${process.env.REPLIT_DOMAINS}`;

/**
 * Obtiene la URL pública de la aplicación
 * @returns {string} URL pública de la aplicación
 */
export const getPublicUrl = () => {
  return APP_PUBLIC_URL;
};

/**
 * Verifica si la aplicación está en modo de producción
 * @returns {boolean} true si está en producción, false si no
 */
export const isProduction = () => {
  return APP_ENV === 'production';
};

/**
 * Configuración de SIP trunk
 */
export const sipConfig = {
  trunkAddress: process.env.SIP_TRUNK_ADDRESS,
  defaultToNumber: process.env.DEFAULT_TO_PHONE_NUMBER,
  callerNumber: process.env.ELEVENLABS_CALLER_NUMBER
};

/**
 * Configuración de ElevenLabs
 */
export const elevenLabsConfig = {
  apiKey: process.env.ELEVENLABS_API_KEY,
  agentId: process.env.ELEVENLABS_AGENT_ID,
  phoneNumberId: process.env.ELEVENLABS_PHONE_NUMBER_ID,
  sipPhoneNumberId: process.env.ELEVENLABS_SIP_PHONE_NUMBER_ID || 'phnum_01jwekz3ppe8sb6hq921g0bmn3',
  callerNumber: process.env.ELEVENLABS_CALLER_NUMBER,
  webhookBaseUrl: process.env.WEBHOOK_BASE_URL || APP_PUBLIC_URL
};

/**
 * Configuración general de la aplicación en un solo objeto
 */
export const appConfig = {
  environment: APP_ENV,
  publicUrl: APP_PUBLIC_URL,
  server: {
    port: process.env.PORT || 8000,
    host: '0.0.0.0'
  },
  sip: sipConfig,
  elevenLabs: elevenLabsConfig
};