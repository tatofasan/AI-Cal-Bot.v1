// middleware/auth-middleware.js
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

// Para obtener __dirname en ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Middleware para verificar si el usuario está autenticado
 * @param {Object} req - Objeto de solicitud Fastify
 * @param {Object} reply - Objeto de respuesta Fastify
 */
export const requireAuth = async (req, reply) => {
  // Verificar si hay una cookie de sesión
  const sessionId = req.cookies.sessionId;

  if (!sessionId) {
    // Si no hay cookie de sesión, redirigir a login
    reply.redirect('/login');
    return;
  }

  // En una implementación real, verificaríamos el sessionId contra una base de datos
  // Para este ejemplo, simplemente lo validamos contra un patrón
  const isValidSession = sessionId && sessionId.startsWith('session_');

  if (!isValidSession) {
    // Si la sesión no es válida, limpiar cookie y redirigir
    reply.clearCookie('sessionId');
    reply.redirect('/login');
    return;
  }
};

/**
 * Middleware para verificar si el usuario tiene rol de supervisor
 * @param {Object} req - Objeto de solicitud Fastify
 * @param {Object} reply - Objeto de respuesta Fastify
 */
export const requireSupervisor = async (req, reply) => {
  // Verificar si hay una cookie de sesión
  const sessionId = req.cookies.sessionId;

  if (!sessionId) {
    // Si no hay cookie de sesión, redirigir a login
    reply.redirect('/login');
    return;
  }

  // Verificar si la sesión es válida
  const isValidSession = sessionId && sessionId.startsWith('session_');

  if (!isValidSession) {
    // Si la sesión no es válida, limpiar cookie y redirigir
    reply.clearCookie('sessionId');
    reply.redirect('/login');
    return;
  }

  // Verificar el rol
  const userRole = req.cookies.userRole;

  if (userRole !== 'supervisor') {
    // Si no es supervisor, redirigir a la página principal
    reply.redirect('/');
    return;
  }
};

/**
 * Middleware para servir la página de login
 * @param {Object} req - Objeto de solicitud Fastify
 * @param {Object} reply - Objeto de respuesta Fastify
 */
export const serveLoginPage = async (req, reply) => {
  try {
    // Leer el archivo login.html
    const loginPath = join(__dirname, '../views/login.html');

    // Verificar que el archivo existe
    if (!fs.existsSync(loginPath)) {
      console.error(`[Auth] El archivo login.html no existe en la ruta: ${loginPath}`);
      reply.code(500).send('Error: Archivo login.html no encontrado');
      return;
    }

    // Leer el contenido del archivo
    const content = fs.readFileSync(loginPath, 'utf8');

    // Responder con el contenido HTML
    reply.type('text/html').send(content);
  } catch (error) {
    console.error('[Auth] Error sirviendo página de login:', error);
    reply.code(500).send('Error interno del servidor');
  }
};

/**
 * Middleware para manejar el inicio de sesión
 * @param {Object} req - Objeto de solicitud Fastify
 * @param {Object} reply - Objeto de respuesta Fastify
 */
export const handleLogin = async (req, reply) => {
  try {
    const { email, password } = req.body;

    // Verificar credenciales
    // En una implementación real, verificaríamos contra una base de datos
    // Para este ejemplo, simulamos la verificación con localStorage en el cliente

    // Generar una sesión
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Extraer el tipo de usuario del body si existe, sino asumir "operador"
    const userType = req.body.userType || 'operador';

    // Establecer cookies con información de sesión
    reply.setCookie('sessionId', sessionId, {
      path: '/',
      httpOnly: true,
      maxAge: 86400 // 24 horas
    });

    reply.setCookie('userRole', userType, {
      path: '/',
      httpOnly: true,
      maxAge: 86400 // 24 horas
    });

    reply.setCookie('userEmail', email, {
      path: '/',
      httpOnly: true,
      maxAge: 86400 // 24 horas
    });

    // Devolver éxito
    reply.send({ 
      success: true, 
      redirectTo: userType === 'supervisor' ? '/dashboard' : '/' 
    });
  } catch (error) {
    console.error('[Auth] Error en login:', error);
    reply.code(500).send({ success: false, error: 'Error interno del servidor' });
  }
};

/**
 * Middleware para manejar el cierre de sesión
 * @param {Object} req - Objeto de solicitud Fastify
 * @param {Object} reply - Objeto de respuesta Fastify
 */
export const handleLogout = async (req, reply) => {
  try {
    // Limpiar cookies
    reply.clearCookie('sessionId', { path: '/' });
    reply.clearCookie('userRole', { path: '/' });
    reply.clearCookie('userEmail', { path: '/' });

    // Redirigir a login
    reply.redirect('/login');
  } catch (error) {
    console.error('[Auth] Error en logout:', error);
    reply.code(500).send('Error interno del servidor');
  }
};

/**
 * Middleware para crear usuarios
 * @param {Object} req - Objeto de solicitud Fastify
 * @param {Object} reply - Objeto de respuesta Fastify
 */
export const handleCreateUser = async (req, reply) => {
  try {
    const { email, password, userType, pin } = req.body;

    // Verificar PIN de administrador
    if (pin !== '1107') {
      reply.code(403).send({ 
        success: false, 
        error: 'PIN de administrador incorrecto' 
      });
      return;
    }

    // En una implementación real, guardaríamos el usuario en una base de datos
    // Para este ejemplo, simulamos éxito

    reply.send({ success: true });
  } catch (error) {
    console.error('[Auth] Error creando usuario:', error);
    reply.code(500).send({ 
      success: false, 
      error: 'Error interno del servidor' 
    });
  }
};