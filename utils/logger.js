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

// Configuración de filtrado de logs
const LOG_FILTERS = {
  // Lista de patrones que serán filtrados para evitar spam
  excludePatterns: [
    '[StreamManager] Eliminada conexión',
    'Cliente desconectado',
    'No hay conexión ElevenLabs activa',
    'Conexión Twilio',
    'Audio chunk recibido',
    'Mensaje enviado a elevenlabs para sesión' // Añadido el patrón específico para eliminar completamente
  ],
  // Contador para reducir la frecuencia de ciertos tipos de mensajes
  counters: {
    audio: 0,
    connection: 0,
    heartbeat: 0
  },
  // Cuántos mensajes omitir antes de mostrar uno (por tipo)
  frequencies: {
    audio: 100,
    connection: 50,
    heartbeat: 100
  }
};

// Comprobar si un mensaje debe ser filtrado
const shouldFilterMessage = (message) => {
  // Filtrar mensajes que contienen patrones específicos
  for (const pattern of LOG_FILTERS.excludePatterns) {
    if (typeof message === 'string' && message.includes(pattern)) {
      return true;
    }
  }

  // Reducir frecuencia de logs de audio
  if (typeof message === 'string' && message.includes('Audio chunk')) {
    LOG_FILTERS.counters.audio++;
    return LOG_FILTERS.counters.audio % LOG_FILTERS.frequencies.audio !== 0;
  }

  // Reducir frecuencia de logs de conexión
  if (typeof message === 'string' && (message.includes('conexión') || message.includes('WebSocket'))) {
    LOG_FILTERS.counters.connection++;
    return LOG_FILTERS.counters.connection % LOG_FILTERS.frequencies.connection !== 0;
  }

  // Filtrar heartbeats
  if (typeof message === 'string' && message.includes('HEARTBEAT')) {
    LOG_FILTERS.counters.heartbeat++;
    return LOG_FILTERS.counters.heartbeat % LOG_FILTERS.frequencies.heartbeat !== 0;
  }

  return false;
};

// Función para enviar logs a los clientes conectados de una sesión específica
const broadcastLog = (type, args, sessionId = null) => {
  const timestamp = new Date().toISOString();
  const message = `[${type}] ${args.join(' ')}`;

  // Verificar si el mensaje debe ser filtrado para reducir el spam
  if (shouldFilterMessage(message)) {
    return;
  }

  // Si no hay sessionId, usamos el comportamiento original para compatibilidad
  if (!sessionId) {
    logClients.forEach(client => {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(message);
      }
    });
    return;
  }

  // Enviar al sessionId específico
  broadcastToSession(sessionId, message);
};

// Override de todas las funciones de console
console.log = function (...args) {
  // Verificar antes de loguear en la consola si contiene "[StreamManager] Mensaje enviado a elevenlabs para sesión"
  const fullMessage = args.join(' ');
  const shouldSkipConsoleLog = typeof fullMessage === 'string' && 
                              fullMessage.includes('Mensaje enviado a elevenlabs para sesión');

  // Solo ejecutar el log original si no es el mensaje específico que queremos quitar
  if (!shouldSkipConsoleLog) {
    originalLog.apply(console, args);
  }

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