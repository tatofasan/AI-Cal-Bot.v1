// src/services/config/appConfig.js

/**
 * Configuración general de la aplicación
 */

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
 * Configuración general de la aplicación en un solo objeto
 */
export const appConfig = {
  environment: APP_ENV,
  publicUrl: APP_PUBLIC_URL,
  server: {
    port: process.env.PORT || 8000,
    host: '0.0.0.0'
  }
};