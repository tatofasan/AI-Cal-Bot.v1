// src/services/urlService.js
// Simple service to store and retrieve the public URL across the application

export const REPLIT_URL = `https://${process.env.REPLIT_DOMAINS}`;

// Default URL is null, will be set after ngrok/server starts
let publicUrl = null;

/**
 * Sets the public URL for the application
 * @param {string} url - The public URL to set
 */
export const setPublicUrl = (url) => {
  if (!url) {
    console.warn("[URLService] Attempting to set empty publicUrl");
    return;
  }

  // Validar y normalizar la URL para evitar problemas
  try {
    // Asegurarse de que la URL tenga un protocolo
    let normalizedUrl = url;
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      normalizedUrl = `https://${url}`;
    }

    // Verificar que sea una URL válida
    new URL(normalizedUrl);

    console.log(`[URLService] Setting public URL to: ${normalizedUrl}`);
    publicUrl = normalizedUrl;

    // Also set it globally for backward compatibility
    global.publicUrl = normalizedUrl;
  } catch (error) {
    console.error(`[URLService] Invalid URL format: ${url}`, error);
  }
};

/**
 * Gets the current public URL
 * @returns {string} The public URL
 */
export const getPublicUrl = () => {
  if (!publicUrl) {
    console.warn(
      "[URLService] Attempting to get publicUrl before it has been set",
    );
  }
  return publicUrl;
};
