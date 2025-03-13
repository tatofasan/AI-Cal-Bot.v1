
// src/services/ngrokService.js
import ngrok from "ngrok";

export const startNgrokTunnel = async (port) => {
  try {
    // Using the auth token directly from environment or hardcoded for testing
    const authToken = process.env.NGROK_AUTHTOKEN || "cr_2uGR6pzrud1x8wTB3xNvHUIfvNF";
    
    // Connect with simplified options and no management API dependency
    const publicUrl = await ngrok.connect({
      addr: port,
      authtoken: authToken,
      onLogEvent: (data) => {
        if (data.obj === "err") {
          console.error(`[ngrok] ${data.msg}`);
        } else {
          console.log(`[ngrok] ${data.msg}`);
        }
      }
    });
    
    return publicUrl;
  } catch (error) {
    console.error("[ngrok] Error creating tunnel:", error.message);
    throw error; // Let the server handle the fallback
  }
};
