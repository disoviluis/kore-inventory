/**
 * =================================
 * KORE INVENTORY - EXPRESS APP
 * Configuración de Express
 * =================================
 */

import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import routes from './routes';
import { errorHandler, notFoundHandler } from './core/middleware/error.middleware';

/**
 * Crear y configurar la aplicación Express
 */
const createApp = (): Application => {
  const app: Application = express();

  // ============================================
  // MIDDLEWARES GLOBALES
  // ============================================

  // Seguridad con Helmet
  app.use(helmet());

  // CORS
  const corsOptions = {
    origin: process.env.CORS_ORIGIN?.split(',') || '*',
    credentials: true,
    optionsSuccessStatus: 200
  };
  app.use(cors(corsOptions));

  // Compresión de respuestas
  app.use(compression());

  // Logging de peticiones HTTP
  if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
  } else {
    app.use(morgan('combined'));
  }

  // Parser de JSON
  app.use(express.json({ limit: '10mb' }));
  
  // Parser de URL encoded
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // ============================================
  // RUTAS
  // ============================================

  // Health check
  app.get('/health', (_req, res) => {
    res.status(200).json({
      success: true,
      message: 'Kore Inventory API - Funcionando correctamente',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    });
  });

  // Rutas de la API
  const apiPrefix = process.env.API_PREFIX || '/api';
  app.use(apiPrefix, routes);

  // ============================================
  // MANEJO DE ERRORES
  // ============================================

  // Ruta no encontrada
  app.use(notFoundHandler);

  // Error handler global
  app.use(errorHandler);

  return app;
};

export default createApp;
