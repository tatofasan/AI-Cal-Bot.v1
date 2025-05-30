# Sistema TalkFlow - Documentación Completa

## Descripción General
TalkFlow es un sistema avanzado de call center con IA que permite realizar llamadas automáticas utilizando el SDK de ElevenLabs para conversaciones naturales. Su característica principal es la capacidad de que un agente humano tome el control de la conversación en cualquier momento, de forma transparente para el cliente.

## Arquitectura del Sistema

### Stack Tecnológico
- **Backend**: Node.js con Fastify (ES Modules)
- **WebSockets**: @fastify/websocket para comunicación en tiempo real
- **Integración de Voz**: ElevenLabs SDK v1.59.0 (refactorizado en Diciembre 2024)
- **Telefonía**: Twilio para gestión de llamadas
- **Frontend**: HTML5, JavaScript modular, Tailwind CSS
- **Autenticación**: Sistema basado en cookies con @fastify/cookie
- **Almacenamiento**: Sistema híbrido (memoria + archivos JSON)

### Componentes Principales

#### 1. Sistema de Autenticación
- **Tipos de usuarios**: Operador y Supervisor
- **Middleware de autenticación**: `requireAuth` y `requireSupervisor`
- **Gestión de sesiones**: Cookies HTTP-only con duración de 24 horas
- **PIN de administrador**: 1107 para crear nuevos usuarios

#### 2. Servicio Unificado de Sesiones (`unifiedSessionService`)
El corazón del sistema que mantiene el estado completo de cada sesión:
```javascript
{
  id: "session_xxx",
  createdAt: timestamp,
  lastActivity: timestamp,
  call: {
    sid: "twilio_call_sid",
    status: "active|ended|starting",
    phoneNumber: "+xxx",
    userName: "nombre",
    voiceId: "elevenlabs_voice_id",
    voiceName: "nombre_voz"
  },
  connections: {
    twilioWs: WebSocket,
    elevenLabsConversation: Conversation,
    logClients: Set<WebSocket>,
    agentWs: WebSocket
  },
  agent: {
    isActive: boolean,
    takeoverCount: number,
    lastTakeoverTime: timestamp
  },
  transcriptions: [...],
  metrics: {
    audioChunksReceived: number,
    audioChunksSent: number,
    latencyHistory: []
  }
}
```

#### 3. Integración con ElevenLabs SDK
- **Conversational AI**: Usa el SDK oficial para manejo de conversaciones
- **Modos**: Bot automático y modo agente (takeover)
- **Procesamiento de audio**: Automático a través del SDK
- **Detección de emociones**: Capacidad del SDK para análisis emocional
- **Variables dinámicas**: Modificación en tiempo real del comportamiento

#### 4. Sistema de Almacenamiento de Llamadas
- **Llamadas activas**: En memoria (Map)
- **Llamadas recientes**: En memoria por 30 minutos
- **Persistencia**: Archivo JSON para historial
- **Limpieza automática**: Cada 5 minutos
- **Detección de llamadas fantasma**: Llamadas activas por más de 2 horas

## Flujos Principales

### 1. Flujo de Autenticación
```
Usuario → /login → Verificación credenciales → Cookie sesión → Redirección por rol
  ↓
  ├─ Operador → / (Vista de agente)
  └─ Supervisor → /dashboard (Panel de control)
```

### 2. Flujo de Llamada Saliente
```
1. Operador inicia llamada → POST /outbound-call
2. Servidor crea sesión en unifiedSessionService
3. Twilio establece llamada → TwiML con Stream
4. WebSocket bidireccional Twilio ↔ Servidor
5. ElevenLabs SDK procesa conversación
6. Audio fluye: Cliente → Twilio → Servidor → ElevenLabs → Servidor → Twilio → Cliente
```

### 3. Flujo de Toma de Control (Agent Takeover)
```
1. Agente presiona "Tomar control" → POST /api/agent/take-control
2. Sistema activa modo agente en la sesión
3. ElevenLabs cambia a modo 'agent'
4. Captura de micrófono del agente
5. Audio del agente → Servidor → ElevenLabs → Cliente
6. Transcripciones marcadas como "agent" vs "bot"
```

## Estructura del Proyecto

