// src/utils/logger.js
export const console = globalThis.console;
const originalLog = console.log;
const originalError = console.error;
const originalInfo = console.info;

console.log = function (...args) {
  originalLog.apply(console, args);
  // Aquí podrías enviar los logs a clientes conectados, por ejemplo:
  // logClients.forEach(client => client.send(`[LOG] ${args.join(" ")}`));
};

console.error = function (...args) {
  originalError.apply(console, args);
  // Similar para errores
};

console.info = function (...args) {
  originalInfo.apply(console, args);
  // Similar para info
};
