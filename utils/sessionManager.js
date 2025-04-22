// src/utils/sessionManager.js
import { 
  getSession, 
  touchSession, 
  sessionExists,
  createSession
} from '../services/sessionService.js';

/**
 * Registra un cliente de logs en una sesión
 * @param {string} sessionId - ID de sesión
 * @param {WebSocket} ws - Conexión WebSocket del cliente de logs
 */
export function registerLogClient(sessionId, ws) {
  let session = getSession(sessionId);
  if (!session) {
    // Si la sesión no existe, la creamos
    createSession(sessionId);
    session = getSession(sessionId);
    if (!session) {
      console.error(`[SessionManager] No se pudo crear la sesión con ID: ${sessionId}`);
      ws.close(1008, "Error al crear la sesión");
      return;
    }
  }

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
  let session = getSession(sessionId);
  if (!session) {
    // Si la sesión no existe, la creamos
    createSession(sessionId);
    session = getSession(sessionId);
    if (!session) {
      console.error(`[SessionManager] No se pudo crear la sesión con ID: ${sessionId}`);
      ws.close(1008, "Error al crear la sesión");
      return;
    }
  }

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
  let session = getSession(sessionId);
  if (!session) {
    // Si la sesión no existe, la creamos
    createSession(sessionId);
    session = getSession(sessionId);
    if (!session) {
      console.error(`[SessionManager] No se pudo crear la sesión con ID: ${sessionId}`);
      return;
    }
  }

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
  let session = getSession(sessionId);
  if (!session) {
    // Si la sesión no existe, la creamos
    createSession(sessionId);
    session = getSession(sessionId);
    if (!session) {
      console.error(`[SessionManager] No se pudo crear la sesión con ID: ${sessionId}`);
      ws.close(1008, "Error al crear la sesión");
      return;
    }
  }

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

  const session = getSession(ws.sessionId);
  if (!session) return;

  session.logClients.delete(ws);
  console.log(`[SessionManager] Cliente de logs eliminado de sesión ${ws.sessionId}, quedan: ${session.logClients.size}`);
}

/**
 * Elimina una conexión Twilio de su sesión
 * @param {WebSocket} ws - Conexión WebSocket a eliminar
 */
export function removeTwilioConnection(ws) {
  if (!ws.sessionId) return;

  const session = getSession(ws.sessionId);
  if (!session) return;

  session.twilioWs = null;
  console.log(`[SessionManager] Conexión Twilio eliminada de sesión ${ws.sessionId}`);
}

/**
 * Elimina una conexión ElevenLabs de su sesión
 * @param {WebSocket} ws - Conexión WebSocket a eliminar
 */
export function removeElevenLabsConnection(ws) {
  if (!ws.sessionId) return;

  const session = getSession(ws.sessionId);
  if (!session) return;

  session.elevenLabsWs = null;
  console.log(`[SessionManager] Conexión ElevenLabs eliminada de sesión ${ws.sessionId}`);
}

/**
 * Elimina una conexión de Agente de su sesión
 * @param {WebSocket} ws - Conexión WebSocket a eliminar
 */
export function removeAgentConnection(ws) {
  if (!ws.sessionId) return;

  const session = getSession(ws.sessionId);
  if (!session) return;

  session.agentWs = null;
  session.isAgentActive = false;
  console.log(`[SessionManager] Conexión de agente eliminada de sesión ${ws.sessionId}`);

  // Notificar a los clientes de log que el agente ha dejado el control
  broadcastToSession(ws.sessionId, "[INFO] El agente ha dejado el control de la conversación");
}

/**
 * Envía un mensaje a todos los clientes de logs de una sesión
 * @param {string} sessionId - ID de sesión
 * @param {string|object} message - Mensaje a enviar
 */
export function broadcastToSession(sessionId, message) {
  const session = getSession(sessionId);
  if (!session) return;

  const messageStr = typeof message === 'string' ? message : JSON.stringify(message);

  session.logClients.forEach(client => {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(messageStr);
    }
  });
}

/**
 * Valida si un sessionId existe o tiene un formato válido
 * @param {string} sessionId - ID de sesión a validar
 * @returns {boolean} true si la sesión existe o parece válida
 */
export function validateSessionId(sessionId) {
  // Si la sesión ya existe, retornamos true
  if (sessionExists(sessionId)) {
    return true;
  }

  // Si el ID no existe pero tiene el formato correcto, permitimos usarlo
  // para que se pueda crear dinámicamente
  if (sessionId && sessionId.startsWith('session_') && sessionId.length > 10) {
    return true;
  }

  return false;
}

/**
 * Actualiza el timestamp de última actividad de una sesión
 * @param {string} sessionId - ID de sesión
 * @returns {boolean} true si la sesión fue actualizada, false si no existe
 */
export function updateSessionActivity(sessionId) {
  return touchSession(sessionId);
}