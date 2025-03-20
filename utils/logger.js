
// src/utils/logger.js
export const console = globalThis.console;
const originalLog = console.log;
const originalError = console.error;
const originalInfo = console.info;
const originalWarn = console.warn;

// Array para mantener los clientes WebSocket
export const logClients = new Set();

// Función para enviar logs a todos los clientes conectados
const broadcastLog = (type, args) => {
  const timestamp = new Date().toISOString();
  const message = `[${timestamp}] [${type}] ${args.join(' ')}`;
  logClients.forEach(client => {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(message);
    }
  });
};

console.log = function (...args) {
  originalLog.apply(console, args);
  broadcastLog('LOG', args);
};

console.error = function (...args) {
  originalError.apply(console, args);
  broadcastLog('ERROR', args);
};

console.info = function (...args) {
  originalInfo.apply(console, args);
  broadcastLog('INFO', args);
};

console.warn = function (...args) {
  originalWarn.apply(console, args);
  broadcastLog('WARN', args);
};