```
/
├── index.js                 # Punto de entrada
├── server.js               # Configuración de Fastify
├── middleware/
│   └── auth-middleware.js  # Autenticación y autorización
├── routes/
│   ├── index.js           # Registro de todas las rutas
│   ├── authRoutes.js      # Login, logout, creación usuarios
│   ├── outboundCall.js    # Gestión de llamadas
│   ├── agentRoutes.js     # API del agente
│   ├── dashboardRoutes.js # Dashboard supervisor
│   ├── callRoutes.js      # API de llamadas
│   ├── sessionRoutes.js   # Gestión de sesiones
│   ├── twilioCallbacks.js # Webhooks de Twilio
│   └── websockets.js      # Conexiones WebSocket
├── services/
│   ├── unifiedSessionService.js  # Gestión centralizada de sesiones
│   ├── elevenLabsService.js      # Integración con SDK ElevenLabs
│   ├── twilioService.js          # Servicios de Twilio
│   ├── callStorageService.js     # Almacenamiento de llamadas
│   └── speechService.js          # Procesamiento de voz del agente
├── utils/
│   ├── audioProcessor.js         # Utilidades de audio
│   └── logger.js                 # Sistema de logs
├── views/
│   ├── index.html               # Interfaz del operador
│   ├── dashboard.html           # Panel del supervisor
│   ├── login.html               # Página de login
│   └── js/
│       ├── main.js              # Script principal operador
│       ├── agentVoiceCapture.js # Captura de voz del agente
│       ├── audioProcessor.js    # Procesamiento de audio cliente
│       ├── apiService.js        # Llamadas a API
│       ├── uiController.js      # Control de UI
│       ├── webSocketHandler.js  # Manejo de WebSocket
│       └── dashboard/           # Scripts del dashboard
└── data/
    └── call_history.json        # Historial persistente
```

## APIs y Endpoints

### Autenticación
- `GET /login` - Página de login
- `POST /api/auth/login` - Procesar login
- `GET /api/auth/logout` - Cerrar sesión
- `POST /api/auth/create-user` - Crear usuario (requiere PIN)

### Gestión de Llamadas
- `POST /outbound-call` - Iniciar llamada
- `POST /end-call` - Finalizar llamada
- `GET /outbound-call-twiml` - Generar TwiML para Twilio
- `POST /twilio-status-callback` - Webhook de estado de Twilio

### API del Agente
- `POST /api/agent/take-control` - Activar modo agente
- `POST /api/agent/release-control` - Desactivar modo agente
- `POST /api/agent/audio` - Enviar audio del agente
- `POST /api/agent/message` - Enviar mensaje de texto
- `POST /api/agent/upload-audio` - Cargar archivo de audio
- `GET /api/agent/status/:sessionId` - Estado del agente

### Dashboard y Monitoreo
- `GET /dashboard` - Panel de supervisor (requiere rol supervisor)
- `GET /api/calls` - Obtener todas las llamadas
- `GET /api/calls/:callId` - Detalles de una llamada
- `GET /api/calls/:callId/transcriptions` - Transcripciones
- `GET /api/sessions` - Estadísticas de sesiones

### WebSockets
- `/logs-websocket?sessionId=xxx` - Logs y eventos en tiempo real
- `/outbound-media-stream?sessionId=xxx` - Stream de audio con Twilio

## Características Avanzadas

### 1. Sistema de Transcripciones
- Almacenamiento por sesión y por llamada
- Tipos de hablante: `client`, `bot`, `agent`, `system`
- Actualización en tiempo real vía WebSocket
- Persistencia en `callStorageService`

### 2. Métricas de Rendimiento
- **Latencia de audio**: Medición entre chunks de audio
- **Estadísticas de llamadas**: Duración, estado, intervenciones
- **Detección de actividad**: Voice Activity Detection (VAD)
- **Métricas del agente**: Número de intervenciones, tiempo activo

### 3. Manejo de Estados Complejos
- **Llamadas fantasma**: Detección y limpieza automática
- **Reconexión automática**: WebSockets con backoff exponencial
- **Estados de llamada**: `idle`, `starting`, `active`, `ended`
- **Transiciones suaves**: Entre bot y agente humano

### 4. Dashboard del Supervisor
- **Vista de llamadas activas**: Actualización cada 5 segundos
- **Llamadas recientes**: Últimos 30 minutos
- **Transcripciones en vivo**: Con auto-refresh opcional
- **Control remoto**: Finalizar llamadas desde el dashboard
- **Logs del sistema**: En tiempo real
- **Detección de llamadas sospechosas**: Indicadores visuales

## Configuración y Variables de Entorno

