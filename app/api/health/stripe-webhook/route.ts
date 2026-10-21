import { NextResponse } from "next/server"
import { checkStripeWebhook, type WebhookHealthResult } from "@/lib/services/stripe-webhook-health"

// Estado del webhook de Stripe (docs/176), solo lectura: dirección, eventos y qué le falta.
// No expone secretos ni cambia nada. Como mucho una consulta a Stripe cada 10 minutos por
// instancia.

export const dynamic = "force-dynamic"

const TEN_MINUTES = 10 * 60 * 1000
let last: { at: number; result: WebhookHealthResult } | null = null

export async function GET() {
  try {
    if (!last || Date.now() - last.at > TEN_MINUTES) {
      last = { at: Date.now(), result: await checkStripeWebhook() }
    }
    return NextResponse.json({ ok: true, checkedAt: new Date(last.at).toISOString(), ...last.result })
  } catch (error) {
    console.error("[api/health/stripe-webhook]", error)
    return NextResponse.json({ ok: false, error: "No se pudo revisar el webhook." }, { status: 500 })
  }
}
