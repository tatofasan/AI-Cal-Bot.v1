
// src/services/ngrokService.js
import ngrok from "ngrok";

export const startNgrokTunnel = async (port) => {
  try {
    // Kill any existing ngrok processes first to ensure a clean start
    try {
      await ngrok.kill();
    } catch (killError) {
      // Ignore kill errors
    }
    
    // Use environment variable or default token
    const authToken = process.env.NGROK_AUTHTOKEN || "cr_2uGR6pzrud1x8wTB3xNvHUIfvNF";
    
    // Configure ngrok with direct options
    const url = await ngrok.connect({
      addr: port,
      authtoken: authToken,
      onStatusChange: (status) => {
        console.log(`[ngrok] Status changed: ${status}`);
      }
    });
    
    console.log(`[ngrok] Tunnel created successfully at: ${url}`);
    return url;
  } catch (error) {
    // Provide detailed error information
    console.error(`[ngrok] Error creating tunnel: ${error.message}`);
    
    // If available, log the detailed stack trace
    if (error.stack) {
      console.error(`[ngrok] Error stack: ${error.stack}`);
    }
    
    // Throw the error to be handled by the server
    throw error;
  }
};
