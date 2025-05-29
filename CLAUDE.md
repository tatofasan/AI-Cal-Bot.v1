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
- `/data`: Almacenamiento persistente para datos de llamadas históricas.

## Componentes Clave y Su Función

### Gestión de Sesiones
El sistema utiliza un gestor de sesiones (`sessionManager.js`) para mantener aisladas las conexiones de diferentes clientes, garantizando que los mensajes y audio se envíen solo a las conexiones pertinentes. Las sesiones almacenan también el historial de transcripciones para acceso posterior.

### Almacenamiento de Llamadas
El sistema cuenta con un servicio de almacenamiento de llamadas (`callStorageService.js`) que:
- Mantiene registro de todas las llamadas activas en memoria
- Guarda llamadas finalizadas recientes (últimos 30 minutos) en memoria para acceso rápido
- Persiste en archivo JSON las llamadas finalizadas para liberar memoria
- Limpia automáticamente llamadas antiguas (más de 30 minutos) en intervalos regulares
- Implementa detección de "llamadas fantasma" que llevan demasiado tiempo activas

### Procesamiento de Audio
Implementa técnicas avanzadas de procesamiento de audio (`audioProcessor.js`) para mejorar la calidad de voz, incluyendo:
- Amplificación de audio
- Compresión dinámica
- Filtrado de ruido
- Detección de actividad de voz
- Métricas de latencia para monitoreo de calidad

### Manejo de WebSockets
Múltiples tipos de conexiones WebSocket para:
- Logs y monitoreo (`/logs-websocket`)
- Stream de media para Twilio (`/outbound-media-stream`)
- Captura de voz del agente (`/agent-voice-stream`)
- Comunicación bidireccional con el dashboard de administración

### Integración con ElevenLabs
Utiliza la API de ElevenLabs para:
- Generación de voces sintéticas de alta calidad
- Procesamiento de audio del cliente
- Generación de respuestas naturales
- Soporte para interrupciones cuando el agente toma el control

### Integración con Twilio
- Realización de llamadas salientes
- Transmisión de audio bidireccional
- Manejo de TwiML para control de llamadas
- Recepción de callbacks de estado para monitoreo en tiempo real

## Dashboard de Administración
El sistema incluye un dashboard de administración que permite:
- Visualizar todas las llamadas activas y finalizadas recientes (últimos 30 minutos)
- Alternar entre vista de llamadas activas y llamadas recientes mediante pestañas
- Monitorear transcripciones de conversaciones en tiempo real
- Terminar llamadas desde la interfaz
- Ver estadísticas de uso del sistema
- Verificar el estado de las conexiones
- Refrescar automáticamente las transcripciones de llamadas activas

### Características del Dashboard
- Manejo optimizado de UI para evitar errores de DOM al finalizar llamadas
- Persistencia de llamadas finalizadas en archivo para optimizar uso de memoria
- Limpieza automática de llamadas antiguas (más de 30 minutos)
- Notificaciones en tiempo real de cambios en las llamadas
- Visualización de métricas como duración, estado y participación de agente
- Auto-refresco configurable de transcripciones

## Interfaz de Agente Humano
- Permite monitorear llamadas en tiempo real
- Incluye un sistema de captura de voz del agente en tiempo real
- Procesamiento de audio del agente con mejoras de calidad
- Capacidad de interrumpir al bot para tomar el control
- Soporte para enviar mensajes directos de texto (sin voz)
- Visualización de transcripciones en tiempo real

## Sistema de Transcripciones
- Almacenamiento centralizado de transcripciones en el servidor por sesión y llamada
- Diferenciación entre mensajes del cliente, bot y agente humano
- Visualización en tiempo real con marcas de tiempo
- API dedicada para consultar y actualizar transcripciones
- Auto-refresco configurable en el panel de administración
- Procesamiento de logs para extracción de transcripciones

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

### Manejo Seguro del DOM
Utilizamos verificación doble para operaciones del DOM que pueden ser problemáticas:
```javascript
// Verificar que la tarjeta existe antes de intentar eliminarla
const card = document.getElementById(`call-${id}`);
if (card) {
  // Añadir clase para animar la salida
  card.classList.add('opacity-0', 'transform', 'scale-95');
  setTimeout(() => {
    if (document.getElementById(`call-${id}`)) { // Verificar de nuevo antes de eliminar
      card.remove();
    }
  }, 300);
}
```

## Sistema de Voces
El sistema cuenta con múltiples voces disponibles a través de ElevenLabs:
- Selección de voz por nombre e ID
- Opción de voz aleatoria para variedad
- Métricas de calidad y latencia para cada voz

## Detección de Problemas
El sistema incluye varias funcionalidades para detectar y manejar problemas:
- Detección de llamadas fantasma (llamadas que llevan activas demasiado tiempo)
- Manejo de reconexión automática para WebSockets
- Timeouts para operaciones críticas
- Notificaciones visuales de estado de conexión

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

