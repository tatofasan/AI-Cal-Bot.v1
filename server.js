
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from './utils/logger.js';
import indexRouter from './routes/index.js';
import outboundCallRouter from './routes/outboundCall.js';
import websocketsRouter from './routes/websockets.js';
import ngrokService from './services/ngrokService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

export { startServer };
