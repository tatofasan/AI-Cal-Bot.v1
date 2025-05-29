/**
 * src/utils/audioProcessor.js
 *
 * Sistema simplificado de procesamiento de audio usando el SDK de ElevenLabs
 * Ya no necesitamos conversión µ-law ya que el SDK maneja los formatos automáticamente
 */

/**
 * Calcula la energía (potencia) de una señal de audio
 * @param {Float32Array} samples - Muestras de audio
 * @returns {number} - Valor de energía
 */
function calculateEnergy(samples) {
  let energy = 0;
  for (let i = 0; i < samples.length; i++) {
    energy += samples[i] * samples[i];
  }
  return energy / samples.length;
}

/**
 * Detector simple de actividad de voz basado en energía y cruce por cero
 * @param {Float32Array} samples - Muestras de audio
 * @returns {boolean} - true si se detecta voz, false en caso contrario
 */
export function detectVoiceActivity(samples) {
  // Parámetros del detector
  const energyThreshold = 0.0015;  // Umbral de energía para considerar voz
  const zcrThreshold = 0.10;      // Umbral de tasa de cruce por cero

  // Calcular la energía de la señal
  const energy = calculateEnergy(samples);

  // Calcular tasa de cruce por cero (Zero Crossing Rate)
  let zeroCount = 0;
  for (let i = 1; i < samples.length; i++) {
    if ((samples[i] >= 0 && samples[i-1] < 0) || 
        (samples[i] < 0 && samples[i-1] >= 0)) {
      zeroCount++;
    }
  }
  const zcr = zeroCount / (samples.length - 1);

  // Decisión basada en energía y ZCR
  // La voz tiene energía significativa y una tasa moderada de cruce por cero
  if (energy > energyThreshold) {
    // Ruido blanco tiene alta energía pero también alta ZCR
    // Voz tiene ZCR más moderada
    if (zcr < zcrThreshold || energy > energyThreshold * 10) {
      return true; // Es voz
    }
  }

  return false; // No es voz
}

/**
 * Aplica normalización de volumen a las muestras de audio
 * @param {Float32Array} samples - Muestras de audio
 * @param {number} targetLevel - Nivel objetivo (0-1)
 * @returns {Float32Array} - Muestras normalizadas
 */
export function normalizeVolume(samples, targetLevel = 0.8) {
  // Encontrar el valor máximo absoluto
  let maxValue = 0;
  for (let i = 0; i < samples.length; i++) {
    const absValue = Math.abs(samples[i]);
    if (absValue > maxValue) {
      maxValue = absValue;
    }
  }

  // Si el audio está muy bajo, no normalizar para evitar amplificar ruido
  if (maxValue < 0.01) {
    return samples;
  }

  // Calcular factor de normalización
  const normalizationFactor = targetLevel / maxValue;

  // Aplicar normalización
  const normalized = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    normalized[i] = samples[i] * normalizationFactor;
  }

  return normalized;
}

/**
 * Aplica un filtro de suavizado para reducir ruido
 * @param {Float32Array} samples - Muestras de audio
 * @param {number} windowSize - Tamaño de la ventana de suavizado
 * @returns {Float32Array} - Muestras suavizadas
 */
export function smoothAudio(samples, windowSize = 3) {
  const smoothed = new Float32Array(samples.length);

  for (let i = 0; i < samples.length; i++) {
    let sum = 0;
    let count = 0;

    // Calcular promedio en la ventana
    for (let j = -windowSize; j <= windowSize; j++) {
      const index = i + j;
      if (index >= 0 && index < samples.length) {
        sum += samples[index];
        count++;
      }
    }

    smoothed[i] = sum / count;
  }

  return smoothed;
}

/**
 * Convierte un ArrayBuffer a Float32Array normalizado [-1, 1]
 * @param {ArrayBuffer} buffer - Buffer de audio
 * @param {number} bytesPerSample - Bytes por muestra (1, 2, 3, o 4)
 * @returns {Float32Array} - Muestras normalizadas
 */
