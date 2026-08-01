/**
 * =================================
 * KORE INVENTORY - DATABASE CONNECTION
 * Conexión a MySQL con pool de conexiones
 * =================================
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// Configuración del pool de conexiones
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'kore_inventory',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  timezone: '+00:00' // RDS almacena en UTC; el frontend convierte a Bogotá
});

/**
 * Verifica la conexión a la base de datos
 */
export const testConnection = async (): Promise<void> => {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Conexión a MySQL exitosa');
    console.log(`📦 Base de datos: ${process.env.DB_NAME}`);
    connection.release();
  } catch (error) {
    console.error('❌ Error al conectar con MySQL:', error);
    throw error;
  }
};

/**
 * Ejecuta una consulta SQL
 */
export const query = async (sql: string, params?: any[]): Promise<any> => {
  try {
    const [results] = await pool.execute(sql, params);
    return results;
  } catch (error) {
    console.error('Error en consulta SQL:', error);
    throw error;
  }
};

/**
 * Ejecuta un conjunto de operaciones dentro de una transacción real de MySQL.
 * Todas las queries hechas con el `query` que recibe el callback usan la MISMA
 * conexión, y se hace COMMIT solo si todo el callback termina sin errores.
 * Si algo falla, se hace ROLLBACK automáticamente (evita estados parciales,
 * por ejemplo: stock descontado sin que la venta/detalle se haya guardado).
 */
export const withTransaction = async <T>(
  callback: (query: (sql: string, params?: any[]) => Promise<any>) => Promise<T>
): Promise<T> => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const txQuery = async (sql: string, params?: any[]): Promise<any> => {
      const [results] = await connection.execute(sql, params);
      return results;
    };

    const result = await callback(txQuery);

    await connection.commit();
    return result;
  } catch (error) {
    try {
      await connection.rollback();
    } catch (rollbackError) {
      console.error('Error al hacer rollback:', rollbackError);
    }
    throw error;
  } finally {
    connection.release();
  }
};

export default pool;
