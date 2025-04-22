// Módulo para manejar las llamadas a la API
const ApiService = (() => {
  // Iniciar una llamada
  async function initiateCall(callData) {
    // Verificar que voice_name esté presente
    if (!callData.voice_name && callData.voice_id) {
      // Si falta voice_name pero tenemos voice_id, intentamos recuperarlo
      const voiceSelect = document.getElementById('voiceSelected');
      if (voiceSelect) {
        // Buscar la opción que coincide con el voice_id
        const selectedOption = Array.from(voiceSelect.options).find(
          option => option.value === callData.voice_id
        );

        if (selectedOption) {
          callData.voice_name = selectedOption.getAttribute('data-nombre');
          console.log("Recuperado voice_name:", callData.voice_name);
        }
      }
    }

    console.log("Datos finales de la llamada:", callData);

    const response = await fetch('/outbound-call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(callData)
    });

    if (!response.ok) {
      throw new Error("Error HTTP: " + response.status + " " + response.statusText);
    }

    return await response.json();
  }

  // Finalizar una llamada
  async function endCall(callSid, sessionId) {
    const data = { 
      callSid, 
      sessionId
    };

    const response = await fetch('/end-call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error("Error al cortar la llamada");
    }

    return await response.json();
  }

  // API pública
  return {
    initiateCall,
    endCall
  };
})();

// Exportar el módulo
window.ApiService = ApiService;