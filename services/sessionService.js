// services/sessionService.js
import { v4 as uuidv4 } from 'uuid';

// Almacenamiento de sesiones: sessionId -> sessionData
const sessions = new Map();

// Configuración del servicio
const CONFIG = {
  // Tiempo después del cual una sesión inactiva es eliminada (30 minutos en ms)
  SESSION_TIMEOUT: 30 * 60 * 1000,
  // Intervalo de limpieza de sesiones (5 minutos en ms)
  CLEANUP_INTERVAL: 5 * 60 * 1000,
};

/**
 * Crea una nueva sesión
 * @returns {string} ID de la sesión creada
 */
export function createSession() {
  // Generar un ID único para la sesión
  const sessionId = `session_${uuidv4()}`;

  // Crear objeto de sesión
  const session = {
    id: sessionId,
    logClients: new Set(),
    twilioWs: null,
    elevenLabsWs: null,
    agentWs: null,
    callSid: null,
    isAgentActive: false,
    createdAt: Date.now(),
    lastActivity: Date.now(),
  };

  // Almacenar la sesión
  sessions.set(sessionId, session);

  console.log(`[SessionService] Nueva sesión creada: ${sessionId}`);

  return sessionId;
}

/**
 * Obtiene una sesión por su ID
 * @param {string} sessionId - ID de la sesión
 * @returns {Object|null} - Datos de la sesión o null si no existe
 */
export function getSession(sessionId) {
  if (!sessionId || !sessions.has(sessionId)) {
    return null;
  }

  const session = sessions.get(sessionId);
  // Actualizar el timestamp de última actividad
  session.lastActivity = Date.now();

  return session;
}

/**
 * Verifica si una sesión existe
 * @param {string} sessionId - ID de la sesión
 * @returns {boolean} true si la sesión existe
 */
export function sessionExists(sessionId) {
  return sessionId && sessions.has(sessionId);
}

/**
 * Actualiza el timestamp de última actividad de una sesión
 * @param {string} sessionId - ID de la sesión
 * @returns {boolean} true si la sesión fue actualizada, false si no existe
 */
export function touchSession(sessionId) {
  if (!sessionId || !sessions.has(sessionId)) {
    return false;
  }

  const session = sessions.get(sessionId);
  session.lastActivity = Date.now();
  return true;
}

/**
 * Elimina una sesión y limpia todos sus recursos asociados
 * @param {string} sessionId - ID de la sesión a eliminar
 * @returns {boolean} true si la sesión fue eliminada, false si no existía
 */
export function removeSession(sessionId) {
  if (!sessionId || !sessions.has(sessionId)) {
    return false;
  }

  const session = sessions.get(sessionId);

  // Cerrar todas las conexiones WebSocket asociadas
  closeSessionConnections(session);

  // Eliminar la sesión del almacenamiento
  sessions.delete(sessionId);

  console.log(`[SessionService] Sesión eliminada: ${sessionId}`);
  return true;
}

/**
 * Cierra todas las conexiones WebSocket asociadas a una sesión
 * @param {Object} session - Objeto de sesión
 */
function closeSessionConnections(session) {
  // Cerrar conexiones de clientes de logs
  if (session.logClients && session.logClients.size > 0) {
    session.logClients.forEach(client => {
      try {
        if (client.readyState === 1) { // WebSocket.OPEN
          client.close(1000, "Sesión cerrada por el servidor");
        }
      } catch (error) {
        console.error(`[SessionService] Error cerrando conexión de log: ${error}`);
      }
    });
  }

  // Cerrar conexión Twilio
  if (session.twilioWs) {
    try {
      if (session.twilioWs.readyState === 1) {
        session.twilioWs.close(1000, "Sesión cerrada por el servidor");
      }
    } catch (error) {
      console.error(`[SessionService] Error cerrando conexión Twilio: ${error}`);
    }
  }

  // Cerrar conexión ElevenLabs
  if (session.elevenLabsWs) {
    try {
      if (session.elevenLabsWs.readyState === 1) {
        session.elevenLabsWs.close(1000, "Sesión cerrada por el servidor");
      }
    } catch (error) {
      console.error(`[SessionService] Error cerrando conexión ElevenLabs: ${error}`);
    }
  }

  // Cerrar conexión de agente
  if (session.agentWs) {
    try {
      if (session.agentWs.readyState === 1) {
        session.agentWs.close(1000, "Sesión cerrada por el servidor");
      }
    } catch (error) {
      console.error(`[SessionService] Error cerrando conexión de agente: ${error}`);
    }
  }
}

/**
 * Limpia sesiones inactivas
 */
function cleanupInactiveSessions() {
  const now = Date.now();

  sessions.forEach((session, sessionId) => {
    const inactiveTime = now - session.lastActivity;

    if (inactiveTime > CONFIG.SESSION_TIMEOUT) {
      console.log(`[SessionService] Eliminando sesión inactiva: ${sessionId} (inactiva por ${Math.round(inactiveTime/1000)} segundos)`);
      removeSession(sessionId);
    }
  });
}

/**
 * Obtiene estadísticas sobre las sesiones actuales
 * @returns {Object} Estadísticas de sesiones
 */
export function getSessionStats() {
  // Obtener información básica de todas las sesiones
  const sessionInfo = [];
  sessions.forEach((session, id) => {
    sessionInfo.push({
      id: session.id,
      createdAt: session.createdAt,
      lastActivity: session.lastActivity,
      callSid: session.callSid,
      isAgentActive: session.isAgentActive,
      connections: {
        logClients: session.logClients ? session.logClients.size : 0,
        hasTwilioConnection: !!session.twilioWs,
        hasElevenLabsConnection: !!session.elevenLabsWs,
        hasAgentConnection: !!session.agentWs
      }
    });
  });

  return {
    totalSessions: sessions.size,
    sessions: Array.from(sessions.keys()),
    sessionInfo: sessionInfo,
    config: {
      sessionTimeoutMs: CONFIG.SESSION_TIMEOUT,
      cleanupIntervalMs: CONFIG.CLEANUP_INTERVAL
    }
  };
}

// Iniciar limpieza periódica de sesiones
const cleanupInterval = setInterval(cleanupInactiveSessions, CONFIG.CLEANUP_INTERVAL);

// Garantizar que el intervalo no impida que el proceso termine
cleanupInterval.unref();