
// src/services/ngrokService.js
import ngrok from "ngrok";

export const startNgrokTunnel = async (port) => {
  try {
    // Try a simpler connection approach without the management API
    const publicUrl = await ngrok.connect({
      addr: port,
      onStatusChange: (status) => {
        if (status === 'connected') {
          console.log(`[ngrok] Status: Connected`);
        }
      },
      authtoken_from_env: true,
    });
    
    return publicUrl;
  } catch (error) {
    console.error("[ngrok] Error creating tunnel:", error.message);
    throw error; // Let the server handle the fallback
  }
};
