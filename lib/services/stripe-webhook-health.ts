/**
 * Revisión automática del webhook de Stripe (docs/176).
 *
 * Stripe no sigue redirecciones: si el webhook apunta a una dirección que Vercel redirige
 * (hoy gastrometrics.org → www, 308), cada evento cuenta como fallido y la app no se entera
 * de cancelaciones, tarjetas que fallan ni pagos programados. Esto revisa, con la llave del
 * propio servidor y SOLO LEYENDO, los endpoints de este sitio y dice qué habría que cambiar:
 *  - si su dirección redirige, cuál es la dirección final;
 *  - qué eventos que la app procesa le faltan.
 * El cambio lo hace el dueño en el panel de Stripe (cambiar la dirección no cambia el
 * secreto de firma). Se consulta en /api/health/stripe-webhook.
 */

import { getStripeClient, isStripeConfigured } from "@/lib/stripe/client"

export const WEBHOOK_PATH = "/api/webhooks/stripe"

/** Los eventos que procesa app/api/webhooks/stripe/route.ts. */
export const REQUIRED_WEBHOOK_EVENTS = [
  "checkout.session.completed",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
] as const

const SITE_HOSTS = ["gastrometrics.org", "www.gastrometrics.org"]

export interface WebhookEndpointLike {
  url: string
  enabled_events: string[]
}

export interface WebhookFix {
  url?: string
  enabled_events?: string[]
}

/** ¿Es un endpoint de este sitio (y no otro proyecto en la misma cuenta de Stripe)? */
export function isSiteWebhook(url: string): boolean {
  try {
    const parsed = new URL(url)
    return SITE_HOSTS.includes(parsed.hostname) && parsed.pathname.replace(/\/+$/, "") === WEBHOOK_PATH
  } catch {
    return false
  }
}

/** Puro: qué hay que cambiarle a un endpoint, o null si ya está bien. */
export function planWebhookFix(endpoint: WebhookEndpointLike, servingOrigin: string): WebhookFix | null {
  const fix: WebhookFix = {}
  const target = `${servingOrigin.replace(/\/+$/, "")}${WEBHOOK_PATH}`
  if (endpoint.url !== target && SITE_HOSTS.includes(new URL(target).hostname)) fix.url = target

  const events = endpoint.enabled_events
  if (!events.includes("*")) {
    const missing = REQUIRED_WEBHOOK_EVENTS.filter((e) => !events.includes(e))
    if (missing.length > 0) fix.enabled_events = [...events, ...missing]
  }
  return fix.url || fix.enabled_events ? fix : null
}

/** Dónde responde de verdad una dirección: si redirige, el origen del destino. */
async function resolveServingOrigin(url: string): Promise<string> {
  const origin = new URL(url).origin
  try {
    const res = await fetch(`${origin}${WEBHOOK_PATH}`, { method: "POST", redirect: "manual", cache: "no-store" })
    const location = res.headers.get("location")
    if (res.status >= 300 && res.status < 400 && location) return new URL(location, origin).origin
  } catch (error) {
    console.error("[stripe-webhook-health] No se pudo comprobar la dirección:", error)
  }
  return origin
}

export interface WebhookHealthResult {
  configured: boolean
  livemode: boolean | null
  healthy: boolean
  endpoints: { url: string; events: string[]; status: string; needs: WebhookFix | null }[]
}

export async function checkStripeWebhook(): Promise<WebhookHealthResult> {
  if (!isStripeConfigured()) return { configured: false, livemode: null, healthy: false, endpoints: [] }

  const list = await getStripeClient().webhookEndpoints.list({ limit: 100 })
  const result: WebhookHealthResult = { configured: true, livemode: null, healthy: false, endpoints: [] }

  for (const endpoint of list.data) {
    if (!isSiteWebhook(endpoint.url)) continue
    result.livemode = endpoint.livemode
    const needs = planWebhookFix(endpoint, await resolveServingOrigin(endpoint.url))
    result.endpoints.push({ url: endpoint.url, events: endpoint.enabled_events, status: endpoint.status, needs })
  }
  result.healthy = result.endpoints.some((e) => e.status === "enabled" && e.needs === null)
  return result
}
