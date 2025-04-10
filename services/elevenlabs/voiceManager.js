// src/services/elevenlabs/voiceManager.js

/**
 * Obtiene la lista de voces disponibles en ElevenLabs
 * @returns {Array} Lista de voces disponibles con ID y nombre
 */
export const getAvailableVoices = () => {
  return [
    { id: "15bJsujCI3tcDWeoZsQP", name: "Ernesto Ferran" },
    { id: "dXzxF8F6baTsuGSxeorB", name: "Valeria Rodriguez" },
    { id: "ukupJ4zdf9bo1Py6MiO6", name: "Bruno Fernandez" },
    { id: "YExhVa4bZONzeingloMX", name: "Juan Carlos Gutierrez" },
    { id: "rEVYTKPqwSMhytFPayIb", name: "Sandra Valenzuela" },
    { id: "B5TKeu06uYzJCV6Pss3g", name: "Fernando Mansilla" },
    { id: "qHkrJuifPpn95wK3rm2A", name: "Andrea Chamorro" },
  ];
};

/**
 * Selecciona una voz según el ID proporcionado o aleatoriamente si se solicita
 * @param {string} voiceId - ID de la voz o "random" para selección aleatoria
 * @param {string} voiceName - Nombre de la voz (opcional)
 * @returns {Object} Objeto con ID y nombre de la voz seleccionada
 */
export const selectVoice = (voiceId, voiceName) => {
  const availableVoices = getAvailableVoices();

  if (voiceId === "random") {
    const randomVoice = availableVoices[Math.floor(Math.random() * availableVoices.length)];
    console.log("[ElevenLabs] Voz aleatoria seleccionada:", randomVoice.name);
    return {
      id: randomVoice.id,
      name: randomVoice.name
    };
  }

  return {
    id: voiceId,
    name: voiceName
  };
};