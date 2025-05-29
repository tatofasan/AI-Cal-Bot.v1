// Módulo para capturar la voz del agente usando el SDK de ElevenLabs
const AgentVoiceCapture = (() => {
  // Variables privadas
  let mediaRecorder = null;
  let mediaStream = null;
  let audioContext = null;
  let sourceNode = null;
  let audioProcessor = null;
  let isCapturing = false;
  let currentSessionId = null;
  let audioChunks = [];
  let isAgentMode = false;

  // Función para iniciar la captura de voz
  async function startCapturing(sessionId) {
    try {
      if (isCapturing) {
        console.log("[AgentVoice] Ya hay una captura de voz activa");
        return true;
      }

      currentSessionId = sessionId;
      console.log("[AgentVoice] Iniciando captura de voz para sessionId:", sessionId);

      // Solicitar permiso de micrófono con configuraciones optimizadas
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 16000, // SDK de ElevenLabs prefiere 16kHz
            channelCount: 1 // Mono
          } 
        });
      } catch (micError) {
        console.error("[AgentVoice] Error accediendo al micrófono:", micError);
        alert("No se pudo acceder al micrófono. Verifique los permisos del navegador.");
        return false;
      }

      // Configurar AudioContext 
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      console.log("[AgentVoice] AudioContext creado con sampleRate:", audioContext.sampleRate);

      // Notificar al servidor que el agente está tomando control
      try {
        const response = await fetch('/api/agent/take-control', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId })
        });

        const result = await response.json();
        if (!result.success) {
          throw new Error(result.error || 'Error al tomar control');
        }

        isAgentMode = true;
        console.log("[AgentVoice] Modo agente activado en el servidor");
      } catch (error) {
        console.error("[AgentVoice] Error activando modo agente:", error);
        cleanupAudioResources();
        return false;
      }

      // Configurar MediaRecorder para capturar audio
      setupMediaRecorder();

      // También configurar procesamiento en tiempo real
      setupAudioProcessor();

      isCapturing = true;
      console.log("[AgentVoice] Captura de voz iniciada exitosamente");

      // Interrumpir cualquier reproducción del bot
      if (window.AudioProcessor && typeof window.AudioProcessor.clearAudioQueues === 'function') {
        window.AudioProcessor.clearAudioQueues();
      }

      return true;
    } catch (error) {
      console.error("[AgentVoice] Error general iniciando captura de voz:", error);
      cleanupAudioResources();
      return false;
    }
  }

  // Configurar MediaRecorder para captura de audio
  function setupMediaRecorder() {
    // Usar el formato que mejor soporte el navegador
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
      ? 'audio/webm;codecs=opus' 
      : 'audio/webm';

    mediaRecorder = new MediaRecorder(mediaStream, {
      mimeType: mimeType,
      audioBitsPerSecond: 128000
    });

    audioChunks = [];

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = async () => {
      if (audioChunks.length > 0 && currentSessionId) {
        const audioBlob = new Blob(audioChunks, { type: mimeType });
        await sendAudioToServer(audioBlob);
        audioChunks = [];
      }
    };

    // Capturar audio cada 100ms
    mediaRecorder.start(100);
  }

  // Configurar procesamiento de audio en tiempo real
  function setupAudioProcessor() {
    try {
      sourceNode = audioContext.createMediaStreamSource(mediaStream);

      // Usar AudioWorklet si está disponible, sino ScriptProcessor
      const bufferSize = 2048;
      audioProcessor = audioContext.createScriptProcessor(bufferSize, 1, 1);

      sourceNode.connect(audioProcessor);
      audioProcessor.connect(audioContext.destination);

      let audioBuffer = [];
      let lastSendTime = Date.now();

      audioProcessor.onaudioprocess = async (e) => {
        if (!isCapturing || !currentSessionId) return;

        const inputData = e.inputBuffer.getChannelData(0);
        audioBuffer.push(...Array.from(inputData));

        // Enviar cada 100ms
        const now = Date.now();
        if (now - lastSendTime >= 100 && audioBuffer.length > 0) {
          lastSendTime = now;

          // Convertir a formato adecuado para el servidor
          const float32Array = new Float32Array(audioBuffer);
          await sendRealtimeAudio(float32Array);

          audioBuffer = [];
        }
      };
    } catch (error) {
      console.error("[AgentVoice] Error configurando procesador de audio:", error);
    }
  }

  // Enviar audio en tiempo real al servidor
  async function sendRealtimeAudio(audioData) {
    if (!currentSessionId || !isAgentMode) return;

    try {
      // Convertir Float32Array a base64 para enviar
      const buffer = new ArrayBuffer(audioData.length * 2);
      const view = new DataView(buffer);

      // Convertir de float32 a int16
      for (let i = 0; i < audioData.length; i++) {
        const sample = Math.max(-1, Math.min(1, audioData[i]));
        view.setInt16(i * 2, sample * 0x7FFF, true);
      }

      const base64Audio = btoa(String.fromCharCode(...new Uint8Array(buffer)));

      // Enviar al servidor
      await fetch('/api/agent/audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: currentSessionId,
          audio: base64Audio,
          format: 'pcm16',
          sampleRate: audioContext.sampleRate
        })
      });
    } catch (error) {
      console.error("[AgentVoice] Error enviando audio en tiempo real:", error);
    }
  }

  // Enviar audio grabado al servidor
  async function sendAudioToServer(audioBlob) {
    if (!currentSessionId) return;

    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'agent-audio.webm');
      formData.append('sessionId', currentSessionId);

      const response = await fetch('/api/agent/upload-audio', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();
      if (!result.success) {
        console.error("[AgentVoice] Error al enviar audio:", result.error);
      }
    } catch (error) {
      console.error("[AgentVoice] Error enviando audio al servidor:", error);
    }
  }

  // Función para detener la captura de voz
  async function stopCapturing() {
    if (!isCapturing) return;

    console.log("[AgentVoice] Deteniendo captura de voz");
    isCapturing = false;

    // Detener MediaRecorder
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }

    // Notificar al servidor que el agente deja el control
    if (currentSessionId && isAgentMode) {
      try {
        await fetch('/api/agent/release-control', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: currentSessionId })
        });
        console.log("[AgentVoice] Control liberado en el servidor");
      } catch (error) {
        console.error("[AgentVoice] Error al liberar control:", error);
      }
    }

    isAgentMode = false;
    currentSessionId = null;
    cleanupAudioResources();

    console.log("[AgentVoice] Captura de voz detenida");
  }

  // Enviar mensaje de texto como agente
  async function sendTextMessage(message) {
    if (!currentSessionId || !isAgentMode) {
      console.error("[AgentVoice] No hay sesión activa o no está en modo agente");
      return false;
    }

    try {
      const response = await fetch('/api/agent/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: currentSessionId,
          message: message
        })
      });

      const result = await response.json();
      return result.success;
    } catch (error) {
      console.error("[AgentVoice] Error enviando mensaje de texto:", error);
      return false;
    }
  }

  // Limpiar recursos de audio
  function cleanupAudioResources() {
    if (audioProcessor) {
      try {
        audioProcessor.disconnect();
      } catch (e) {}
      audioProcessor = null;
    }

    if (sourceNode) {
      try {
        sourceNode.disconnect();
      } catch (e) {}
      sourceNode = null;
    }

    if (audioContext && audioContext.state !== 'closed') {
      try {
        audioContext.close();
      } catch (e) {}
      audioContext = null;
    }

    if (mediaStream) {
      try {
        mediaStream.getTracks().forEach(track => track.stop());
      } catch (e) {}
      mediaStream = null;
    }

    if (mediaRecorder) {
      mediaRecorder = null;
    }

    audioChunks = [];
  }

  // API pública
  return {
    startCapturing,
    stopCapturing,
    sendTextMessage,
    isActive: () => isCapturing,
    isInAgentMode: () => isAgentMode
  };
})();

// Exportar el módulo
window.AgentVoiceCapture = AgentVoiceCapture;