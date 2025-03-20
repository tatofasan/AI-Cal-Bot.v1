import ngrok from "ngrok";
import "../utils/logger.js";
const logger = console;

export const startNgrokTunnel = async (port) => {
  logger.info("[ngrok] Attempting to connect to ngrok...");
  let publicUrl;
  try {
    // Comentar o eliminar la llamada a ngrok.kill(), ya que el ejemplo funcional no la usa
    // try {
    //   await ngrok.kill();
    // } catch (killError) {
    //   logger.warn("[ngrok] Error killing existing ngrok processes:", killError.message);
    // }
    logger.info("[ngrok] Trying to connect");
    publicUrl = await ngrok.connect({
      addr: port,
      authtoken_from_env: true, // Usar authtoken desde la variable de entorno
      onStatusChange: (status) => {
        logger.info(`[ngrok] Status changed: ${status}`);
      },
    });
    logger.info("[ngrok] Connected");
    logger.info(`[ngrok] Tunnel created successfully. Public URL: ${publicUrl}`);
    return publicUrl;
  } catch (error) {
    logger.info(`[ngrok] Tunnel failed. Public URL: ${publicUrl}`);
    logger.error("[ngrok] Error creating tunnel:", error.message);
    logger.error("[ngrok] Full ngrok error object:", error);
    throw new Error(`[ngrok] Failed to create tunnel: ${error.message}`);
  }
};
