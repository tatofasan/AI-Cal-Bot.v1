
// src/services/ngrokService.js
import ngrok from "ngrok";

export const startNgrokTunnel = async (port) => {
  try {
    // Check if NGROK_AUTHTOKEN exists in environment
    if (!process.env.NGROK_AUTHTOKEN) {
      console.warn("[ngrok] No NGROK_AUTHTOKEN found in environment variables");
      throw new Error("Missing NGROK_AUTHTOKEN");
    }
    
    // Connect with simplified options
    const publicUrl = await ngrok.connect({
      addr: port,
      authtoken: process.env.NGROK_AUTHTOKEN
    });
    
    return publicUrl;
  } catch (error) {
    console.error("[ngrok] Error creating tunnel:", error.message);
    throw error; // Let the server handle the fallback
  }
};
