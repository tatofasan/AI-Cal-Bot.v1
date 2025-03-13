// src/services/ngrokService.js
import ngrok from "ngrok";

export const startNgrokTunnel = async (port) => {
  try {
    // First ensure ngrok is running by starting the agent
    await ngrok.authtoken("your_auth_token"); // Replace with your ngrok auth token if you have one
    
    // Configure ngrok to not need the management UI
    const publicUrl = await ngrok.connect({
      addr: port,
      onStatusChange: (status) => console.log(`[ngrok] Estado: ${status}`),
      authtoken_from_env: true, // Use NGROK_AUTHTOKEN if available
      authtoken: process.env.NGROK_AUTHTOKEN, // Optional auth token from env
    });
    console.log(`[ngrok] Tunnel URL: ${publicUrl}`);
    return publicUrl;
  } catch (error) {
    console.error("[ngrok] Error al crear el túnel:", error);
    throw error;
  }
};
