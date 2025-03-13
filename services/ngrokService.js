
// src/services/ngrokService.js
import ngrok from "ngrok";

export const startNgrokTunnel = async (port) => {
  try {
    // Configure ngrok to not use the management API
    const publicUrl = await ngrok.connect({
      addr: port,
      onStatusChange: (status) => console.log(`[ngrok] Estado: ${status}`),
      authtoken_from_env: true,
      noAuthAPI: true, // Skip using the management API
      noServerMetrics: true // Skip metrics collection
    });
    console.log(`[ngrok] Tunnel URL: ${publicUrl}`);
    return publicUrl;
  } catch (error) {
    console.error("[ngrok] Error al crear el túnel:", error);
    throw error;
  }
};
