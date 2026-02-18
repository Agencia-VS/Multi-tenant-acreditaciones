/**
 * Sanitización HTML ligera para previews de admin
 * Elimina tags peligrosos y atributos de eventos JS.
 * Para uso en cliente (dangerouslySetInnerHTML previews).
 */

/** Tags HTML peligrosos que se eliminan por completo (incluido contenido para script) */
const SCRIPT_BLOCK = /<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi;
const DANGEROUS_TAGS = /<\s*\/?\s*(iframe|object|embed|applet|form|input|button|select|textarea|meta|link|base)[^>]*>/gi;

/** Atributos de eventos JS (onclick, onerror, onload, etc.) */
const EVENT_ATTRS = /\s+on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]*)/gi;

/** javascript: en href/src/action */
const JS_PROTOCOL = /(href|src|action)\s*=\s*["']?\s*javascript\s*:/gi;

/** data: URIs (pueden contener scripts) excepto imágenes */
const DATA_URI_DANGEROUS = /(href|src|action)\s*=\s*["']?\s*data\s*:(?!image\/(png|jpeg|gif|webp|svg\+xml))/gi;

/**
 * Sanitiza HTML eliminando tags y atributos peligrosos.
 * Permite HTML estructural (div, p, span, strong, etc.) y estilos inline.
 */
export function sanitizeHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(SCRIPT_BLOCK, '')
    .replace(DANGEROUS_TAGS, '')
    .replace(EVENT_ATTRS, '')
    .replace(JS_PROTOCOL, '$1=""')
    .replace(DATA_URI_DANGEROUS, '$1=""');
}
