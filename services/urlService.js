// src/services/urlService.js
// Simple service to store and retrieve the public URL across the application

export const REPLIT_URL = `https://${process.env.REPLIT_DOMAINS}`;

/**
 * Gets the current public URL
 * @returns {string} The public URL
 */
export const getPublicUrl = () => {
  return REPLIT_URL;
};
