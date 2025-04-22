# Sistema de Call Center con IA - Información del Proyecto

## Descripción General
Este proyecto es un sistema de call center con IA que permite realizar llamadas automáticas utilizando un bot con voz humana. La característica distintiva es la capacidad de que un agente humano tome el control de la conversación en cualquier momento, de forma transparente para el cliente, sin interrumpir la llamada.

## Arquitectura del Sistema

### Componentes Principales
- **Servidor Backend**: Implementado con Fastify.
- **WebSockets**: Para comunicación en tiempo real entre componentes.
- **Twilio**: Para la gestión de llamadas telefónicas.
- **ElevenLabs**: Para la generación de voz sintética de alta calidad.
- **Frontend**: Interfaz web para control y monitoreo de llamadas.

### Flujo de Datos
1. El frontend inicia una llamada a través de la API.
2. El servidor configura la llamada con Twilio.
3. Twilio establece un stream de media bidireccional.
4. El audio del cliente se envía a ElevenLabs para procesamiento.
5. ElevenLabs genera respuestas que se envían de vuelta al cliente.
6. El agente puede monitorear e intervenir en cualquier momento.

## Estructura de Carpetas
- `/routes`: Definición de endpoints y manejo de rutas HTTP/WebSocket.
- `/services`: Servicios para interactuar con APIs externas (Twilio, ElevenLabs).
- `/utils`: Utilidades para procesamiento de audio, gestión de sesiones, etc.
- `/views`: Frontend de la aplicación (HTML, CSS, JavaScript).

## Componentes Clave y Su Función

### Gestión de Sesiones
El sistema utiliza un gestor de sesiones (`sessionManager.js`) para mantener aisladas las conexiones de diferentes clientes, garantizando que los mensajes y audio se envíen solo a las conexiones pertinentes.

### Procesamiento de Audio
Implementa técnicas avanzadas de procesamiento de audio (`audioProcessor.js`) para mejorar la calidad de voz, incluyendo:
- Amplificación de audio
- Compresión dinámica
- Filtrado de ruido
- Detección de actividad de voz

### Manejo de WebSockets
Múltiples conexiones WebSocket para:
- Logs y monitoreo (`/logs-websocket`)
- Stream de media para Twilio (`/outbound-media-stream`)
- Captura de voz del agente (`/agent-voice-stream`)

### Integración con ElevenLabs
Utiliza la API de ElevenLabs para:
- Generación de voces sintéticas de alta calidad
- Procesamiento de audio del cliente
- Generación de respuestas naturales

### Integración con Twilio
- Realización de llamadas salientes
- Transmisión de audio bidireccional
- Manejo de TwiML para control de llamadas

## Patrones de Código

### Módulos JavaScript
El frontend utiliza un patrón de módulos reveladores (revealing module pattern):
```javascript
// Ejemplo típico de módulo en el frontend
const ModuleName = (() => {
  // Variables privadas
  let privateVar;

  // Funciones privadas
  function privateFunction() {
    // implementación
  }

  // API pública
  return {
    publicFunction1,
    publicFunction2
  };
})();

// Exportar el módulo
window.ModuleName = ModuleName;
```

### Manejo de Asincronía
El backend utiliza extensivamente Promises y async/await:
```javascript
// Patrón típico para funciones asíncronas
export async function someAsyncFunction(param) {
  try {
    // Operación asíncrona
    const result = await somePromise();
    return result;
  } catch (error) {
    console.error("[Namespace] Error específico:", error);
    throw error; // O manejar el error apropiadamente
  }
}
```

### Logging
Sistema de logs estructurado con namespaces para facilitar depuración:
```javascript
console.log("[Namespace] Mensaje informativo", { 
  contextData, 
  sessionId // Contexto importante para debugging
});
```

### Control de Errores
Manejo de errores con contexto detallado:
```javascript
try {
  // Operación que puede fallar
} catch (error) {
  console.error("[Módulo] Error específico:", error, { sessionId });
  // Respuesta de error con información útil
  return {
    success: false,
    error: "Mensaje amigable para el usuario",
    errorDetails: process.env.NODE_ENV !== 'production' ? error.stack : undefined
  };
}
```

