// Módulo para capturar la voz del agente y enviarla al servidor
const AgentVoiceCapture = (() => {
  // Variables privadas
  let mediaRecorder = null;
  let mediaStream = null;
  let audioContext = null;
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
            autoGainControl: true
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
        // Crear AudioContext con frecuencia de muestreo preferida de 8000Hz
        // Nota: Muchos navegadores no soportan 8000Hz directamente, 
        // así que se realizará un remuestreo si es necesario
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

      // Crear source desde el stream
      const source = audioContext.createMediaStreamSource(mediaStream);

      // Conectar al WebSocket para enviar audio
      try {
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${wsProtocol}//${window.location.host}/agent-voice-stream?sessionId=${sessionId}`;
        console.log("[AgentVoice] Conectando a WebSocket en:", wsUrl);

        websocket = new WebSocket(wsUrl);

        // Manejar apertura de conexión
        websocket.onopen = () => {
          console.log("[AgentVoice] Conexión WebSocket establecida");

          // Configurar procesador solo después de establecer conexión
          setupAudioProcessor(source, sessionId);

          // Enviar mensaje inicial
          websocket.send(JSON.stringify({
            type: 'agent_connect',
            sessionId: sessionId,
            message: 'Agente conectado y listo para enviar audio'
          }));

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
            if (mediaStream) {
              mediaStream.getTracks().forEach(track => track.stop());
              mediaStream = null;
            }

            if (audioContext) {
              audioContext.close().catch(() => {});
              audioContext = null;
            }

            alert("No se pudo establecer conexión con el servidor. Intente nuevamente.");
          }
        }, 5000);

      } catch (wsError) {
        console.error("[AgentVoice] Error creando WebSocket:", wsError);

        // Limpiar recursos en caso de error
        if (mediaStream) {
          mediaStream.getTracks().forEach(track => track.stop());
          mediaStream = null;
        }

        if (audioContext) {
          audioContext.close().catch(() => {});
          audioContext = null;
        }

        isConnecting = false;
        return false;
      }

      return true;
    } catch (error) {
      console.error("[AgentVoice] Error general iniciando captura de voz:", error);
      isConnecting = false;

      // Limpiar recursos en caso de error general
      if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;
      }

      if (audioContext) {
        audioContext.close().catch(() => {});
        audioContext = null;
      }

      return false;
    }
  }

  // Configurar procesador de audio
  function setupAudioProcessor(source, sessionId) {
    // Usar un procesador de script para procesar el audio
    const bufferSize = 4096;
    audioProcessor = audioContext.createScriptProcessor(bufferSize, 1, 1);

    source.connect(audioProcessor);
    audioProcessor.connect(audioContext.destination);

    // Procesar audio y enviarlo cuando está disponible
    let consecutiveSilentChunks = 0;
    let isAudioSending = false;

    audioProcessor.onaudioprocess = (e) => {
      if (!isCapturing || !websocket || websocket.readyState !== WebSocket.OPEN) {
        return;
      }

      // Evitar enviar múltiples fragmentos simultáneamente
      if (isAudioSending) {
        return;
      }

      isAudioSending = true;

      try {
        const inputData = e.inputBuffer.getChannelData(0);

        // Verificar actividad de voz
        const energy = calculateEnergy(inputData);
        const isVoiceActive = energy > 0.001; // Umbral ajustado para mejor detección

        if (isVoiceActive) {
          console.log("[AgentVoice] Enviando audio con energía:", energy.toFixed(5));
          // Se detectó voz, enviar audio
          consecutiveSilentChunks = 0;

          // Convertir de Float32Array a formato μ-law (8bits, 8kHz)
          const audioBuffer = convertFloat32ToMulaw(inputData);

          websocket.send(JSON.stringify({
            type: 'agent_audio',
            format: 'mulaw',  // Formato μ-law que Twilio espera
            sampleRate: 8000, // Frecuencia fija para telefonía
            payload: arrayBufferToBase64(audioBuffer),
            sessionId: sessionId,
            is_silence: false
          }));
        } else {
          // No se detectó voz, incrementar contador de silencio
          consecutiveSilentChunks++;

          // Enviar solo hasta 2 fragmentos de silencio consecutivos
          if (consecutiveSilentChunks < 2) {
            // Crear buffer de silencio para μ-law
            const silenceBuffer = new Uint8Array(bufferSize / 2); // 1 byte por muestra
            silenceBuffer.fill(255); // Valor μ-law para silencio

            websocket.send(JSON.stringify({
              type: 'agent_audio',
              format: 'mulaw',
              sampleRate: 8000,
              payload: arrayBufferToBase64(silenceBuffer.buffer),
              sessionId: sessionId,
              is_silence: true
            }));
          }
        }
      } catch (error) {
        console.error("[AgentVoice] Error procesando audio:", error);
      } finally {
        isAudioSending = false;
      }
    };
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

    // Detener y limpiar procesador de audio
    if (audioProcessor) {
      try {
        audioProcessor.disconnect();
      } catch (e) {}
      audioProcessor = null;
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

  // Calcular la energía de la señal de audio
  function calculateEnergy(samples) {
    let sum = 0;
    for (let i = 0; i < samples.length; i++) {
      sum += samples[i] * samples[i];
    }
    return sum / samples.length;
  }

  // Convertir Float32Array a μ-law (8-bit, 8kHz)
  function convertFloat32ToMulaw(float32Array) {
    // Convertir a μ-law, 1 byte por muestra
    const mulawData = new Uint8Array(float32Array.length);

    for (let i = 0; i < float32Array.length; i++) {
      // Convertir de Float32 [-1,1] a μ-law [0,255]
      mulawData[i] = linearToMulaw(float32Array[i]);
    }

    return mulawData.buffer;
  }

  // Implementación del algoritmo μ-law
  function linearToMulaw(sample) {
    // Constantes para la codificación μ-law
    const BIAS = 33;
    const CLIP = 32635;

    // Escalar la muestra al rango PCM de 16 bits
    sample = sample * 32768.0;

    // Determinar el signo y trabajar con valor absoluto
    const sign = (sample < 0) ? 0x80 : 0;
    if (sample < 0) sample = -sample;

    // Aplicar clipping para prevenir overflow
    if (sample > CLIP) sample = CLIP;

    // Agregar bias
    sample = sample + BIAS;

    // Calcular el exponente y la mantisa
    let exponent = 7;
    for (let i = 0x4000; i > 0; i >>= 1, exponent--) {
      if (sample >= i) break;
    }

    // Calcular la mantisa de 4 bits
    let mantissa = ((sample >> (exponent + 3)) & 0x0F);

    // Codificar el valor μ-law
    let mulawByte = ~(sign | (exponent << 4) | mantissa);

    return mulawByte & 0xFF;
  }

  // Convertir ArrayBuffer a Base64
  function arrayBufferToBase64(buffer) {
    const binary = [];
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary.push(String.fromCharCode(bytes[i]));
    }
    return window.btoa(binary.join(''));
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