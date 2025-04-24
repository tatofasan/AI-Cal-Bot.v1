// services/callStorageService.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Para obtener __dirname en ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Constantes de configuración
const CALL_HISTORY_FILE = path.join(__dirname, '../data/call_history.json');
const MAX_CALL_AGE_MS = 30 * 60 * 1000; // 30 minutos en milisegundos
const MAX_CALL_DURATION_MS = 120 * 60 * 1000; // 120 minutos en milisegundos (límite máximo para detectar llamadas fantasma)

// Asegurar que el directorio data existe
try {
  const dataDir = path.join(__dirname, '../data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log(`[CallStorage] Directorio data creado en: ${dataDir}`);
  }
} catch (error) {
  console.error('[CallStorage] Error al crear directorio data:', error);
}

// Almacenamiento en memoria para llamadas activas y recientes
const activeCalls = new Map();
const recentlyEndedCalls = new Map();

/**
 * Lee el historial de llamadas del archivo
 * @returns {Array} Array de llamadas almacenadas en el archivo
 */
function readCallHistory() {
  try {
    if (!fs.existsSync(CALL_HISTORY_FILE)) {
      return [];
    }
    const fileContent = fs.readFileSync(CALL_HISTORY_FILE, 'utf8');
    return JSON.parse(fileContent);
  } catch (error) {
    console.error('[CallStorage] Error leyendo historial de llamadas:', error);
    return [];
  }
}

/**
 * Guarda el historial de llamadas en el archivo
 * @param {Array} calls - Array de llamadas a guardar
 */
function saveCallHistory(calls) {
  try {
    fs.writeFileSync(CALL_HISTORY_FILE, JSON.stringify(calls, null, 2), 'utf8');
  } catch (error) {
    console.error('[CallStorage] Error guardando historial de llamadas:', error);
  }
}

/**
 * Registra una nueva llamada activa
 * @param {Object} callData - Datos de la llamada
 * @returns {Object} Datos de la llamada con ID asignado
 */
export function registerCall(callData) {
  // Log de debug para verificar qué datos se están recibiendo
  console.log('[CallStorage] Registrando llamada con datos:', callData);

  // Asegurar que la llamada tiene un sessionId
  if (!callData.sessionId) {
    console.error('[CallStorage] Se intentó registrar una llamada sin sessionId');
    return null;
  }

  // Si ya existe una llamada con ese sessionId, actualizarla
  if (activeCalls.has(callData.sessionId)) {
    const existingCall = activeCalls.get(callData.sessionId);
    const updatedCall = { ...existingCall, ...callData, updatedAt: Date.now() };

    // Si ahora tenemos un callSid pero antes no, marcar como una llamada real
    if (callData.callSid && !existingCall.callSid) {
      updatedCall.isRealCall = true;
    }

    activeCalls.set(callData.sessionId, updatedCall);
    console.log(`[CallStorage] Llamada actualizada: ${callData.sessionId}`, updatedCall);
    return updatedCall;
  }

  // Nueva llamada
  const newCall = {
    id: callData.sessionId,
    callSid: callData.callSid || null,
    phoneNumber: callData.phoneNumber || callData.to_number || 'Desconocido',
    startTime: Date.now(),
    updatedAt: Date.now(),
    status: 'active',
    userName: callData.userName || callData.user_name || 'Sin nombre',
    voiceName: callData.voiceName || callData.voice_name || 'Desconocida',
    clientIp: callData.clientIp || 'IP no registrada',
    transcriptions: [],
    agentTakeoverCount: 0,
    isRealCall: !!callData.callSid, // Marcar como llamada real solo si tiene callSid
    ...callData
  };

  activeCalls.set(callData.sessionId, newCall);
  console.log(`[CallStorage] Nueva llamada registrada: ${newCall.id}`, newCall);

  // Log de todas las llamadas activas para debug
  console.log(`[CallStorage] Total de llamadas activas: ${activeCalls.size}`);
  return newCall;
}

