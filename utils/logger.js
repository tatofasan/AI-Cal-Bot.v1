// src/utils/logger.js
import { broadcastToSession } from './sessionManager.js';

export const console = globalThis.console;
const originalLog = console.log;
const originalError = console.error;
const originalInfo = console.info;
const originalWarn = console.warn;
const originalDebug = console.debug;

// Set para mantener las conexiones WebSocket activas (mantenido por compatibilidad)
export const logClients = new Set();

// Función para enviar logs a los clientes conectados de una sesión específica
const broadcastLog = (type, args, sessionId = null) => {
  const timestamp = new Date().toISOString();
  const message = `[${type}] ${args.join(' ')}`;

  // Si no hay sessionId, no enviamos a los logClients genéricos
  // Este es el cambio principal - Ya no transmitimos a todos los clientes por defecto

  // Solo enviar al sessionId específico si existe
  if (sessionId) {
    broadcastToSession(sessionId, message);
  }
};

// Override de todas las funciones de console
console.log = function (...args) {
  originalLog.apply(console, args);

  // Intentar extraer sessionId si el último argumento es un objeto con esa propiedad
  let sessionId = null;
  if (args.length > 0 && typeof args[args.length - 1] === 'object' && args[args.length - 1]?.sessionId) {
    sessionId = args[args.length - 1].sessionId;
    // Eliminar el objeto sessionId de los argumentos para no incluirlo en el log
    args = args.slice(0, args.length - 1);
  }

  broadcastLog('LOG', args, sessionId);
};

console.error = function (...args) {
  originalError.apply(console, args);

  let sessionId = null;
  if (args.length > 0 && typeof args[args.length - 1] === 'object' && args[args.length - 1]?.sessionId) {
    sessionId = args[args.length - 1].sessionId;
    args = args.slice(0, args.length - 1);
  }

  broadcastLog('ERROR', args, sessionId);
};

console.info = function (...args) {
  originalInfo.apply(console, args);

  let sessionId = null;
  if (args.length > 0 && typeof args[args.length - 1] === 'object' && args[args.length - 1]?.sessionId) {
    sessionId = args[args.length - 1].sessionId;
    args = args.slice(0, args.length - 1);
  }

  broadcastLog('INFO', args, sessionId);
};

console.warn = function (...args) {
  originalWarn.apply(console, args);

  let sessionId = null;
  if (args.length > 0 && typeof args[args.length - 1] === 'object' && args[args.length - 1]?.sessionId) {
    sessionId = args[args.length - 1].sessionId;
    args = args.slice(0, args.length - 1);
  }

  broadcastLog('WARN', args, sessionId);
};

console.debug = function (...args) {
  originalDebug.apply(console, args);

  let sessionId = null;
  if (args.length > 0 && typeof args[args.length - 1] === 'object' && args[args.length - 1]?.sessionId) {
    sessionId = args[args.length - 1].sessionId;
    args = args.slice(0, args.length - 1);
  }

  broadcastLog('DEBUG', args, sessionId);
};

// Exportar función para enviar un mensaje específico a una sesión
export const sendLogToSession = (sessionId, type, message) => {
  broadcastLog(type, [message], sessionId);
};