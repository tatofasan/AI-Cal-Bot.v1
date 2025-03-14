
// server.js
const express = require('express');
const path = require('path');
const logger = require('./utils/logger');
const indexRouter = require('./routes/index');
const outboundCallRouter = require('./routes/outboundCall');
const websocketsRouter = require('./routes/websockets');
const ngrokService = require('./services/ngrokService');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/outboundCall', outboundCallRouter);
app.use('/websockets', websocketsRouter);

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'html');

let ngrokUrl = null;

function startServer() {
  app.listen(port, () => {
    logger.info(`[Server] Escuchando en el puerto ${port}`);
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

module.exports = { startServer };