/**
 * Actualiza una llamada existente
 * @param {string} sessionId - ID de la sesión asociada a la llamada
 * @param {Object} updateData - Datos a actualizar
 * @returns {Object|null} Llamada actualizada o null si no existe
 */
export function updateCall(sessionId, updateData) {
  if (!sessionId || !activeCalls.has(sessionId)) {
    console.log(`[CallStorage] Intento de actualizar llamada inexistente: ${sessionId}`);
    return null;
  }

  const existingCall = activeCalls.get(sessionId);
  const updatedCall = { 
    ...existingCall, 
    ...updateData, 
    updatedAt: Date.now() 
  };

  // Si ahora tenemos twimlGenerated o callSid, probablemente es una llamada real
  if ((updateData.twimlGenerated || updateData.callSid) && !existingCall.isRealCall) {
    updatedCall.isRealCall = true;
  }

  activeCalls.set(sessionId, updatedCall);
  console.log(`[CallStorage] Llamada actualizada: ${sessionId}`, updateData);
  return updatedCall;
}

/**
 * Registra el fin de una llamada
 * @param {string} sessionId - ID de la sesión asociada a la llamada
 * @param {Object} endData - Datos adicionales del fin de la llamada
 * @returns {Object|null} Datos de la llamada finalizada o null si no existe
 */
export function endCall(sessionId, endData = {}) {
  if (!sessionId || !activeCalls.has(sessionId)) {
    console.log(`[CallStorage] Intento de finalizar llamada inexistente: ${sessionId}`);
    return null;
  }

  const call = activeCalls.get(sessionId);
  const endedCall = {
    ...call,
    ...endData,
    endTime: Date.now(),
    duration: Date.now() - call.startTime,
    status: 'ended',
    updatedAt: Date.now()
  };

  // Eliminar de llamadas activas
  activeCalls.delete(sessionId);

  // Añadir a llamadas recientes finalizadas solo si era una llamada real
  if (call.isRealCall || call.callSid) {
    recentlyEndedCalls.set(sessionId, endedCall);
    // Persistir a archivo
    persistRecentCall(endedCall);
    console.log(`[CallStorage] Llamada real finalizada: ${sessionId}`, endedCall);
  } else {
    console.log(`[CallStorage] Sesión de frontend finalizada (no era una llamada real): ${sessionId}`);
  }

  return endedCall;
}

/**
 * Persiste una llamada reciente en el archivo
 * @param {Object} callData - Datos de la llamada a persistir
 */
function persistRecentCall(callData) {
  try {
    // Solo guardar en el historial si es una llamada real
    if (!callData.isRealCall && !callData.callSid) {
      console.log(`[CallStorage] Omitiendo persistencia de sesión que no es llamada real: ${callData.id}`);
      return;
    }

    const existingCalls = readCallHistory();

    // Filtrar para evitar duplicados
    const filteredCalls = existingCalls.filter(c => c.id !== callData.id);

    // Añadir la nueva llamada
    filteredCalls.push(callData);

    // Guardar
    saveCallHistory(filteredCalls);
    console.log(`[CallStorage] Llamada persistida en archivo: ${callData.id}`);
  } catch (error) {
    console.error('[CallStorage] Error al persistir llamada:', error);
  }
}

/**
 * Obtiene todas las llamadas activas y recientes
 * @returns {Array} Array de llamadas
 */
