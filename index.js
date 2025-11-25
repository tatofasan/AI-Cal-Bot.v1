// index.js
import 'dotenv/config';
import { startServer } from './server.js';

// Solo ejecuta startServer() si este archivo es el módulo principal
if (import.meta.url === new URL(import.meta.url).href) {
    startServer();
}