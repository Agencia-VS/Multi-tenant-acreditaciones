/**
 * Utilidades de fecha y timezone para Chile (America/Santiago)
 * 
 * El sistema opera en timezone de Chile. Las fechas se almacenan como TIMESTAMPTZ
 * en Supabase (UTC), pero se muestran y capturan en hora local de Chile.
 */

const CHILE_TZ = 'America/Santiago';

/**
 * Obtiene la hora actual en Chile como Date.
 * Usado para comparaciones de deadline en el servidor.
 */
export function nowInChile(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: CHILE_TZ }));
}

/**
 * Convierte un string datetime-local (sin TZ) a ISO string con offset Chile.
 * Ej: "2026-02-10T23:59" → "2026-02-10T23:59:00-03:00"
 * 
 * Supabase recibirá el timestamp con la zona horaria correcta.
 */
export function localToChileISO(datetimeLocal: string): string {
  if (!datetimeLocal) return '';
  
  // datetime-local gives "YYYY-MM-DDTHH:mm" format — parse it in Chile timezone
  const date = new Date(datetimeLocal);
  
  // Get the Chile offset for the given date (handles DST automatically)
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: CHILE_TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
    timeZoneName: 'longOffset',
  });
  
  // We need to construct the date in Chile timezone
  // Use the input value directly and append the Chile offset
  const parts = datetimeLocal.split('T');
  if (parts.length !== 2) return datetimeLocal;
  
  const [datePart, timePart] = parts;
  const timeWithSeconds = timePart.includes(':') && timePart.split(':').length === 2 
    ? `${timePart}:00` 
    : timePart;
  
  // Get Chile's current UTC offset for the given date
  const offset = getChileOffset(datePart);
  
  return `${datePart}T${timeWithSeconds}${offset}`;
}

/**
 * Calcula el offset UTC de Chile para una fecha dada.
 * Chile usa CLT (UTC-4) en invierno y CLST (UTC-3) en verano.
 */
function getChileOffset(dateStr: string): string {
  // Create a date object for the given date at noon (to avoid edge cases)
  const testDate = new Date(`${dateStr}T12:00:00Z`);
  
  // Format in Chile TZ and UTC to calculate the offset
  const utcStr = testDate.toLocaleString('en-US', { timeZone: 'UTC', hour12: false });
  const clStr = testDate.toLocaleString('en-US', { timeZone: CHILE_TZ, hour12: false });
  
  const utcTime = new Date(utcStr).getTime();
  const clTime = new Date(clStr).getTime();
  
  const diffMinutes = Math.round((clTime - utcTime) / 60000);
  const hours = Math.floor(Math.abs(diffMinutes) / 60);
  const mins = Math.abs(diffMinutes) % 60;
  const sign = diffMinutes >= 0 ? '+' : '-';
  
  return `${sign}${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

/**
 * Convierte un timestamp ISO (con TZ) a formato datetime-local para inputs.
 * Ej: "2026-02-10T23:59:00-03:00" → "2026-02-10T23:59"
 * 
 * Muestra la hora en Chile independientemente del TZ almacenado.
 */
export function isoToLocalDatetime(isoString: string | null | undefined): string {
  if (!isoString) return '';
  
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';
    
    // Format in Chile timezone
    const parts = new Intl.DateTimeFormat('sv-SE', {
      timeZone: CHILE_TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(date);
    
    const get = (type: string) => parts.find(p => p.type === type)?.value || '00';
    return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
  } catch {
    return '';
  }
}

/**
 * Verifica si un deadline ya pasó comparando en timezone Chile.
 * Retorna true si la fecha ya venció.
 */
export function isDeadlinePast(deadlineISO: string | null | undefined): boolean {
  if (!deadlineISO) return false;
  
  try {
    const deadline = new Date(deadlineISO);
    if (isNaN(deadline.getTime())) return false;
    
    // Both dates are in UTC internally — comparison is correct
    // The key is that the deadline was STORED correctly with Chile offset
    return deadline.getTime() < Date.now();
  } catch {
    return false;
  }
}

/**
 * Determina si la acreditación está cerrada, considerando:
 *  1. Override manual en event.config.acreditacion_abierta (prioridad máxima)
 *  2. Fecha límite de acreditación (si no hay override)
 * 
 * Retorna { closed: boolean, reason: string }
 */
export function isAccreditationClosed(
  eventConfig: Record<string, unknown> | null | undefined,
  fechaLimite: string | null | undefined
): { closed: boolean; reason: string } {
  // 1. Override manual tiene prioridad
  const manualOverride = eventConfig?.acreditacion_abierta;
  if (typeof manualOverride === 'boolean') {
    if (manualOverride) {
      return { closed: false, reason: 'Abierto manualmente por el administrador' };
    } else {
      return { closed: true, reason: 'Cerrado manualmente por el administrador' };
    }
  }

  // 2. Fecha límite
  if (fechaLimite) {
    const past = isDeadlinePast(fechaLimite);
    if (past) {
      return {
        closed: true,
        reason: `El plazo para solicitar acreditación cerró el ${formatDeadlineChile(fechaLimite)}`,
      };
    }
  }

  return { closed: false, reason: '' };
}

/**
 * Formatea una fecha deadline para mostrar al usuario en Chile.
 */
export function formatDeadlineChile(deadlineISO: string | null | undefined): string {
  if (!deadlineISO) return '';
  
  try {
    const date = new Date(deadlineISO);
    if (isNaN(date.getTime())) return '';
    
    return date.toLocaleString('es-CL', {
      timeZone: CHILE_TZ,
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}