export function getAllCalls() {
  // Combinar llamadas activas y recientes
  const allCalls = [];

  // Log de debug del estado actual
  console.log(`[CallStorage] Obteniendo todas las llamadas - Activas: ${activeCalls.size}, Recientes: ${recentlyEndedCalls.size}`);

  // Añadir llamadas activas (solo las reales)
  for (const call of activeCalls.values()) {
    // Solo incluir si es una llamada real o tiene callSid
    if (call.isRealCall || call.callSid) {
      allCalls.push(call);
    }
  }

  // Añadir llamadas recientes finalizadas en memoria
  for (const call of recentlyEndedCalls.values()) {
    allCalls.push(call);
  }

  // Añadir llamadas del histórico en archivo (solo las recientes)
  const historicCalls = readCallHistory();
  const cutoffTime = Date.now() - MAX_CALL_AGE_MS;

  let historicCount = 0;
  for (const call of historicCalls) {
    // Evitar duplicados que ya están en memoria
    if (call.endTime > cutoffTime && 
        !activeCalls.has(call.id) && 
        !recentlyEndedCalls.has(call.id)) {
      allCalls.push(call);
      historicCount++;
    }
  }

  console.log(`[CallStorage] Total de llamadas recuperadas: ${allCalls.length} (Activas reales: ${allCalls.length - recentlyEndedCalls.size - historicCount}, Recientes en memoria: ${recentlyEndedCalls.size}, Históricas: ${historicCount})`);

  return allCalls;
}

/**
 * Obtiene una llamada específica por su ID (sessionId)
 * @param {string} callId - ID de la llamada a buscar
 * @returns {Object|null} Datos de la llamada o null si no existe
 */
export function getCall(callId) {
  // Buscar en llamadas activas
  if (activeCalls.has(callId)) {
    return activeCalls.get(callId);
  }

  // Buscar en llamadas recientes finalizadas
  if (recentlyEndedCalls.has(callId)) {
    return recentlyEndedCalls.get(callId);
  }

  // Buscar en archivo
  const historicCalls = readCallHistory();
  const call = historicCalls.find(call => call.id === callId);

  if (call) {
    console.log(`[CallStorage] Encontrada llamada histórica: ${callId}`);
  } else {
    console.log(`[CallStorage] No se encontró la llamada: ${callId}`);
  }

  return call || null;
}

/**
 * Añade una transcripción a una llamada
 * @param {string} callId - ID de la llamada
 * @param {string} text - Texto de la transcripción
 * @param {string} speakerType - Tipo de hablante ('client', 'bot', 'agent', 'system')
 * @returns {boolean} true si se añadió correctamente, false si hubo error
 */
export function addCallTranscription(callId, text, speakerType) {
  // Si es una llamada activa
  if (activeCalls.has(callId)) {
    const call = activeCalls.get(callId);

    // Crear objeto de transcripción
    const transcription = {
      text,
      speakerType,
      timestamp: Date.now()
    };

    // Añadir al array de transcripciones
    if (!call.transcriptions) {
      call.transcriptions = [];
    }

    call.transcriptions.push(transcription);
    call.updatedAt = Date.now();

    // Si es una intervención del agente, incrementar contador
    if (speakerType === 'agent') {
      call.agentTakeoverCount = (call.agentTakeoverCount || 0) + 1;
    }

    // Si recibimos una transcripción, probablemente sea una llamada real
    if (!call.isRealCall) {
      call.isRealCall = true;
    }

    // Actualizar en el mapa
    activeCalls.set(callId, call);
    console.log(`[CallStorage] Transcripción añadida a llamada activa: ${callId}, tipo: ${speakerType}`);
    return true;
  }

  // Si es una llamada reciente finalizada
  if (recentlyEndedCalls.has(callId)) {
    const call = recentlyEndedCalls.get(callId);

    // Crear objeto de transcripción
    const transcription = {
      text,
      speakerType,
      timestamp: Date.now()
    };

    // Añadir al array de transcripciones
    if (!call.transcriptions) {
      call.transcriptions = [];
    }

    call.transcriptions.push(transcription);
    call.updatedAt = Date.now();

    // Actualizar en el mapa y persistir
    recentlyEndedCalls.set(callId, call);
    persistRecentCall(call);
    console.log(`[CallStorage] Transcripción añadida a llamada finalizada: ${callId}, tipo: ${speakerType}`);
    return true;
  }

  console.log(`[CallStorage] No se pudo añadir transcripción: llamada ${callId} no encontrada`);
  return false;
}

