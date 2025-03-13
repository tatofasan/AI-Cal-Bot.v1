
// src/services/ngrokService.js
import ngrok from "ngrok";

export const startNgrokTunnel = async (port) => {
  try {
    // Check for required auth token
    const authToken = process.env.NGROK_AUTHTOKEN || "cr_2uGR6pzrud1x8wTB3xNvHUIfvNF";
    if (!authToken) {
      throw new Error("Missing ngrok auth token");
    }

    // Simple configuration to avoid complex options
    const url = await ngrok.connect({
      proto: 'http',
      addr: port,
      authtoken: authToken,
      region: 'us'
    });

    console.log(`[ngrok] Successfully connected to: ${url}`);
    return url;
  } catch (error) {
    // More specific error logging
    console.error(`[ngrok] Error creating tunnel: ${error.message}`);
    if (error.stack) {
      console.error(`[ngrok] Error stack: ${error.stack}`);
    }
    throw error; // Let the server handle the fallback
  }
};
