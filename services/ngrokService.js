import ngrok from "ngrok";
import "../utils/logger.js";
const logger = console;

export const startNgrokTunnel = async (port) => {
  // Check if running in Replit environment
  const isReplitEnvironment = process.env.REPL_ID || process.env.REPL_SLUG;


  // If not in Replit, attempt to use ngrok normally
  logger.info("[ngrok] Attempting to connect to ngrok...");
  try {
    // Try to kill any existing ngrok processes first
    try {
      await ngrok.kill();
    } catch (killError) {
      logger.warn(
        "[ngrok] Error killing existing ngrok processes:",
        killError.message,
      );
    }

    const publicUrl = await ngrok.connect({
      addr: port,
      authtoken_from_env: true,
      onStatusChange: (status) => {
        logger.info(`[ngrok] Status changed: ${status}`);
      },
    });

    logger.info(
      `[ngrok] Tunnel created successfully. Public URL: ${publicUrl}`,
    );
    return publicUrl;
  } catch (error) {
    logger.error("[ngrok] Error creating tunnel:", error.message);
    logger.error("[ngrok] Full ngrok error object:", error);
    throw new Error(`[ngrok] Failed to create tunnel: ${error.message}`);
  }
};