## Variables de Entorno
El sistema utiliza las siguientes variables de entorno:
- `PORT`: Puerto del servidor (default: 8000)
- `ELEVENLABS_API_KEY`: API key para ElevenLabs
- `ELEVENLABS_AGENT_ID`: ID del agente en ElevenLabs
- `TWILIO_ACCOUNT_SID`: SID de la cuenta de Twilio
- `TWILIO_AUTH_TOKEN`: Token de autenticación de Twilio
- `TWILIO_PHONE_NUMBER`: Número de teléfono saliente
- `TWILIO_BYOC_TRUNK_SID`: SID del trunk BYOC (si se usa)
- `DEFAULT_TO_PHONE_NUMBER`: Número de teléfono destino por defecto
- `REPLIT_DOMAINS`: Para construir URLs públicas

## Comandos Comunes

### Iniciar el Servidor
```bash
node index.js
```

### Estructura de los Requests API

#### Iniciar Llamada
```bash
curl -X POST http://localhost:8000/outbound-call \
  -H "Content-Type: application/json" \
  -d '{
    "user_name": "Nombre del Usuario",
    "to_number": "+5491112345678",
    "voice_id": "15bJsujCI3tcDWeoZsQP",
    "voice_name": "Ernesto Ferran",
    "sessionId": "session_id_opcional"
  }'
```

#### Finalizar Llamada
```bash
curl -X POST http://localhost:8000/end-call \
  -H "Content-Type: application/json" \
  -d '{
    "callSid": "CA123456789",
    "sessionId": "session_id_asociado"
  }'
```

## Convenciones de Código

### Nombres de Archivos
- Archivos JavaScript: `camelCase.js`
- Archivos HTML: `kebab-case.html`

### Nombrado de Funciones y Variables
- Funciones: `camelCase()`
- Constantes de configuración: `UPPER_SNAKE_CASE`
- Variables: `camelCase`
- Clases: `PascalCase`
- Módulos: `PascalCase` (para módulos reveladores en frontend)

### Estilo JavaScript
- Indent: 2 espacios
- Punto y coma al final de las instrucciones
- Comillas simples para strings
- Arrow functions para callbacks anónimos
- `const` por defecto, `let` cuando sea necesario

### Patrones de Comentarios
```javascript
/**
 * Descripción de la función
 * @param {tipo} nombre - Descripción del parámetro
 * @returns {tipo} - Descripción del valor retornado
 */
function nombreFuncion(nombre) {
  // Implementación
}
```

## Patrones de Prueba
El sistema actualmente no tiene pruebas automatizadas formalizadas, pero se recomienda:
- Jest para pruebas unitarias de funciones de utilidad
- Supertest para pruebas de API
- Cypress para pruebas e2e del frontend

## Áreas de Mejora Conocidas
1. Implementación de pruebas automatizadas
2. Manejo mejorado de reconexiones de WebSockets
3. Optimización del procesamiento de audio en tiempo real
4. Mejor gestión de errores en caso de fallo en servicios externos
5. Implementación de análisis de sentimiento en tiempo real

## Recursos Útiles
- [Documentación de Twilio Media Streams](https://www.twilio.com/docs/voice/twiml/stream)
- [API de ElevenLabs](https://docs.elevenlabs.io/api-reference)
- [Fastify WebSockets](https://github.com/fastify/fastify-websocket)

## Terminología del Proyecto
- **SessionId**: Identificador único para cada sesión de llamada
- **StreamSid**: ID del stream de media proporcionado por Twilio
- **CallSid**: ID único de la llamada en Twilio
- **Agente**: Operador humano que puede tomar el control
- **Bot**: Sistema automatizado que maneja la conversación inicialmente
- **Media Stream**: Flujo bidireccional de audio entre el sistema y Twilio
- **TwiML**: Lenguaje de marcado XML específico de Twilio para controlar llamadas