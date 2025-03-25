// src/services/urlService.js
// Simple service to store and retrieve the public URL across the application

// Default URL is null, will be set after ngrok/server starts
let publicUrl = null;

/**
 * Gets the current public URL
 * @returns {string} The public URL
 */
export const getPublicUrl = () => {
  return process.env.REPLIT_DOMAINS;
};
