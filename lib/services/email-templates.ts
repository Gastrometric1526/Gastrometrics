/**
 * Renderiza las plantillas HTML de correo de lib/email-templates/*.html — diseño
 * entregado externamente (email-safe: tablas + estilos inline, 640px, sin CSS
 * externo ni webfonts, ver lib/email-templates/LEEME.md que venía con el paquete
 * original). Solo se importa desde rutas de servidor.
 *
 * `{{variable}}` se reemplaza con texto plano — SIEMPRE hay que escapar contenido
 * que venga del usuario antes de pasarlo aquí (escapeHtml de abajo), nunca pasar
 * HTML crudo salvo que ya sea contenido de confianza (ej. `<br/>` generado por
 * nl2br después de escapar).
 */

import { readFileSync } from "fs"
import { join } from "path"

const TEMPLATE_DIR = join(process.cwd(), "lib", "email-templates")

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

// Escapa y convierte saltos de línea reales en <br/> — para meter texto de usuario
// (mensaje de feedback, respuesta del admin) dentro de una plantilla sin abrir un
// hueco de HTML injection y sin perder los saltos de línea que sí escribió.
export function escapeHtmlWithLineBreaks(input: string): string {
  return escapeHtml(input).replace(/\n/g, "<br/>")
}

function loadTemplate(fileName: string): string {
  return readFileSync(join(TEMPLATE_DIR, fileName), "utf-8")
}

function replaceVars(html: string, vars: Record<string, string>): string {
  return html.replace(/\{\{(\w+)\}\}/g, (match, key) => (key in vars ? vars[key] : match))
}

export function renderEmailTemplate(fileName: string, vars: Record<string, string>): string {
  return replaceVars(loadTemplate(fileName), vars)
}

// Plantilla 06 (cambio de plan) trae una sola fila de tabla marcada para repetirse
// una vez por feature, en vez de una lista de <li> — se repite esa fila N veces
// (una por item) antes de sustituir el resto de las variables normales.
export function renderEmailTemplateWithFeatureRows(
  fileName: string,
  features: string[],
  vars: Record<string, string>,
): string {
  const html = loadTemplate(fileName)
  const rowPattern = /<tr><td style="font-family:Archivo,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14\.5px;line-height:1\.55;color:#3A332E;padding-bottom:10px;border-bottom:1px solid #EDE6E0">\{\{feature\}\}<\/td><\/tr>/
  const rowMatch = html.match(rowPattern)
  if (!rowMatch) {
    // Si el patrón exacto no calza (la plantilla cambió), no revienta el envío —
    // sigue con una sola fila sin repetir en vez de lanzar.
    return replaceVars(html, { ...vars, feature: features[0] || "" })
  }
  const rowsHtml = features.map((f) => rowMatch[0].replace("{{feature}}", escapeHtml(f))).join("")
  const withRows = html.replace(rowPattern, rowsHtml)
  return replaceVars(withRows, vars)
}