```bash
# Puerto del servidor
PORT=8000

# ElevenLabs
ELEVENLABS_API_KEY=tu_api_key
ELEVENLABS_AGENT_ID=id_del_agente

# Twilio
TWILIO_ACCOUNT_SID=tu_account_sid
TWILIO_AUTH_TOKEN=tu_auth_token
TWILIO_PHONE_NUMBER=+numero_saliente
TWILIO_BYOC_TRUNK_SID=trunk_sid_opcional
DEFAULT_TO_PHONE_NUMBER=+numero_destino_default

# Seguridad
COOKIE_SECRET=secret_para_cookies

# Replit (si aplica)
REPLIT_DOMAINS=tu_dominio.replit.app
```

## Patrones de Diseño Implementados

### 1. Singleton Pattern
- `unifiedSessionService` - Una única instancia global
- Gestión centralizada del estado de todas las sesiones

### 2. Module Pattern (Frontend)
```javascript
const ModuleName = (() => {
  // Estado privado
  let privateState = {};
  
  // Funciones privadas
  function privateFunction() {}
  
  // API pública
  return {
    publicMethod1,
    publicMethod2
  };
})();
```

### 3. Event-Driven Architecture
- WebSockets para eventos en tiempo real
- Callbacks para operaciones asíncronas
- Eventos personalizados del DOM

### 4. Middleware Pattern
- Autenticación antes de rutas protegidas
- Validación de roles para acceso

## Seguridad Implementada

1. **Autenticación basada en cookies**
   - HTTP-only cookies
   - Duración limitada (24 horas)
   - Validación en cada request

2. **Autorización por roles**
   - Operador: Acceso a interfaz de llamadas
   - Supervisor: Acceso adicional al dashboard

3. **Validación de entrada**
   - Schemas en Fastify para validación
   - Sanitización de datos del cliente

4. **Protección de recursos**
   - SessionId requerido para WebSockets
   - Validación de permisos en APIs sensibles

## Mejoras Recientes (Diciembre 2024)

### Refactor del SDK de ElevenLabs
- **Antes**: Implementación manual de WebSocket
- **Después**: SDK oficial con reconexión automática
- **Beneficios**:
  - 40% menos código
  - Mayor estabilidad
  - Mejor manejo de errores
  - Métricas avanzadas
  - Detección de emociones

### Sistema de Autenticación
- Login con email/contraseña
- Creación de usuarios con PIN administrativo
- Redirección automática por rol
- Cierre de sesión seguro

### Dashboard Mejorado
- Tabs para llamadas activas/recientes
- Actualización optimizada del DOM
- Detección de llamadas fantasma
- Indicadores visuales de estado

## Problemas Conocidos y Soluciones

1. **Llamadas Fantasma**
   - **Problema**: Llamadas que permanecen activas indefinidamente
   - **Solución**: Detección automática y limpieza cada 15 minutos

2. **Pérdida de Conexión WebSocket**
   - **Problema**: Desconexiones intermitentes
   - **Solución**: Reconexión automática con backoff exponencial

3. **Latencia de Audio**
   - **Problema**: Retraso en la conversación
   - **Solución**: Métricas en tiempo real y optimización de buffers

## Guía de Uso

### Para Operadores
1. Iniciar sesión con credenciales
2. Ingresar datos del cliente
3. Seleccionar voz (o dejar aleatoria)
4. Iniciar llamada
5. Monitorear transcripciones
6. Tomar control si es necesario
7. Finalizar llamada

### Para Supervisores
1. Iniciar sesión con rol supervisor
2. Acceder al dashboard
3. Monitorear llamadas activas
4. Revisar llamadas recientes
5. Ver transcripciones en tiempo real
6. Finalizar llamadas si es necesario
7. Revisar logs del sistema

## Mantenimiento y Monitoreo

### Logs
- Logs estructurados con timestamps
- Namespaces para facilitar debugging
- Transmisión en tiempo real vía WebSocket

### Métricas Clave
- Número de llamadas activas
- Duración promedio de llamadas
- Intervenciones de agentes
- Latencia de respuesta
- Llamadas fantasma detectadas

### Limpieza de Datos
- Automática cada 5 minutos
- Llamadas de más de 30 minutos se archivan
- Detección de anomalías cada 15 minutos

## Próximos Pasos Sugeridos

1. **Testing**
   - Implementar tests unitarios con Jest
   - Tests de integración para APIs
   - Tests E2E con Cypress

2. **Escalabilidad**
   - Migrar a base de datos para persistencia
   - Implementar Redis para caché de sesiones
   - Load balancing para múltiples instancias

3. **Características**
   - Análisis de sentimiento en tiempo real
   - Grabación de llamadas
   - Reportes y analytics avanzados
   - Integración con CRM

4. **Seguridad**
   - Implementar JWT para autenticación
   - Rate limiting en APIs
   - Encriptación de datos sensibles
   - Auditoría de acciones