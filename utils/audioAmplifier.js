/**
 * src/utils/audioAmplifier.js
 *
 * Funciones para amplificar audio en formato µ-law.
 * Se implementan funciones para convertir de µ-law a PCM lineal, aplicar un factor de ganancia
 * y re-encodar a µ-law.
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
