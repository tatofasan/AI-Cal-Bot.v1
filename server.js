// server.js
const express = require('express');
const path = require('path');
const logger = require('./utils/logger');
const indexRouter = require('./routes/index');
const outboundCallRouter = require('./routes/outboundCall');
const websocketsRouter = require('./routes/websockets');
const ngrokService = require('./services/ngrokService');

const app = express();
const port = process.env.PORT || 3000; // Define el puerto aquí

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

// Rutas
app.use('/', indexRouter);
app.use('/outboundCall', outboundCallRouter);
app.use('/websockets', websocketsRouter);

// Configuración de las vistas (si es necesario)
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'html'); // O el motor de plantillas que estés usando

let ngrokUrl = null;

async function startServer() {
  app.listen(port, () => {
    logger.info(`[Server] Escuchando en el puerto ${port}`);
    // Iniciar ngrok solo si no estamos en un entorno de Replit
    if (!process.env.REPL_ID) {
      ngrokService.startNgrok(port)
        .then((url) => {
          ngrokUrl = url;
          if (ngrokUrl) {
            logger.info(`[Server] URL pública (ngrok): ${ngrokUrl}`);
          }
        })
        .catch(error => {
          logger.error(`[Server] Error al iniciar ngrok: ${error.message}`);
        });
    } else {
      logger.info(`[Server] URL pública (Replit): https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`);
      logger.info(`[Server] Servidor disponible en: https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`);
    }
  });
}