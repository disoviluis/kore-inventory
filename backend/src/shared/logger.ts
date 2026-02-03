/**
 * =================================
 * KORE INVENTORY - LOGGER
 * Sistema de logs personalizado
 * =================================
 */

type LogLevel = 'info' | 'success' | 'warning' | 'error' | 'debug';

class Logger {
  private colors = {
    reset: '\x1b[0m',
    info: '\x1b[36m',      // Cyan
    success: '\x1b[32m',   // Verde
    warning: '\x1b[33m',   // Amarillo
    error: '\x1b[31m',     // Rojo
    debug: '\x1b[35m'      // Magenta
  };

  private getTimestamp(): string {
    return new Date().toISOString();
  }

  private log(level: LogLevel, message: string, data?: any): void {
    const color = this.colors[level];
    const timestamp = this.getTimestamp();
    const prefix = `${color}[${level.toUpperCase()}]${this.colors.reset}`;
    
    console.log(`${prefix} ${timestamp} - ${message}`);
    
    if (data) {
      console.log(data);
    }
  }

  info(message: string, data?: any): void {
    this.log('info', message, data);
  }

  success(message: string, data?: any): void {
    this.log('success', message, data);
  }

  warning(message: string, data?: any): void {
    this.log('warning', message, data);
  }

  error(message: string, error?: any): void {
    this.log('error', message, error);
  }

  debug(message: string, data?: any): void {
    if (process.env.NODE_ENV === 'development') {
      this.log('debug', message, data);
    }
  }
}

export default new Logger();
