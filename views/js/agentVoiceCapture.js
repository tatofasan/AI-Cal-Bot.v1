// Módulo para capturar la voz del agente y enviarla al servidor
const AgentVoiceCapture = (() => {
  // Variables privadas
  let mediaRecorder = null;
  let mediaStream = null;
  let audioContext = null;
  let sourceNode = null;
  let audioProcessor = null;
  let websocket = null;
  let isCapturing = false;
  let isConnecting = false;
  let reconnectAttempts = 0;
  let reconnectTimeout = null;

  // Función para iniciar la captura de voz
  async function startCapturing(sessionId) {
    try {
      if (isCapturing) {
        console.log("Ya hay una captura de voz activa");
        return true;
      }

      if (isConnecting) {
        console.log("Ya hay una conexión en proceso");
        return false;
      }

      isConnecting = true;

      // Mostrar mensajes de depuración
      console.log("[AgentVoice] Iniciando captura de voz para sessionId:", sessionId);

      // Solicitar permiso de micrófono con configuraciones optimizadas para telefonía
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1 // Mono es importante para compatibilidad con telefonía
          } 
        });
      } catch (micError) {
        console.error("[AgentVoice] Error accediendo al micrófono:", micError);
        alert("No se pudo acceder al micrófono. Verifique los permisos del navegador.");
        isConnecting = false;
        return false;
      }

      // Configurar AudioContext 
      try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        console.log("[AgentVoice] AudioContext creado con sampleRate:", audioContext.sampleRate);
      } catch (audioCtxError) {
        console.error("[AgentVoice] Error creando AudioContext:", audioCtxError);
        if (mediaStream) {
          mediaStream.getTracks().forEach(track => track.stop());
        }
        isConnecting = false;
        return false;
      }

      // Conectar al WebSocket para enviar audio
      try {
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${wsProtocol}//${window.location.host}/agent-voice-stream?sessionId=${sessionId}`;
        console.log("[AgentVoice] Conectando a WebSocket en:", wsUrl);

        websocket = new WebSocket(wsUrl);

        // Manejar apertura de conexión
        websocket.onopen = () => {
          console.log("[AgentVoice] Conexión WebSocket establecida");

          // Enviar mensaje inicial
          websocket.send(JSON.stringify({
            type: 'agent_connect',
            sessionId: sessionId,
            message: 'Agente conectado y listo para enviar audio'
          }));

          // Interrumpir cualquier reproducción del bot
          websocket.send(JSON.stringify({
            type: 'interrupt_bot',
            sessionId: sessionId
          }));

          // También enviar un evento al frontend para detener cualquier reproducción
          if (window.AudioProcessor && typeof window.AudioProcessor.clearAudioQueues === 'function') {
            window.AudioProcessor.clearAudioQueues();
          }

          // Configurar procesador de audio después de establecer la conexión
          setupAudioCapture(sessionId);

          isCapturing = true;
          isConnecting = false;
          reconnectAttempts = 0;
        };

        // Manejar errores
        websocket.onerror = (error) => {
          console.error("[AgentVoice] Error en WebSocket:", error);
          isConnecting = false;

          if (isCapturing) {
            // Intentar reconectar si estábamos capturando
            attemptReconnect(sessionId);
          }
        };

        // Manejar cierre de conexión
        websocket.onclose = (event) => {
          console.log("[AgentVoice] Conexión WebSocket cerrada. Código:", event.code, "Razón:", event.reason);
          isConnecting = false;

          if (isCapturing) {
            // Intentar reconectar si estábamos capturando
            attemptReconnect(sessionId);
          }
        };

        // Si después de 5 segundos no se ha establecido la conexión, considerar fallido
        setTimeout(() => {
          if (isConnecting && websocket.readyState !== WebSocket.OPEN) {
            console.error("[AgentVoice] Timeout en la conexión WebSocket");
            isConnecting = false;

            if (websocket) {
              websocket.close();
              websocket = null;
            }

            // Limpiar recursos
            cleanupAudioResources();
            alert("No se pudo establecer conexión con el servidor. Intente nuevamente.");
          }
        }, 5000);

      } catch (wsError) {
        console.error("[AgentVoice] Error creando WebSocket:", wsError);
        cleanupAudioResources();
        isConnecting = false;
        return false;
      }

      return true;
    } catch (error) {
      console.error("[AgentVoice] Error general iniciando captura de voz:", error);
      isConnecting = false;
      cleanupAudioResources();
      return false;
    }
  }

  // Configurar captura y procesamiento de audio
  function setupAudioCapture(sessionId) {
    try {
      // Crear source node del micrófono
      sourceNode = audioContext.createMediaStreamSource(mediaStream);

      // Obtener detalles del audio para logs
      const inputSampleRate = audioContext.sampleRate;
      console.log("[AgentVoice] Configurando captura de audio con sampleRate:", inputSampleRate);

      // Crear ScriptProcessor para manejar el audio
      // NOTA: ScriptProcessor está obsoleto pero es más compatible para este caso
      // que AudioWorklet, especialmente para la conversión µ-law
      const bufferSize = 4096;
      audioProcessor = audioContext.createScriptProcessor(bufferSize, 1, 1);

      // Aplicar ganancia para mejorar el volumen
      const gainNode = audioContext.createGain();
      gainNode.gain.value = 1.5; // Aumentar volumen moderadamente

      // Conectar la cadena de audio
      sourceNode.connect(gainNode);
      gainNode.connect(audioProcessor);
      audioProcessor.connect(audioContext.destination);

      // Crear un buffer de muestras PCM para el resampler
      let accumulatedSamples = [];
      let lastProcessTime = Date.now();

      // Procesar el audio capturado
      audioProcessor.onaudioprocess = (e) => {
        if (!isCapturing || !websocket || websocket.readyState !== WebSocket.OPEN) {
          return;
        }

        try {
          // Capturar el audio del buffer de entrada
          const inputBuffer = e.inputBuffer;
          const inputData = inputBuffer.getChannelData(0);

          // Acumular muestras
          accumulatedSamples.push(...Array.from(inputData));

          // Procesar periódicamente para reducir el overhead
          const currentTime = Date.now();
          if (currentTime - lastProcessTime >= 50) { // Procesar cada 50ms
            lastProcessTime = currentTime;

            if (accumulatedSamples.length > 0) {
              // Resamplear a 8kHz
              const samplesAt8k = resampleTo8k(accumulatedSamples, inputSampleRate);

              // Convertir a µ-law
              const mulawData = encodeToMulaw(samplesAt8k);

              // Enviar al servidor
              sendAudioData(mulawData, sessionId);

              // Limpiar el buffer acumulado
              accumulatedSamples = [];
            }
          }
        } catch (error) {
          console.error("[AgentVoice] Error procesando audio:", error);
        }
      };
    } catch (error) {
      console.error("[AgentVoice] Error configurando procesamiento de audio:", error);
      cleanupAudioResources();
    }
  }

  // Función para resamplear audio a 8kHz
  function resampleTo8k(samples, originalSampleRate) {
    const targetSampleRate = 8000;
    const ratio = originalSampleRate / targetSampleRate;
    const outputLength = Math.floor(samples.length / ratio);
    const result = new Float32Array(outputLength);

    // Algoritmo de resampleo simple: decimación con filtro anti-aliasing básico
    for (let i = 0; i < outputLength; i++) {
      const inputIndex = Math.floor(i * ratio);

      // Aplicar un promedio simple para un filtro anti-aliasing básico
      if (inputIndex < samples.length - 4) {
        // Promedio de 5 muestras para suavizar
        result[i] = (samples[inputIndex] + 
                      samples[inputIndex + 1] + 
                      samples[inputIndex + 2] + 
                      samples[inputIndex + 3] + 
                      samples[inputIndex + 4]) / 5;
      } else {
        result[i] = samples[Math.min(inputIndex, samples.length - 1)];
      }
    }

    return result;
  }

  // Tabla de búsqueda para codificación µ-law
  const MULAW_ENCODE_TABLE = new Uint8Array(256);

  // Inicializar tabla de µ-law
  (function initMuLawTable() {
    for (let i = 0; i < 256; i++) {
      // A diferencia del algoritmo tradicional, invertimos los bits para compatibilidad con Twilio
      MULAW_ENCODE_TABLE[i] = 255 - i;
    }
  })();

  // Función para codificar PCM a µ-law
  function encodeToMulaw(samples) {
    const BIAS = 33;
    const MAX = 0x7FFF;
    const result = new Uint8Array(samples.length);

    for (let i = 0; i < samples.length; i++) {
      // Convertir de float [-1, 1] a PCM de 16 bits
      let sample = Math.floor(samples[i] * MAX);

      // Determinar signo y computar valor absoluto
      const sign = (sample < 0) ? 0x80 : 0;
      sample = Math.abs(sample);

      // Aplicar bias logarítmico
      sample += BIAS;

      // Clip para prevenir overflow
      if (sample > MAX) {
        sample = MAX;
      }

      // Compresión logarítmica - Encuentra el segmento exponencial
      let segment = 0;
      if (sample > 0x7F) { // > 127
        let temp = sample;
        segment = 0;
        while (temp > 0xFF) { // > 255
          temp >>= 1;
          segment++;
        }
      }

      // Codificar en µ-law
      let ulawByte;
      if (segment >= 8) {
        ulawByte = 0x7F ^ sign;
      } else {
        const mask = (0xFF >> (segment + 1)) & 0x7F;
        const quantized = (sample >> (segment + 3)) & mask;
        ulawByte = ((segment << 4) | quantized) ^ sign;
      }

      // Invertir los bits para compatibilidad con Twilio
      result[i] = 255 - ulawByte;
    }

    return result;
  }

  // Enviar datos de audio procesados al servidor
  function sendAudioData(mulawData, sessionId) {
    if (!isCapturing || !websocket || websocket.readyState !== WebSocket.OPEN) {
      return;
    }

    // Detectar si el buffer contiene voz o silencio
    const hasVoice = detectVoiceActivity(mulawData);

    // Convertir a base64 para enviar por WebSocket
    const base64Data = arrayBufferToBase64(mulawData.buffer);

    // Enviar al servidor
    const message = {
      type: 'agent_audio',
      format: 'mulaw',
      sampleRate: 8000,
      payload: base64Data,
      sessionId: sessionId,
      is_silence: !hasVoice
    };

    websocket.send(JSON.stringify(message));

    // Log ocasional para monitoreo
    if (Math.random() < 0.05) { // Log aproximadamente 5% de los frames
      console.log(`[AgentVoice] Enviando audio al servidor. Tamaño: ${mulawData.length}, Voz detectada: ${hasVoice}`);
    }
  }

  // Detector básico de actividad de voz
  function detectVoiceActivity(mulawData) {
    // Contar muestras que no son silencio
    // En µ-law, 0xFF (255) es silencio y valores cercanos a 0x7F (127) son más ruidosos
    let nonSilentSamples = 0;

    // Umbral para considerar una muestra como no-silencio
    const nonSilenceThreshold = 225; // 0xFF - 30

    for (let i = 0; i < mulawData.length; i++) {
      if (mulawData[i] < nonSilenceThreshold) {
        nonSilentSamples++;
      }
    }

    // Si más del 5% de las muestras no son silencio, consideramos que hay voz
    return (nonSilentSamples / mulawData.length) > 0.05;
  }

  // Intento de reconexión
  function attemptReconnect(sessionId) {
    if (reconnectAttempts >= 3) {
      // Si ya intentamos reconectar 3 veces, rendirse
      console.error("[AgentVoice] Demasiados intentos de reconexión, deteniendo captura");
      stopCapturing();
      alert("Se ha perdido la conexión con el servidor. La captura de voz se ha detenido.");
      return;
    }

    reconnectAttempts++;

    console.log(`[AgentVoice] Intentando reconectar (intento ${reconnectAttempts})...`);

    // Esperar un poco más en cada intento (backoff exponencial)
    const delay = 1000 * Math.pow(2, reconnectAttempts - 1);

    clearTimeout(reconnectTimeout);
    reconnectTimeout = setTimeout(() => {
      startCapturing(sessionId);
    }, delay);
  }

  // Función para detener la captura de voz
  function stopCapturing() {
    if (!isCapturing && !isConnecting) return;

    console.log("[AgentVoice] Deteniendo captura de voz");

    isCapturing = false;
    isConnecting = false;

    clearTimeout(reconnectTimeout);
    cleanupAudioResources();

    // Cerrar WebSocket enviando mensaje primero
    if (websocket) {
      try {
        if (websocket.readyState === WebSocket.OPEN) {
          websocket.send(JSON.stringify({
            type: 'agent_disconnect',
            message: 'Agente desconectado'
          }));

          websocket.close();
        }
      } catch (e) {}
      websocket = null;
    }

    console.log("[AgentVoice] Captura de voz detenida");
  }

  // Limpiar recursos de audio
  function cleanupAudioResources() {
    // Detener y limpiar procesador de audio
    if (audioProcessor) {
      try {
        audioProcessor.disconnect();
      } catch (e) {}
      audioProcessor = null;
    }

    // Limpiar source node
    if (sourceNode) {
      try {
        sourceNode.disconnect();
      } catch (e) {}
      sourceNode = null;
    }

    // Cerrar contexto de audio
    if (audioContext) {
      try {
        audioContext.close();
      } catch (e) {}
      audioContext = null;
    }

    // Detener y liberar streams de medios
    if (mediaStream) {
      try {
        mediaStream.getTracks().forEach(track => track.stop());
      } catch (e) {}
      mediaStream = null;
    }
  }

  // Convertir ArrayBuffer a Base64
  function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  // API pública
  return {
    startCapturing,
    stopCapturing,
    isActive: () => isCapturing
  };
})();

// Exportar el módulo
window.AgentVoiceCapture = AgentVoiceCapture;