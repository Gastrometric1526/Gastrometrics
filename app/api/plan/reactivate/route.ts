/**
 * «Mantener mi suscripción» (docs/236): deshace una cancelación que todavía no se cumplió.
 * Quita cancel_at_period_end de la MISMA suscripción de Stripe: sigue renovándose en la misma
 * fecha y por el mismo precio, sin crear una segunda suscripción ni cobrar nada hoy. El webhook
 * customer.subscription.updated deja account_plans al día; aquí también se escribe para que
 * Mi Plan lo muestre enseguida.
 */

import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { getStripeClient, isStripeConfigured } from "@/lib/stripe/client"

export async function POST() {
  if (!isStripeConfigured()) return NextResponse.json({ error: "Stripe no está configurado." }, { status: 503 })
  const {
    data: { user },
  } = await getSupabaseServerClient().auth.getUser()
  if (!user) return NextResponse.json({ error: "Debes iniciar sesión para continuar." }, { status: 401 })

  const admin = getSupabaseAdminClient()
  const { data: accountPlan } = await admin
    .from("account_plans")
    .select("stripe_subscription_id")
    .eq("account_id", user.id)
    .maybeSingle()
  if (!accountPlan?.stripe_subscription_id) {
    return NextResponse.json({ error: "No tienes una suscripción para mantener." }, { status: 404 })
  }

  try {
    const stripe = getStripeClient()
    const subscription = await stripe.subscriptions.retrieve(accountPlan.stripe_subscription_id)
    // Ya terminó: no hay nada que reactivar; se contrata de nuevo desde los planes.
    if (!["active", "trialing", "past_due"].includes(subscription.status)) {
      return NextResponse.json({ error: "Tu suscripción ya terminó. Elige un plan para volver a contratar." }, { status: 409 })
    }
    if (subscription.cancel_at_period_end) {
      await stripe.subscriptions.update(subscription.id, { cancel_at_period_end: false })
    }
    await admin.from("account_plans").update({ cancel_at_period_end: false }).eq("account_id", user.id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[api/plan/reactivate] Error reactivando la suscripción:", error)
    return NextResponse.json({ error: "No se pudo mantener la suscripción." }, { status: 500 })
  }
}
