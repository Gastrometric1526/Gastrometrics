/**
 * Avisos de actividad para los aparatos de /admin (docs/248). Puro: decide qué acciones
 * avisan y arma el texto. Negocio nuevo, invitación y cuenta nueva no están aquí porque ya
 * avisan por su cuenta (notify-owner.ts, notify-signup.ts).
 *
 * Un ingrediente suelto no avisa: se crean decenas en una sesión y taparían lo importante.
 */

const TITLES: Record<string, string> = {
  "app:opened": "Entró a la app",
  "recetas:created": "Receta creada",
  "recetas:imported": "Receta importada",
  "ingredientes:imported": "Ingredientes importados",
  "inventario:imported": "Inventario importado",
  "menus:created": "Menú creado",
  "ordenes_compra:created": "Orden de compra creada",
  "ordenes_compra:imported": "Órdenes de compra importadas",
  "estadisticas:imported": "Ventas importadas",
}

export function isPushActivity(module: string, action: string): boolean {
  return `${module}:${action}` in TITLES
}

export function activityPushText(input: {
  module: string
  action: string
  who: string
  /** Nombre del negocio; sin negocio es el dashboard personal. */
  businessName?: string | null
  count?: number | null
}): { title: string; body: string } {
  const title = TITLES[`${input.module}:${input.action}`]
  if (input.module === "app") return { title, body: input.who }
  const place = input.businessName || "Dashboard personal"
  const amount = input.count && input.count > 1 ? `${input.count} elementos` : null
  return { title, body: [input.who, place, amount].filter(Boolean).join(" · ") }
}

/** Las cuentas del dueño del proyecto no avisan: serían sus propias pruebas. */
export function isOwnerEmail(email: string | null | undefined, ownerList: string | undefined): boolean {
  if (!email || !ownerList) return false
  return ownerList
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .includes(email.toLowerCase())
}
