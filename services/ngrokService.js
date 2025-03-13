// src/services/ngrokService.js
import ngrok from "ngrok";

export const startNgrokTunnel = async (port) => {
  try {
    const publicUrl = await ngrok.connect({
      addr: port,
      onStatusChange: (status) => console.log(`[ngrok] Estado: ${status}`),
    });
    return publicUrl;
  } catch (error) {
    console.error("[ngrok] Error al crear el túnel:", error);
    throw error;
  }
};
