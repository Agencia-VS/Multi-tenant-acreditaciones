/**
 * Normaliza un string para comparación de reglas (cupos, zonas, organizaciones).
 * - Convierte a minúsculas
 * - Elimina todos los espacios
 * - Trim de extremos
 *
 * Ejemplos:
 *   "VS"            → "vs"
 *   "Todo o Nada"   → "todoonada"
 *   "UC "           → "uc"
 *   " Radio  Bio Bio " → "radiobiobio"
 */
export function normalizeForMatch(s: string | null | undefined): string {
  return (s || '').toLowerCase().replace(/\s+/g, '');
}
