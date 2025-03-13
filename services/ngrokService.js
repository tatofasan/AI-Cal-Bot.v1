
// src/services/ngrokService.js
import ngrok from "ngrok";

export const startNgrokTunnel = async (port) => {
  try {
    // Using the auth token directly from environment or hardcoded for testing
    const authToken = process.env.NGROK_AUTHTOKEN || "cr_2uGR6pzrud1x8wTB3xNvHUIfvNF";
    
    // Set the auth token first
    await ngrok.authtoken(authToken);
    
    // Then connect to the tunnel with minimal options
    const publicUrl = await ngrok.connect({
      addr: port,
      region: 'us',
    });
    
    console.log(`[ngrok] Successfully connected to: ${publicUrl}`);
    return publicUrl;
  } catch (error) {
    console.error("[ngrok] Error creating tunnel:", error.message);
    throw error; // Let the server handle the fallback
  }
};
