function parseDateString(fecha) {
  if (!fecha) return null;
  if (fecha instanceof Date) return fecha;
  if (typeof fecha === 'string') {
    const trimmed = fecha.trim();
    const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(trimmed);
    if (isDateOnly) {
      return new Date(`${trimmed}T00:00:00`);
    }

    // MySQL/Node dates often arrive as "YYYY-MM-DD HH:mm:ss" without TZ.
    // Treat that format as UTC so Bogota conversion remains correct.
    const utcDateTimeMatch = trimmed.match(/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/);
    if (utcDateTimeMatch) {
      return new Date(`${trimmed.replace(' ', 'T')}Z`);
    }

    return new Date(trimmed);
  }
  return new Date(fecha);
}

function formatFechaColombia(fecha) {
  const date = parseDateString(fecha);
  if (!date || Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Bogota'
  });
}

function formatFechaColombiaDate(fecha) {
  const date = parseDateString(fecha);
  if (!date || Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'America/Bogota'
  });
}

function formatFechaHoraColombia(fechaHora) {
  const date = parseDateString(fechaHora);
  if (!date || Number.isNaN(date.getTime())) return '-';

  const fechaBogota = date.toLocaleDateString('es-CO', { timeZone: 'America/Bogota' });
  const hoyBogota = new Date().toLocaleDateString('es-CO', { timeZone: 'America/Bogota' });
  const hora = date.toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Bogota'
  });

  if (fechaBogota === hoyBogota) {
    return `Hoy ${hora}`;
  }

  const fecha = date.toLocaleDateString('es-CO', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'America/Bogota'
  });
  return `${fecha} ${hora}`;
}
