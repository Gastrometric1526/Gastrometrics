/**
 * Medición de clics en los correos (docs/145) — pedido del dueño: "alguna forma de
 * confirmar que los correos funcionan, medir quién entró por uno de los correos".
 *
 * Cada botón de los correos automáticos lleva `utm_source=email&utm_campaign=<tipo>`.
 * Al abrir la app, components/email-click-tracker.tsx lee esos parámetros y los manda a
 * /api/track-email-click, que los guarda en engagement_emails_sent con
 * email_type = "click:<tipo>" (tabla sin check de tipo, migración 0033 — no hace falta
 * otra migración). Esas filas NO cuentan como envíos para las pausas entre correos
 * (isClickRow). /admin → Analíticas → "Clics desde correos" cruza envíos y clics.
 */

export const CLICK_PREFIX = "click:"

export function isClickRow(emailType: string | null | undefined): boolean {
  return typeof emailType === "string" && emailType.startsWith(CLICK_PREFIX)
}

/** Agrega los parámetros de seguimiento a un enlace de correo (absoluto o relativo). */
export function withEmailTracking(url: string, campaign: string): string {
  try {
    const u = new URL(url, "https://placeholder.local")
    u.searchParams.set("utm_source", "email")
    u.searchParams.set("utm_medium", "email")
    u.searchParams.set("utm_campaign", campaign)
    return url.startsWith("http") ? u.toString() : `${u.pathname}${u.search}${u.hash}`
  } catch {
    return url
  }
}

/** Solo letras, números, guion bajo y guion: lo que llega del navegador no se confía. */
export function sanitizeCampaign(value: unknown): string | null {
  if (typeof value !== "string") return null
  const clean = value.trim().slice(0, 60)
  return /^[a-z0-9_-]+$/i.test(clean) ? clean : null
}
