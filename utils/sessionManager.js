// src/utils/sessionManager.js

/**
 * Gestor de sesiones para mantener aisladas las conexiones de diferentes clientes
 * 
 * Este módulo permite agrupar todas las conexiones WebSocket relacionadas
 * con una sesión específica, asegurando que los mensajes y audio se envíen
 * solo a las conexiones pertenecientes a la misma sesión.
 */

// Almacenamiento de sesiones y sus conexiones asociadas
const sessions = new Map();

/**
 * Registra una nueva sesión o devuelve una existente
 * @param {string} sessionId - ID único de sesión
 * @returns {Object} - Objeto de sesión con sus conexiones
 */
export function getOrCreateSession(sessionId) {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      id: sessionId,
      logClients: new Set(),
      twilioWs: null,
      elevenLabsWs: null,
      agentWs: null,        
      callSid: null,
      isAgentActive: false, 
      createdAt: Date.now()
    });
    console.log(`[SessionManager] Nueva sesión creada: ${sessionId}`);
  }
  return sessions.get(sessionId);
}

/**
 * Registra un cliente de logs en una sesión
 * @param {string} sessionId - ID de sesión
 * @param {WebSocket} ws - Conexión WebSocket del cliente de logs
 */
export function registerLogClient(sessionId, ws) {
  const session = getOrCreateSession(sessionId);
  session.logClients.add(ws);

  // Agregar el sessionId como propiedad del WebSocket para facilitar la limpieza
  ws.sessionId = sessionId;

  console.log(`[SessionManager] Cliente de logs agregado a sesión ${sessionId}, total: ${session.logClients.size}`);
}

/**
 * Registra una conexión Twilio para una sesión
 * @param {string} sessionId - ID de sesión
 * @param {WebSocket} ws - Conexión WebSocket de Twilio
 */
export function registerTwilioConnection(sessionId, ws) {
  const session = getOrCreateSession(sessionId);
  session.twilioWs = ws;

  // Agregar el sessionId como propiedad del WebSocket
  ws.sessionId = sessionId;

  console.log(`[SessionManager] Conexión Twilio registrada para sesión ${sessionId}`);
}

/**
 * Registra una conexión ElevenLabs para una sesión
 * @param {string} sessionId - ID de sesión
 * @param {WebSocket} ws - Conexión WebSocket de ElevenLabs
 * @param {string} callSid - SID de la llamada asociada
 */
export function registerElevenLabsConnection(sessionId, ws, callSid) {
  const session = getOrCreateSession(sessionId);
  session.elevenLabsWs = ws;
  session.callSid = callSid;

  // Agregar el sessionId como propiedad del WebSocket
  ws.sessionId = sessionId;

  console.log(`[SessionManager] Conexión ElevenLabs registrada para sesión ${sessionId}, CallSid: ${callSid}`);
}

/**
 * Registra una conexión de Agente para una sesión
 * @param {string} sessionId - ID de sesión
 * @param {WebSocket} ws - Conexión WebSocket del agente
 */
export function registerAgentConnection(sessionId, ws) {
  const session = getOrCreateSession(sessionId);
  session.agentWs = ws;
  session.isAgentActive = true;

  // Agregar el sessionId como propiedad del WebSocket
  ws.sessionId = sessionId;

  console.log(`[SessionManager] Conexión de agente registrada para sesión ${sessionId}`);

  // Notificar a los clientes de log que un agente ha tomado el control
  broadcastToSession(sessionId, "[INFO] Un agente ha tomado el control de la conversación");
}

/**
 * Elimina un cliente de logs de su sesión
 * @param {WebSocket} ws - Conexión WebSocket a eliminar
 */
export function removeLogClient(ws) {
  if (!ws.sessionId) return;

  const session = sessions.get(ws.sessionId);
  if (session) {
    session.logClients.delete(ws);
    console.log(`[SessionManager] Cliente de logs eliminado de sesión ${ws.sessionId}, quedan: ${session.logClients.size}`);

    // Limpiar la sesión si ya no hay conexiones activas
    cleanupSessionIfEmpty(ws.sessionId);
  }
}

/**
 * Elimina una conexión Twilio de su sesión
 * @param {WebSocket} ws - Conexión WebSocket a eliminar
 */
export function removeTwilioConnection(ws) {
  if (!ws.sessionId) return;

  const session = sessions.get(ws.sessionId);
  if (session) {
    session.twilioWs = null;
    console.log(`[SessionManager] Conexión Twilio eliminada de sesión ${ws.sessionId}`);

    // Limpiar la sesión si ya no hay conexiones activas
    cleanupSessionIfEmpty(ws.sessionId);
  }
}

/**
 * Elimina una conexión ElevenLabs de su sesión
 * @param {WebSocket} ws - Conexión WebSocket a eliminar
 */
export function removeElevenLabsConnection(ws) {
  if (!ws.sessionId) return;

  const session = sessions.get(ws.sessionId);
  if (session) {
    session.elevenLabsWs = null;
    console.log(`[SessionManager] Conexión ElevenLabs eliminada de sesión ${ws.sessionId}`);

    // Limpiar la sesión si ya no hay conexiones activas
    cleanupSessionIfEmpty(ws.sessionId);
  }
}

/**
 * Elimina una conexión de Agente de su sesión
 * @param {WebSocket} ws - Conexión WebSocket a eliminar
 */
export function removeAgentConnection(ws) {
  if (!ws.sessionId) return;

  const session = sessions.get(ws.sessionId);
  if (session) {
    session.agentWs = null;
    session.isAgentActive = false;
    console.log(`[SessionManager] Conexión de agente eliminada de sesión ${ws.sessionId}`);

    // Notificar a los clientes de log que el agente ha dejado el control
    broadcastToSession(ws.sessionId, "[INFO] El agente ha dejado el control de la conversación");

    // Limpiar la sesión si ya no hay conexiones activas
    cleanupSessionIfEmpty(ws.sessionId);
  }
}

/**
 * Limpia una sesión si no tiene conexiones activas
 * @param {string} sessionId - ID de sesión a verificar
 */
function cleanupSessionIfEmpty(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return;

  if (
    session.logClients.size === 0 && 
    !session.twilioWs && 
    !session.elevenLabsWs &&
    !session.agentWs
  ) {
    sessions.delete(sessionId);
    console.log(`[SessionManager] Sesión ${sessionId} eliminada por inactividad`);
  }
}

/**
 * Envía un mensaje a todos los clientes de logs de una sesión
 * @param {string} sessionId - ID de sesión
 * @param {string|object} message - Mensaje a enviar
 */
export function broadcastToSession(sessionId, message) {
  const session = sessions.get(sessionId);
  if (!session) return;

  const messageStr = typeof message === 'string' ? message : JSON.stringify(message);

  session.logClients.forEach(client => {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(messageStr);
    }
  });
}

/**
 * Obtiene una sesión por su ID
 * @param {string} sessionId - ID de sesión
 * @returns {Object|null} - Objeto de sesión o null si no existe
 */
export function getSession(sessionId) {
  return sessions.get(sessionId) || null;
}

/**
 * Obtiene todas las sesiones activas
 * @returns {Map} - Mapa de todas las sesiones
 */
export function getAllSessions() {
  return sessions;
}