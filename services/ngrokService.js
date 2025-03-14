// src/services/ngrokService.js
import ngrok from "ngrok";
import "../utils/logger.js";
import { console as logger } from "console";

export const startNgrokTunnel = async (port) => {
  logger.info("[ngrok] Attempting to connect to ngrok...");
  try {
    // Try a simpler connection approach without the management API
    const publicUrl = await ngrok.connect({
      addr: port,
      onStatusChange: (status) => {
        logger.info(`[ngrok] Status changed: ${status}`);
        if (status === 'connecting') {
          logger.info("[ngrok] [ngrok] Attempting to establish connection...");
        } else if (status === 'connected') {
          logger.info("[ngrok] [ngrok] Connection established successfully.");
        } else if (status === 'disconnected') {
          logger.warn("[ngrok] [ngrok] Connection was disconnected.");
        } else if (status === 'reconnecting') {
          logger.info("[ngrok] [ngrok] Attempting to reconnect...");
        } else if (status === 'fatal_error') {
          logger.error("[ngrok] [ngrok] A fatal error occurred with ngrok.");
        }
      },
      authtoken_from_env: true,
      // You can try adding more detailed logging options if available in the ngrok library
      // For example, some libraries allow specifying a log level.
      // However, the 'ngrok' package might not expose such fine-grained control directly.

      // You could also try specifying a region if you suspect regional issues
      // region: 'us', // Example: 'us', 'eu', 'ap', etc.
    });

    logger.info(`[ngrok] Tunnel created successfully. Public URL: ${publicUrl}`);
    return publicUrl;
  } catch (error) {
    logger.error("[ngrok] Error creating tunnel:", error.message);
    logger.error("[ngrok] Full ngrok error object:", error); // Log the full error object
    throw error; // Let the server handle the fallback
  }
};