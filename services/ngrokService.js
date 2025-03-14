// services/ngrokService.js
const ngrok = require('ngrok');
const logger = require('../utils/logger');

let ngrokUrl = null;

async function startNgrok(port) {
  try {
    ngrokUrl = await ngrok.connect({
      addr: port, // Asegúrate de que este puerto sea el correcto (debería ser 3000)
      // Otros parámetros de configuración de ngrok pueden ir aquí
    });
    logger.info(`[ngrok] Túnel creado exitosamente: ${ngrokUrl}`);
    return ngrokUrl;
  } catch (error) {
    logger.error(`[ngrok] Error al crear el túnel: ${error.message}`);
    logger.error(`[ngrok] Error detallado: ${error}`);
    return null;
  }
}

function getNgrokUrl() {
  return ngrokUrl;
}

module.exports = { startNgrok, getNgrokUrl };