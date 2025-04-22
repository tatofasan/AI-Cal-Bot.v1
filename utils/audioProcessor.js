/**
 * src/utils/audioProcessor.js
 *
 * Sistema avanzado de procesamiento de audio para mejorar la calidad de las transcripciones.
 * Implementación en JavaScript puro sin dependencias externas.
 */

/**
 * Decodifica un byte de µ-law a PCM lineal.
 * @param {number} u_val - Valor en µ-law (byte).
 * @returns {number} - Valor en PCM lineal.
 */
function muLawToLinear(u_val) {
  u_val = ~u_val & 0xFF;
  let t = ((u_val & 0x0F) << 3) + 132;
  t <<= (u_val & 0x70) >> 4;
  return (u_val & 0x80) ? (132 - t) : (t - 132);
}

/**
 * Convierte un valor PCM lineal a µ-law.
 * @param {number} sample - Muestra de PCM lineal.
 * @returns {number} - Byte µ-law.
 */
function linearToMuLaw(sample) {
  const BIAS = 132;
  const CLIP = 32635;
  let sign = 0;
  if (sample < 0) {
    sign = 0x80;
    sample = -sample;
  }
  if (sample > CLIP) sample = CLIP;
  sample += BIAS;
  let exponent = 7;
  for (let expMask = 0x4000; (sample & expMask) === 0 && exponent > 0; expMask >>= 1, exponent--) {}
  let mantissa = (sample >> (exponent + 3)) & 0x0F;
  let muLawByte = ~(sign | (exponent << 4) | mantissa) & 0xFF;
  return muLawByte;
}

/**
 * Amplifica el audio en formato µ-law.
 * @param {string} base64Data - Datos de audio codificados en base64 (formato µ-law).
 * @param {number} gain - Factor de ganancia a aplicar (por defecto 1.0, sin amplificación).
 * @returns {string} - Datos de audio amplificados en base64 (formato µ-law).
 */
