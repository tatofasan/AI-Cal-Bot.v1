// routes/authRoutes.js
import { 
  serveLoginPage, 
  handleLogin, 
  handleLogout, 
  handleCreateUser 
} from '../middleware/auth-middleware.js';

/**
 * Configuración de rutas de autenticación
 * @param {object} fastify - Instancia de Fastify
 * @param {object} options - Opciones de configuración
 */
export default async function authRoutes(fastify, options) {
  // Ruta para servir la página de login
  fastify.get('/login', serveLoginPage);

  // Ruta para manejar el proceso de login
  fastify.post('/api/auth/login', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string' },
          password: { type: 'string' }
        }
      }
    }
  }, handleLogin);

  // Ruta para manejar el proceso de logout
  fastify.get('/api/auth/logout', handleLogout);

  // Ruta para crear usuarios
  fastify.post('/api/auth/create-user', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password', 'userType', 'pin'],
        properties: {
          email: { type: 'string' },
          password: { type: 'string' },
          userType: { type: 'string', enum: ['operador', 'supervisor'] },
          pin: { type: 'string' }
        }
      }
    }
  }, handleCreateUser);
}