#### Terminar Sesión
```bash
curl -X POST http://localhost:8000/terminate-session \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "session_id_para_terminar"
  }'
```

#### Obtener Transcripciones
```bash
curl -X GET http://localhost:8000/session-transcripts?sessionId=session_id_a_consultar
```

#### Añadir Transcripción
```bash
curl -X POST http://localhost:8000/add-transcript \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "session_id_destino",
    "text": "Texto de la transcripción",
    "speakerType": "bot"
  }'
```

#### Obtener Todas las Llamadas
```bash
curl -X GET http://localhost:8000/api/calls
```

#### Obtener Detalles de una Llamada
```bash
curl -X GET http://localhost:8000/api/calls/session_id_de_llamada
```

#### Obtener Transcripciones de una Llamada
```bash
curl -X GET http://localhost:8000/api/calls/session_id_de_llamada/transcriptions
```

## Interfaz de Usuario

### Vista Principal (Agente)
- Formulario para iniciar llamadas
- Monitor de audio en tiempo real con métricas de latencia
- Panel de transcripción de la conversación
- Controles para:
  - Iniciar/finalizar llamadas
  - Monitorear audio
  - Tomar/dejar control como agente humano

### Dashboard (Administrador)
- Visualización de llamadas activas y finalizadas recientes
- Filtros por pestañas para alternar entre llamadas activas y recientes
- Visualización de transcripciones por llamada
- Controles para terminar llamadas
- Panel de logs del sistema
- Opciones de refresco automático para datos en tiempo real
- Almacenamiento persistente de datos históricos con limpieza automática

## Monitoreo de Rendimiento
El sistema incluye métricas de latencia de audio que se actualizan cada 5 fragmentos de audio recibidos, proporcionando información sobre:
- Latencia promedio (últimas 10 muestras)
- Valores mínimos y máximos de latencia
- Cantidad de fragmentos de audio procesados
- Estado de la conexión con los servicios externos

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
- Módulos ES6 con `import/export` en el backend

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

## Problemas Conocidos y Soluciones
1. **Dashboard no finaliza llamadas correctamente**: Se identificó un problema donde las llamadas no se finalizaban correctamente desde el dashboard aunque la UI mostraba que sí. La causa era que a veces el callSid no se pasaba correctamente. Se implementó una solución para buscar el callSid en el almacenamiento si no está disponible en el parámetro.
2. **Llamadas fantasma**: Llamadas que permanecen "activas" en el sistema mucho después de haber terminado. Se implementó un sistema de detección y limpieza automática.
3. **Problemas de reconexión de WebSockets**: Pérdidas ocasionales de conexión. Se implementó un sistema de reconexión automática con backoff exponencial.

## Áreas de Mejora Conocidas
1. Implementación de pruebas automatizadas
2. Manejo mejorado de reconexiones de WebSockets
3. Optimización del procesamiento de audio en tiempo real
4. Mejor gestión de errores en caso de fallo en servicios externos
5. Implementación de análisis de sentimiento en tiempo real
6. Optimización de la persistencia de datos de llamadas para entornos de producción
7. Implementación de Tailwind como dependencia en lugar de CDN para entornos de producción
8. Detección de contestadores automáticos usando análisis de patrones y eventos DTMF
9. Mejoras en la interfaz del agente para mostrar estadísticas de llamadas en tiempo real

