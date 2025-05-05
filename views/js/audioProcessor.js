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

  // Variables para métricas
  let latencyMetrics = {
    lastClientAudioReceived: 0, // Timestamp de la última vez que se recibió audio del cliente
    lastBotResponseReceived: 0, // Timestamp de la última respuesta del bot
    responseLatency: 0, // Latencia entre cliente y respuesta del bot
    avgResponseLatency: 0, // Promedio de latencias de respuesta
    maxResponseLatency: 0, // Máxima latencia de respuesta
    minResponseLatency: Number.MAX_VALUE, // Mínima latencia de respuesta
    recentLatencies: [], // Últimas latencias para calcular promedio móvil
    audioChunksReceived: 0, // Contador de fragmentos de audio recibidos
    awaitingBotResponse: false // Flag para indicar que estamos esperando respuesta del bot
  };

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

  // Reproducción de audio
  function playBotAudioChunk(base64Data, messageId) {
    const now = Date.now();

    // Si estamos esperando respuesta del bot, calcular la latencia
    if (latencyMetrics.awaitingBotResponse) {
      latencyMetrics.lastBotResponseReceived = now;
      latencyMetrics.responseLatency = now - latencyMetrics.lastClientAudioReceived;

      // Actualizar las métricas de latencia
      latencyMetrics.recentLatencies.push(latencyMetrics.responseLatency);
      if (latencyMetrics.recentLatencies.length > 5) { // Mantener solo las últimas 5
        latencyMetrics.recentLatencies.shift();
      }

      // Calcular promedio
      const sum = latencyMetrics.recentLatencies.reduce((a, b) => a + b, 0);
      latencyMetrics.avgResponseLatency = Math.round(sum / latencyMetrics.recentLatencies.length);

      // Actualizar máximo y mínimo
      latencyMetrics.maxResponseLatency = Math.max(latencyMetrics.maxResponseLatency, latencyMetrics.responseLatency);
      latencyMetrics.minResponseLatency = Math.min(latencyMetrics.minResponseLatency, latencyMetrics.responseLatency);

      // Actualizar UI con las métricas
      updateLatencyUI();

      // Ya no estamos esperando respuesta
      latencyMetrics.awaitingBotResponse = false;
    }

    // Verificar si ya procesamos este audio (evitar duplicados)
    const audioId = messageId || base64Data.substr(0, 20); // Usar ID o un hash simple
    if (processedAudioIds.has(audioId)) {
      console.log("Audio ya procesado, evitando duplicado:", audioId);
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
    // Marcar que hemos recibido audio del cliente y estamos esperando respuesta del bot
    latencyMetrics.lastClientAudioReceived = Date.now();
    latencyMetrics.awaitingBotResponse = true;

    // Incrementar contador de fragmentos
    latencyMetrics.audioChunksReceived++;

    // Verificar si ya procesamos este audio (evitar duplicados)
    const audioId = messageId || base64Data.substr(0, 20); // Usar ID o un hash simple
    if (processedAudioIds.has(audioId)) {
      console.log("Audio ya procesado, evitando duplicado:", audioId);
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

  // Actualizar la UI con las métricas de latencia
  function updateLatencyUI() {
    // Buscar o crear el elemento de métricas
    let metricsElement = document.getElementById('audio-metrics');
    if (!metricsElement) {
      metricsElement = document.createElement('div');
      metricsElement.id = 'audio-metrics';
      metricsElement.className = 'text-xs bg-gray-100 p-2 rounded text-gray-700 mt-2';

      // Insertar después del callStatus
      const callStatus = document.getElementById('callStatus');
      if (callStatus && callStatus.parentNode) {
        callStatus.parentNode.insertBefore(metricsElement, callStatus.nextSibling);
      }
    }

    // Determinar el estado de la latencia
    let latencyClass = 'text-green-600';
    let latencyStatus = 'Buena';

    if (latencyMetrics.avgResponseLatency > 2000) { // Más de 2 segundos se considera alta
      latencyClass = 'text-red-600';
      latencyStatus = 'Alta';
    } else if (latencyMetrics.avgResponseLatency > 1000) { // Más de 1 segundo se considera media
      latencyClass = 'text-yellow-600';
      latencyStatus = 'Media';
    }

    // Actualizar el contenido
    metricsElement.innerHTML = `
      <div class="flex justify-between items-center">
        <span class="font-bold">Latencia de Respuesta:</span>
        <span class="${latencyClass} font-bold">${latencyStatus}</span>
      </div>
      <div class="grid grid-cols-3 gap-2 mt-1">
        <div>Promedio: <span class="font-mono">${latencyMetrics.avgResponseLatency}ms</span></div>
        <div>Mín: <span class="font-mono">${latencyMetrics.minResponseLatency === Number.MAX_VALUE ? 'N/A' : latencyMetrics.minResponseLatency + 'ms'}</span></div>
        <div>Máx: <span class="font-mono">${latencyMetrics.maxResponseLatency}ms</span></div>
      </div>
      <div class="text-xs text-gray-500 mt-1">
        Interacciones: ${latencyMetrics.recentLatencies.length}
      </div>
    `;
  }

  // Control de audio
  function clearAudioQueues() {
    botAudioSources.forEach(source => { 
      try { 
        source.stop(); 
        source.disconnect(); 
      } catch(e) { 
        console.error("Error deteniendo fuente de audio:", e); 
      } 
    });
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

  // Obtener métricas de latencia
  function getLatencyMetrics() {
    return { ...latencyMetrics };
  }

  // API pública
  return {
    playBotAudioChunk,
    playClientAudioChunk,
    clearAudioQueues,
    toggleMonitoring,
    isMonitoring: () => isMonitoring,
    getLatencyMetrics
  };
})();

// Exportar el módulo
window.AudioProcessor = AudioProcessor;