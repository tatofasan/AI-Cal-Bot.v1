// Módulo para manejar todas las funcionalidades relacionadas con audio
const AudioProcessor = (() => {
  // Variables privadas
  let audioContext;
  let nextBotAudioTime = 0;
  let nextClientAudioTime = 0;
  let botAudioSources = [];
  let clientAudioSources = [];
  let masterGainNode = null;
  let isMonitoring = true;
  let processedAudioIds = new Set(); // Para evitar procesar audios duplicados

  // Inicializar el sistema de audio
  function getAudioContext() {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioContext;
  }

  function initAudioSystem() {
    const ctx = getAudioContext();
    if (!masterGainNode) {
      masterGainNode = ctx.createGain();
      masterGainNode.connect(ctx.destination);
    }
    // Asegurar que el volumen refleje el estado de monitoreo
    masterGainNode.gain.value = isMonitoring ? 1 : 0;
  }

  // Decodificación de audio
  function muLawToLinear(u_val) {
    u_val = ~u_val & 0xFF;
    let t = ((u_val & 0x0F) << 3) + 0x84;
    t <<= (u_val >> 4) & 0x07;
    return (u_val & 0x80) ? (0x84 - t) : (t - 0x84);
  }

  function decodeMuLaw(base64Data) {
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const samples = new Float32Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) {
      samples[i] = muLawToLinear(bytes[i]) / 32124;
    }
    return { samples, sampleRate: 8000 };
  }

  // Detener todas las fuentes de audio del bot
  function stopAllBotAudio() {
    botAudioSources.forEach(source => { 
      try { 
        source.stop(); 
        source.disconnect(); 
      } catch(e) { 
        console.error("Error deteniendo fuente de audio del bot:", e); 
      } 
    });

    botAudioSources = [];

    // Reiniciar el tiempo de audio del bot
    if (audioContext) {
      nextBotAudioTime = audioContext.currentTime;
    } else {
      nextBotAudioTime = 0;
    }

    console.log("Audio del bot interrumpido y cola limpiada");
  }

  // Reproducción de audio
  function playBotAudioChunk(base64Data, messageId) {
    // Verificar si ya procesamos este audio (evitar duplicados)
    const audioId = messageId || base64Data.substr(0, 20); // Usar ID o un hash simple
    if (processedAudioIds.has(audioId)) {
      console.log("Audio del bot ya procesado, evitando duplicado");
      return;
    }
    processedAudioIds.add(audioId);

    // Si no estamos monitoreando, no reproducir
    if (!isMonitoring) {
      return;
    }

    try {
      initAudioSystem();
      const ctx = getAudioContext();
      const { samples, sampleRate } = decodeMuLaw(base64Data);
      const audioBuffer = ctx.createBuffer(1, samples.length, sampleRate);
      audioBuffer.getChannelData(0).set(samples);
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      // Conectar al nodo master en lugar de directamente al destino
      source.connect(masterGainNode);
      botAudioSources.push(source);
      source.onended = () => { 
        botAudioSources = botAudioSources.filter(s => s !== source); 
      };
      const now = ctx.currentTime;
      if (nextBotAudioTime < now) nextBotAudioTime = now;
      source.start(nextBotAudioTime);
      nextBotAudioTime += audioBuffer.duration;

      // Limpiar el conjunto de IDs procesados después de un tiempo para evitar que crezca demasiado
      setTimeout(() => {
        processedAudioIds.delete(audioId);
      }, 10000); // 10 segundos es suficiente para evitar duplicados inmediatos
    } catch (err) {
      console.error("Error reproduciendo audio del bot:", err);
    }
  }

  function playClientAudioChunk(base64Data, messageId) {
    // Verificar si ya procesamos este audio (evitar duplicados)
    const audioId = messageId || base64Data.substr(0, 20); // Usar ID o un hash simple
    if (processedAudioIds.has(audioId)) {
      console.log("Audio del cliente ya procesado, evitando duplicado");
      return;
    }
    processedAudioIds.add(audioId);

    // Si no estamos monitoreando, no reproducir
    if (!isMonitoring) {
      return;
    }

    try {
      initAudioSystem();
      const ctx = getAudioContext();
      const { samples, sampleRate } = decodeMuLaw(base64Data);
      const audioBuffer = ctx.createBuffer(1, samples.length, sampleRate);
      audioBuffer.getChannelData(0).set(samples);
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      // Conectar al nodo master en lugar de directamente al destino
      source.connect(masterGainNode);
      clientAudioSources.push(source);
      source.onended = () => { 
        clientAudioSources = clientAudioSources.filter(s => s !== source); 
      };
      const now = ctx.currentTime;
      if (nextClientAudioTime < now) nextClientAudioTime = now;
      source.start(nextClientAudioTime);
      nextClientAudioTime += audioBuffer.duration;

      // Limpiar el conjunto de IDs procesados después de un tiempo
      setTimeout(() => {
        processedAudioIds.delete(audioId);
      }, 10000);
    } catch (err) {
      console.error("Error reproduciendo audio del cliente:", err);
    }
  }

  // Control de audio
  function clearAudioQueues() {
    // Detener todas las fuentes de audio del bot
    botAudioSources.forEach(source => { 
      try { 
        source.stop(); 
        source.disconnect(); 
      } catch(e) { 
        console.error("Error deteniendo fuente de audio:", e); 
      } 
    });

    // Detener todas las fuentes de audio del cliente
    clientAudioSources.forEach(source => { 
      try { 
        source.stop(); 
        source.disconnect(); 
      } catch(e) { 
        console.error("Error deteniendo fuente de audio:", e); 
      } 
    });

    // Limpiar los arrays
    botAudioSources = [];
    clientAudioSources = [];

    // Reiniciar los tiempos
    if (audioContext) {
      nextBotAudioTime = audioContext.currentTime;
      nextClientAudioTime = audioContext.currentTime;
    } else {
      nextBotAudioTime = 0;
      nextClientAudioTime = 0;
    }

    // Actualizar el nodo de ganancia principal según el estado de monitoreo
    if (masterGainNode) {
      masterGainNode.gain.value = isMonitoring ? 1 : 0;
    }

    // Limpiar también el registro de audios procesados
    processedAudioIds.clear();

    console.log("Colas de audio borradas: monitoreo " + (isMonitoring ? "activado" : "desactivado"));
  }

  function toggleMonitoring() {
    isMonitoring = !isMonitoring;

    // Inicializar sistema de audio si no está inicializado
    initAudioSystem();

    // Actualizar inmediatamente el volumen maestro
    if (masterGainNode) {
      // Cambio abrupto a 0 para silenciar inmediatamente todo el audio
      masterGainNode.gain.setValueAtTime(isMonitoring ? 1 : 0, getAudioContext().currentTime);
    }

    // Limpiar colas de audio existentes
    clearAudioQueues();

    // Log para depuración
    console.log("Estado de monitoreo cambiado a: " + (isMonitoring ? "activado" : "desactivado"));

    return isMonitoring;
  }

  // API pública
  return {
    playBotAudioChunk,
    playClientAudioChunk,
    clearAudioQueues,
    stopAllBotAudio,
    toggleMonitoring,
    isMonitoring: () => isMonitoring
  };
})();

// Exportar el módulo
window.AudioProcessor = AudioProcessor;