## Recursos Útiles
- [Documentación de Twilio Media Streams](https://www.twilio.com/docs/voice/twiml/stream)
- [API de ElevenLabs](https://docs.elevenlabs.io/api-reference)
- [Fastify WebSockets](https://github.com/fastify/fastify-websocket)
- [TwiML](https://www.twilio.com/docs/voice/twiml)
- [Tonos DTMF para detección de contestadores](https://www.twilio.com/docs/voice/twiml/gather)

## Terminología del Proyecto
- **SessionId**: Identificador único para cada sesión de llamada
- **StreamSid**: ID del stream de media proporcionado por Twilio
- **CallSid**: ID único de la llamada en Twilio
- **Agente**: Operador humano que puede tomar el control
- **Bot**: Sistema automatizado que maneja la conversación inicialmente
- **Media Stream**: Flujo bidireccional de audio entre el sistema y Twilio
- **TwiML**: Lenguaje de marcado XML específico de Twilio para controlar llamadas
- **Latencia de Audio**: Medida del tiempo transcurrido entre fragmentos de audio consecutivos
- **Transcripción**: Texto generado a partir del audio del cliente o del bot/agente
- **Persistencia de Llamadas**: Sistema para almacenar y recuperar datos de llamadas históricas
- **Limpieza Automática**: Proceso que elimina datos antiguos para optimizar el uso de recursos
- **Llamada Fantasma**: Llamada que aparece como activa en el sistema pero que ya ha terminado
- **DTMF**: Dual-Tone Multi-Frequency, los tonos generados por las teclas telefónicas

## Refactor SDK ElevenLabs (Diciembre 2024)

### Resumen de la Implementación
Se completó un refactor completo del sistema TalkFlow para utilizar el SDK oficial de ElevenLabs en lugar de implementaciones personalizadas de WebSocket. Este refactor mejora significativamente la estabilidad, rendimiento y mantenibilidad del sistema.

### Archivos Modificados
1. **package.json** - Actualizado con la dependencia del SDK oficial de ElevenLabs
2. **services/elevenLabsService.js** - Servicio principal completamente refactorizado para usar el SDK
3. **utils/audioProcessor.js** - Simplificado al eliminar la conversión µ-law (ya no necesaria con el SDK)
4. **views/js/agentVoiceCapture.js** - Actualizado para usar endpoints REST del agente
5. **services/speechService.js** - Integrado con las nuevas funciones del SDK
6. **routes/agentRoutes.js** - Nuevas rutas API para control del agente
7. **routes/index.js** - Actualizado para incluir las nuevas rutas del agente
8. **server.js** - Añadido soporte multipart para upload de archivos de audio
9. **services/elevenlabs/mediaStreamService.js** - Capa de compatibilidad para código legacy
10. **routes/websockets.js** - Simplificado para trabajar con el SDK

### Mejoras Principales

#### Reducción de Código
- **~40% menos líneas de código**: El SDK maneja internamente la complejidad de WebSockets, reconexiones, y procesamiento de audio
- Eliminación de código duplicado y lógica compleja de manejo de estado

#### Mayor Estabilidad
- **Reconexión automática**: El SDK maneja las reconexiones de forma transparente
- **Mejor manejo de errores**: Errores específicos y recuperación automática
- **Gestión de estado robusta**: Estado de conversación manejado por el SDK

#### Mejor Rendimiento
- **Pipeline de audio optimizado**: Procesamiento más eficiente del audio
- **Menor latencia**: Comunicación directa con los servidores de ElevenLabs
- **Uso reducido de memoria**: Menos buffers intermedios

#### Nuevas Funcionalidades
- **Detección de emociones**: Análisis del tono emocional en las conversaciones
- **Métricas avanzadas**: Información detallada sobre latencia, calidad de audio, etc.
- **Variables dinámicas**: Capacidad de modificar el comportamiento del agente en tiempo real
- **Mejor control del agente**: Transición más suave entre bot y agente humano

### Arquitectura Mejorada

#### Antes (WebSocket Manual)
```
Cliente → Twilio → WebSocket Server → Parser → ElevenLabs API → Procesamiento → Cliente
```

#### Después (SDK)
```
Cliente → Twilio → SDK ElevenLabs → Cliente
```

### Cambios en la API del Agente

#### Nuevos Endpoints
- `POST /api/agent/take-control` - Activa el modo agente para una sesión
- `POST /api/agent/release-control` - Libera el control del agente
- `POST /api/agent/audio` - Envía audio del agente en tiempo real
- `POST /api/agent/message` - Envía mensaje de texto del agente
- `POST /api/agent/upload-audio` - Carga archivo de audio del agente
- `GET /api/agent/status/:sessionId` - Obtiene estado del agente para una sesión

### Pasos de Migración Ejecutados
1. **Backup del código**: Se preservó toda la funcionalidad existente
2. **Instalación del SDK**: `npm install elevenlabs@^1.59.0`
3. **Refactor del servicio principal**: Reescritura completa de `elevenLabsService.js`
4. **Actualización de rutas**: Nuevas rutas para funcionalidad del agente
5. **Simplificación de audio**: Eliminación de conversión µ-law innecesaria
6. **Capa de compatibilidad**: Para código que aún usa la API antigua
7. **Pruebas y validación**: Verificación de toda la funcionalidad

### Beneficios para el Desarrollo
- **Código más limpio**: Menos complejidad, más fácil de entender
- **Mejor documentación**: El SDK tiene documentación oficial completa
- **Actualizaciones automáticas**: Mejoras del SDK se aplican automáticamente
- **Soporte oficial**: Acceso a soporte de ElevenLabs para problemas del SDK
- **Desarrollo más rápido**: Nuevas funciones son más fáciles de implementar

### Compatibilidad
- Todo el código existente sigue funcionando gracias a la capa de compatibilidad
- Las APIs REST se mantienen idénticas
- La interfaz de usuario no requiere cambios
- Los WebSockets de Twilio siguen funcionando igual

### Notas de Implementación
- El SDK requiere Node.js 16 o superior
- La API key de ElevenLabs debe tener permisos para Conversational AI
- El agent ID debe ser válido y estar activo
- Se recomienda usar las voces optimizadas para conversación