export function bufferToFloat32Array(buffer, bytesPerSample = 2) {
  const dataView = new DataView(buffer);
  const samples = new Float32Array(buffer.byteLength / bytesPerSample);

  for (let i = 0; i < samples.length; i++) {
    let sample = 0;
    const offset = i * bytesPerSample;

    switch (bytesPerSample) {
      case 1: // 8-bit
        sample = (dataView.getUint8(offset) - 128) / 128;
        break;
      case 2: // 16-bit
        sample = dataView.getInt16(offset, true) / 32768;
        break;
      case 3: // 24-bit
        const b1 = dataView.getUint8(offset);
        const b2 = dataView.getUint8(offset + 1);
        const b3 = dataView.getUint8(offset + 2);
        sample = ((b3 << 16) | (b2 << 8) | b1) / 8388608;
        if (b3 & 0x80) sample -= 2; // Manejar signo
        break;
      case 4: // 32-bit float
        sample = dataView.getFloat32(offset, true);
        break;
    }

    samples[i] = sample;
  }

  return samples;
}

/**
 * Calcula métricas de calidad de audio
 * @param {Float32Array} samples - Muestras de audio
 * @returns {Object} - Métricas de calidad
 */
export function calculateAudioMetrics(samples) {
  const energy = calculateEnergy(samples);
  const hasVoice = detectVoiceActivity(samples);

  // Calcular SNR aproximado
  let signal = 0;
  let noise = 0;

  for (let i = 0; i < samples.length; i++) {
    if (Math.abs(samples[i]) > 0.1) {
      signal += samples[i] * samples[i];
    } else {
      noise += samples[i] * samples[i];
    }
  }

  const snr = noise > 0 ? 10 * Math.log10(signal / noise) : 0;

  return {
    energy,
    hasVoice,
    snr,
    peakLevel: Math.max(...samples.map(Math.abs)),
    avgLevel: samples.reduce((a, b) => a + Math.abs(b), 0) / samples.length
  };
}

/**
 * Clase para gestionar buffers de audio con timestamp
 */
export class AudioBuffer {
  constructor(maxDuration = 30000) { // 30 segundos por defecto
    this.chunks = [];
    this.maxDuration = maxDuration;
  }

  /**
   * Añade un chunk de audio al buffer
   * @param {ArrayBuffer|Uint8Array} data - Datos de audio
   * @param {number} timestamp - Timestamp del chunk
   */
  add(data, timestamp = Date.now()) {
    this.chunks.push({ data, timestamp });
    this.cleanup();
  }

  /**
   * Limpia chunks antiguos
   */
  cleanup() {
    const cutoff = Date.now() - this.maxDuration;
    this.chunks = this.chunks.filter(chunk => chunk.timestamp > cutoff);
  }

  /**
   * Obtiene todos los chunks en orden
   * @returns {Array} - Array de chunks
   */
  getChunks() {
    this.cleanup();
    return this.chunks.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Combina todos los chunks en un solo buffer
   * @returns {Uint8Array} - Buffer combinado
   */
  combine() {
    const chunks = this.getChunks();
    if (chunks.length === 0) return new Uint8Array(0);

    // Calcular tamaño total
    let totalLength = 0;
    chunks.forEach(chunk => {
      totalLength += chunk.data.byteLength || chunk.data.length;
    });

    // Combinar
    const combined = new Uint8Array(totalLength);
    let offset = 0;

    chunks.forEach(chunk => {
      const data = chunk.data instanceof ArrayBuffer 
        ? new Uint8Array(chunk.data) 
        : chunk.data;
      combined.set(data, offset);
      offset += data.length;
    });

    return combined;
  }

  /**
   * Limpia el buffer
   */
  clear() {
    this.chunks = [];
  }

  /**
   * Obtiene la duración del buffer en ms
   * @returns {number} - Duración en milisegundos
   */
  getDuration() {
    if (this.chunks.length < 2) return 0;
    const first = this.chunks[0];
    const last = this.chunks[this.chunks.length - 1];
    return last.timestamp - first.timestamp;
  }
}

// Exportar utilidades adicionales para compatibilidad
export default {
  detectVoiceActivity,
  normalizeVolume,
  smoothAudio,
  bufferToFloat32Array,
  calculateAudioMetrics,
  AudioBuffer
};