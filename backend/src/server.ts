/**
 * =================================
 * KORE INVENTORY - SERVER
 * Punto de entrada del servidor
 * Disovi Soft - 2026
 * =================================
 */

import dotenv from 'dotenv';
import createApp from './app';
import { testConnection } from './shared/database';
import logger from './shared/logger';

// Cargar variables de entorno
dotenv.config();

const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

/**
 * Iniciar servidor
 */
const startServer = async (): Promise<void> => {
  try {
    // Banner
    console.log('\n');
    console.log('╔═══════════════════════════════════════════════╗');
    console.log('║                                               ║');
    console.log('║        🚀 KORE INVENTORY - BACKEND API        ║');
    console.log('║        Sistema ERP SaaS Multiempresa          ║');
    console.log('║        Disovi Soft © 2026                     ║');
    console.log('║                                               ║');
    console.log('╚═══════════════════════════════════════════════╝');
    console.log('\n');

    // Verificar conexión a base de datos
    logger.info('Verificando conexión a base de datos...');
    await testConnection();

    // Crear aplicación Express
    const app = createApp();

    // Iniciar servidor
    app.listen(PORT, () => {
      logger.success(`🚀 Servidor iniciado exitosamente`);
      logger.info(`📍 Entorno: ${NODE_ENV}`);
      logger.info(`🌐 Puerto: ${PORT}`);
      logger.info(`🔗 API: http://localhost:${PORT}${process.env.API_PREFIX || '/api'}`);
      logger.info(`💚 Health check: http://localhost:${PORT}/health`);
      console.log('\n');
      logger.success('✅ Sistema listo para recibir peticiones');
      console.log('\n');
    });
  } catch (error) {
    logger.error('❌ Error al iniciar el servidor:', error);
    process.exit(1);
  }
};

// Manejar errores no capturados
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', { promise, reason });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Iniciar servidor
startServer();