/**
 * Obtiene transcripciones de una llamada específica
 * @param {string} callId - ID de la llamada
 * @returns {Array|null} Array de transcripciones o null si la llamada no existe
 */
export function getCallTranscriptions(callId) {
  const call = getCall(callId);
  return call ? (call.transcriptions || []) : null;
}

/**
 * Detecta y finaliza llamadas fantasma que tienen una duración excesiva
 */
function detectAndEndGhostCalls() {
  const now = Date.now();
  const ghostCallsDetected = [];

  // Verificar las llamadas activas
  for (const [callId, call] of activeCalls.entries()) {
    // Solo considerar llamadas marcadas como reales
    if (call.isRealCall || call.callSid) {
      // Si la llamada lleva activa más tiempo que el límite máximo permitido, la consideramos una llamada fantasma
      if (now - call.startTime > MAX_CALL_DURATION_MS) {
        console.log(`[CallStorage] Detectada posible llamada fantasma: ${callId}, duración: ${Math.floor((now - call.startTime) / 60000)} minutos`);

        // Finalizar la llamada fantasma
        const endedCall = {
          ...call,
          endTime: now,
          duration: now - call.startTime,
          status: 'ended',
          endReason: 'ghost_call_detection',
          updatedAt: now
        };

        // Eliminar de llamadas activas
        activeCalls.delete(callId);

        // Añadir a llamadas recientes finalizadas
        recentlyEndedCalls.set(callId, endedCall);

        // Persistir a archivo
        persistRecentCall(endedCall);

        ghostCallsDetected.push(endedCall);
      }
    } else {
      // Las sesiones de frontend que llevan mucho tiempo activas sin ser llamadas también se finalizan
      if (now - call.startTime > MAX_CALL_AGE_MS) {
        console.log(`[CallStorage] Limpiando sesión de frontend inactiva: ${callId}, duración: ${Math.floor((now - call.startTime) / 60000)} minutos`);

        // Simplemente eliminar de las llamadas activas
        activeCalls.delete(callId);
      }
    }
  }

  if (ghostCallsDetected.length > 0) {
    console.log(`[CallStorage] Se detectaron y finalizaron ${ghostCallsDetected.length} llamadas fantasma`);
  }

  return ghostCallsDetected;
}

/**
 * Limpia llamadas antiguas (más de 30 minutos)
 * Se ejecuta periódicamente
 */
export function cleanupOldCalls() {
  const cutoffTime = Date.now() - MAX_CALL_AGE_MS;

  // Detectar y finalizar posibles llamadas fantasma
  detectAndEndGhostCalls();

  // Limpiar llamadas recientes finalizadas en memoria
  let removedCount = 0;
  for (const [callId, call] of recentlyEndedCalls.entries()) {
    if (call.endTime < cutoffTime) {
      recentlyEndedCalls.delete(callId);
      removedCount++;
    }
  }

  if (removedCount > 0) {
    console.log(`[CallStorage] Limpieza: eliminadas ${removedCount} llamadas antiguas de memoria`);
  }

  // Limpiar archivo de historial
  try {
    const historicCalls = readCallHistory();
    const recentCalls = historicCalls.filter(call => {
      // Mantener solo llamadas recientes
      return call.endTime > cutoffTime;
    });

    if (recentCalls.length !== historicCalls.length) {
      saveCallHistory(recentCalls);
      console.log(`[CallStorage] Limpieza: eliminadas ${historicCalls.length - recentCalls.length} llamadas antiguas del historial`);
    }
  } catch (error) {
    console.error('[CallStorage] Error al limpiar llamadas antiguas:', error);
  }
}

// Iniciar limpieza periódica cada 5 minutos
const cleanupInterval = setInterval(cleanupOldCalls, 5 * 60 * 1000);

// Detectar llamadas fantasma cada 15 minutos
const ghostCallDetectionInterval = setInterval(detectAndEndGhostCalls, 15 * 60 * 1000);

// Garantizar que los intervalos no impidan que el proceso termine
cleanupInterval.unref();
ghostCallDetectionInterval.unref();