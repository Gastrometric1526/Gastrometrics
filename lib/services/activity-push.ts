/**
 * Avisos de actividad para los aparatos de /admin (docs/248). Puro: decide qué acciones
 * avisan, cuántas veces y arma el texto.
 *
 * Desde docs/295 avisa de casi todo lo que hace una persona: «tiene que ser la mayor cantidad
 * de notificaciones para que así yo pueda estar pendiente de cuando un usuario hace algo.
 * Importaciones, exportaciones, todo». Para que el celular no se llene, cada tipo tiene su
 * tope por persona (`pushLimit`).
 *
 * Negocio nuevo, invitación a un equipo y cuenta nueva no están aquí porque ya avisan por su
 * cuenta (notify-owner.ts, notify-signup.ts), y tampoco las invitaciones a volver a un módulo
 * (`nudge_*`), que son de la app y no de la persona.
 */

/** Nombre de cada módulo, para «Entró a …». */
const MODULE_NAMES: Record<string, string> = {
  dashboard: "Dashboard",
  ficha_tecnica: "Ficha técnica",
  recetas: "Mis recetas",
  ingredientes: "Ingredientes",
  inventario: "Inventario",
  equipo: "Equipo",
  menus: "Menús",
  mep: "MEP",
  ordenes_compra: "Menú y compras",
  estadisticas: "Estadísticas",
  ventas: "Ventas",
  salon: "Salón",
  negocios: "Negocios",
}

const TITLES: Record<string, string> = {
  "app:opened": "Entró a la app",

  // Recetas
  "recetas:created": "Receta creada",
  "recetas:updated": "Receta editada",
  "recetas:deleted": "Receta borrada",
  "recetas:imported": "Recetas importadas",
  "recetas:migrated": "Receta migrada a otro negocio",

  // Ingredientes
  "ingredientes:created": "Ingrediente creado",
  "ingredientes:updated": "Ingrediente editado",
  "ingredientes:deleted": "Ingrediente borrado",
  "ingredientes:imported": "Ingredientes importados",
  "ingredientes:exported": "Ingredientes exportados (CSV)",
  "ingredientes:template": "Descargó la plantilla de ingredientes",

  // Inventario
  "inventario:created": "Inventario registrado",
  "inventario:updated": "Inventario editado",
  "inventario:deleted": "Inventario borrado",
  "inventario:imported": "Inventario importado",

  // Menús y compras
  "menus:created": "Menú creado",
  "menus:updated": "Menú editado",
  "menus:deleted": "Menú borrado",
  "ordenes_compra:created": "Orden de compra creada",
  "ordenes_compra:updated": "Orden de compra editada",
  "ordenes_compra:imported": "Órdenes de compra importadas",
  "ordenes_compra:deleted": "Orden de compra borrada",
  "facturas:deleted": "Factura borrada",

  // Ventas y estadísticas
  "estadisticas:imported": "Ventas importadas",
  "estadisticas:updated": "Ventas corregidas",
  "estadisticas:deleted": "Ventas borradas",

  // Negocios y equipo (crear negocio e invitar ya avisan por su cuenta)
  "negocios:updated": "Negocio editado",
  "negocios:deleted": "Negocio borrado",
  "equipo:removed": "Quitó a alguien del equipo",
  "equipo:access_updated": "Cambió permisos del equipo",

  // Merma
  "merma:activated": "Activó el control de merma",
  "merma:deactivated": "Desactivó el control de merma",

  // OCR, exportaciones y descargas
  "ocr:read": "Leyó una foto con OCR",
  "pdf:exported": "Exportó un PDF",
  "respaldo:downloaded": "Descargó un respaldo de su cuenta",
  "manual:downloaded": "Descargó el manual",

  // Cuenta
  "cuenta:wiped": "Borró todo el contenido de su cuenta",
  "cuenta:delete_requested": "Pidió borrar su cuenta",
}

const OCR_KINDS: Record<string, string> = { recipe: "receta", receipt: "factura", inventory: "inventario" }

const PDF_KINDS: Record<string, string> = {
  recipe: "Receta",
  menu: "Menú",
  mep: "MEP",
  cash_up: "Cierre de caja",
  inventory: "Inventario",
  invoice: "Factura",
  purchase_order: "Orden de compra",
  sales_history: "Historial de ventas",
}

function titleOf(module: string, action: string): string | undefined {
  // Object.hasOwn: «constructor» o «toString» no son módulos aunque existan en todo objeto.
  if (action === "entered") return Object.hasOwn(MODULE_NAMES, module) ? `Entró a ${MODULE_NAMES[module]}` : undefined
  const key = `${module}:${action}`
  return Object.hasOwn(TITLES, key) ? TITLES[key] : undefined
}

export function isPushActivity(module: string, action: string): boolean {
  return titleOf(module, action) !== undefined
}

/**
 * Cuántos avisos de cada tipo por persona (y por módulo) como máximo. Lo importante sale
 * siempre; lo que se repite mucho en una sesión (entrar a módulos, editar) se junta.
 */
export function pushLimit(module: string, action: string): { max: number; minutes: number } {
  if (module === "app" || action === "entered") return { max: 1, minutes: 60 }
  if (module === "cuenta" || module === "respaldo" || module === "manual" || action === "imported" || action === "migrated") return { max: 10, minutes: 10 }
  if (action === "updated") return { max: 3, minutes: 30 }
  return { max: 5, minutes: 10 }
}

export function activityPushText(input: {
  module: string
  action: string
  who: string
  /** Nombre del negocio; sin negocio es el dashboard personal. */
  businessName?: string | null
  count?: number | null
  /** Qué fue: nombre de la receta, del ingrediente, del PDF… */
  label?: string | null
  /** Tipo de lectura OCR o de PDF. */
  kind?: string | null
}): { title: string; body: string } {
  let title = titleOf(input.module, input.action) ?? "Actividad"
  if (input.module === "ocr" && input.kind && OCR_KINDS[input.kind]) title = `Leyó una ${OCR_KINDS[input.kind]} con OCR`
  if (input.module === "pdf" && input.kind && PDF_KINDS[input.kind]) title = `Exportó un PDF: ${PDF_KINDS[input.kind]}`
  // Sin negocio: la app, la cuenta, el OCR y las descargas no son de un negocio.
  const accountWide = ["app", "cuenta", "respaldo", "manual", "ocr"].includes(input.module)
  const place = accountWide ? null : input.businessName || "Dashboard personal"
  const amount = input.count && input.count > 1 ? `${input.count} elementos` : null
  const label = input.label?.trim() ? input.label.trim().slice(0, 80) : null
  return { title, body: [input.who, label, place, amount].filter(Boolean).join(" · ") }
}

/** Las cuentas del dueño del proyecto no avisan: serían sus propias pruebas. */
export function isOwnerEmail(email: string | null | undefined, ownerList: string | undefined): boolean {
  if (!email || !ownerList) return false
  return ownerList
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .includes(email.toLowerCase())
}