export function amplifyAudio(base64Data, gain = 1.0) {
  const inputBuffer = Buffer.from(base64Data, 'base64');
  const outputBuffer = Buffer.alloc(inputBuffer.length);

  for (let i = 0; i < inputBuffer.length; i++) {
    // Decodificar el byte µ-law a PCM lineal
    const linearSample = muLawToLinear(inputBuffer[i]);
    // Aplicar la ganancia
    let amplifiedSample = linearSample * gain;
    // Clipping para evitar distorsiones excesivas
    if (amplifiedSample > 32124) amplifiedSample = 32124;
    if (amplifiedSample < -32124) amplifiedSample = -32124;
    // Re-encodar a µ-law
    outputBuffer[i] = linearToMuLaw(amplifiedSample);
  }
  // Retornar el resultado en base64
  return outputBuffer.toString('base64');
}

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
function detectVoiceActivity(samples) {
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
 * Filtra el ruido mediante un filtro de paso de banda para resaltar frecuencias vocales
 * @param {Float32Array} samples - Muestras de audio
 * @returns {Float32Array} - Muestras filtradas
 */
function filterNoise(samples) {
  // Implementación de filtro IIR para enfatizar el rango de voz (300Hz-3kHz)
  // Coeficientes pre-calculados para un filtro simple optimizado para voz
  const b = [0.29289323, 0, -0.29289323];  // Coeficientes del numerador
  const a = [1, -0.41421356, 0];           // Coeficientes del denominador

  const output = new Float32Array(samples.length);
  let x1 = 0, x2 = 0;
  let y1 = 0, y2 = 0;

  // Aplicar el filtro
  for (let i = 0; i < samples.length; i++) {
    const x0 = samples[i];
    // Fórmula de diferencias del filtro IIR
    const y0 = b[0]*x0 + b[1]*x1 + b[2]*x2 - a[1]*y1 - a[2]*y2;

    // Actualizar los valores de estado
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;

    output[i] = y0;
  }

  return output;
}

/**
 * Aplica un compresor simple para reducir el rango dinámico y hacer más consistente el volumen
 * @param {Float32Array} samples - Muestras de audio
 * @returns {Float32Array} - Muestras comprimidas
 */
function compressAudio(samples) {
  // Parámetros del compresor
  const threshold = 0.1;    // Umbral de activación
  const ratio = 3.0;        // Ratio de compresión (3:1)
  const makeup = 1.4;       // Ganancia de compensación

  const compressed = new Float32Array(samples.length);

  for (let i = 0; i < samples.length; i++) {
    const input = samples[i];
    const inputAbs = Math.abs(input);

    // Aplicar compresión solo si supera el umbral
    if (inputAbs > threshold) {
      // Calcular ganancia de compresión
      const gainReduction = (inputAbs - threshold) * (1 - 1/ratio);
      const gain = (inputAbs - gainReduction) / inputAbs;

      // Aplicar ganancia y compensación
      compressed[i] = input * gain * makeup;
    } else {
      // Por debajo del umbral, aplicar solo makeup gain
      compressed[i] = input * makeup;
    }

    // Limitador suave para evitar clipping
    if (compressed[i] > 0.95) compressed[i] = 0.95 + (compressed[i] - 0.95) * 0.1;
    else if (compressed[i] < -0.95) compressed[i] = -0.95 + (compressed[i] + 0.95) * 0.1;
  }

  return compressed;
}

// Variable para controlar la frecuencia de los logs (uno cada N fragmentos)
let logCounter = 0;
const LOG_FREQUENCY = 20; // Registrar solo 1 de cada 20 fragmentos

/**
 * Procesa el audio para mejorar la calidad de transcripción
 * Implementa detección de voz, filtrado, compresión y normalización
 * 
 * @param {string} base64Data - Datos de audio codificados en base64 (formato µ-law)
 * @returns {string} - Datos de audio procesados en base64 (formato µ-law)
 */
export function processAudioForSpeechRecognition(base64Data) {
  try {
    // Incrementar contador de logs
    logCounter++;
    const shouldLog = (logCounter % LOG_FREQUENCY === 0);

    // Decodificar de base64 a buffer binario
    const inputBuffer = Buffer.from(base64Data, 'base64');

    // Convertir µ-law a PCM normalizado a [-1,1]
    const floatSamples = new Float32Array(inputBuffer.length);
    for (let i = 0; i < inputBuffer.length; i++) {
      floatSamples[i] = muLawToLinear(inputBuffer[i]) / 32124.0;
    }

    // Detectar actividad de voz
    const hasVoice = detectVoiceActivity(floatSamples);

    // Si no hay voz detectada, aplicar solo una amplificación ligera
    if (!hasVoice) {
      return amplifyAudio(base64Data, 1.5);
    }

    // Si hay voz, aplicar el pipeline completo de procesamiento
    if (shouldLog) {
      console.log("[AudioProcessor] Procesando audio con voz detectada");
    }

    // 1. Filtrar ruido - Resaltar frecuencias vocales
    const filteredSamples = filterNoise(floatSamples);

    // 2. Comprimir - Reducir rango dinámico y hacer la voz más consistente
    const compressedSamples = compressAudio(filteredSamples);

    // 3. Convertir de vuelta a µ-law
    const outputBuffer = Buffer.alloc(compressedSamples.length);
    for (let i = 0; i < compressedSamples.length; i++) {
      // Convertir de [-1,1] a rango PCM y luego a µ-law
      outputBuffer[i] = linearToMuLaw(compressedSamples[i] * 32124);
    }

    // Retornar el audio procesado en base64
    return outputBuffer.toString('base64');

  } catch (error) {
    // Reducir logs de errores también
    if (logCounter % LOG_FREQUENCY === 0) {
      console.error("[AudioProcessor] Error procesando audio:");
    }
    // En caso de error, amplificar ligeramente el audio original
    return amplifyAudio(base64Data, 1.5);
  }
}