/**
 * Vista previa de un cambio entre planes pagos (docs/236), ANTES de confirmarlo: cuánto se
 * cobra hoy, si queda saldo a favor y cuándo y cuánto es el siguiente cobro. Le pregunta a
 * Stripe con la misma configuración que usa /api/checkout para el cambio real
 * (proration_behavior "always_invoice"), así que el monto que se muestra es el que se cobra.
 * No cobra ni cambia nada.
 *
 * Responde { change: null } si la cuenta no tiene una suscripción activa (será un alta nueva
 * por Checkout, donde Stripe ya muestra el precio completo).
 */

import { NextResponse } from "next/server"
import { getStripeClient, isStripeConfigured, getOrCreateSubscriptionProductId } from "@/lib/stripe/client"
import { getPlanBySlug, getTeamInviteLimit } from "@/lib/plans"
import { planExcess } from "@/lib/stripe/subscription-rules"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  if (!isStripeConfigured()) return NextResponse.json({ change: null })
  const {
    data: { user },
  } = await getSupabaseServerClient().auth.getUser()
  if (!user) return NextResponse.json({ error: "Debes iniciar sesión para continuar." }, { status: 401 })

  const body = await request.json().catch(() => null)
  const plan = getPlanBySlug(body?.planSlug)
  if (!plan || plan.slug !== body?.planSlug || plan.priceUsdCents <= 0) {
    return NextResponse.json({ error: "Plan no válido." }, { status: 400 })
  }

  try {
    const { data: accountPlan } = await getSupabaseAdminClient()
      .from("account_plans")
      .select("plan_slug, stripe_subscription_id, extra_businesses, extra_team_seats")
      .eq("account_id", user.id)
      .maybeSingle()
    if (!accountPlan?.stripe_subscription_id) return NextResponse.json({ change: null })

    const stripe = getStripeClient()
    const subscription = await stripe.subscriptions.retrieve(accountPlan.stripe_subscription_id)
    const item = subscription.items.data[0]
    if (!["active", "trialing", "past_due"].includes(subscription.status) || !item) return NextResponse.json({ change: null })

    const productId = await getOrCreateSubscriptionProductId()
    const preview = await stripe.invoices.createPreview({
      customer: typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id,
      subscription: subscription.id,
      subscription_details: {
        items: [{ id: item.id, price_data: { currency: "usd", product: productId, unit_amount: plan.priceUsdCents, recurring: { interval: "month" } } }],
        proration_behavior: "always_invoice",
      },
    })

    const admin = getSupabaseAdminClient()
    const [businesses, team] = await Promise.all([
      admin.from("businesses").select("id", { count: "exact", head: true }).eq("owner_id", user.id),
      admin.from("team_members").select("id", { count: "exact", head: true }).eq("owner_id", user.id),
    ])

    const periodEnd = (item as { current_period_end?: number }).current_period_end ?? null
    return NextResponse.json({
      change: {
        fromPlanSlug: accountPlan.plan_slug,
        toPlanSlug: plan.slug,
        // Lo que se cobra hoy a la tarjeta (0 si el cambio deja saldo a favor).
        dueTodayCents: Math.max(preview.amount_due ?? 0, 0),
        // Saldo a favor que deja una bajada de plan: se descuenta de los cobros siguientes.
        creditCents: Math.max(-(preview.total ?? 0), 0),
        currency: preview.currency || "usd",
        nextChargeAt: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
        nextChargeCents: plan.priceUsdCents,
        // Un cambio de plan reactiva una suscripción que estaba por terminar (docs/236).
        wasCancelling: Boolean(subscription.cancel_at_period_end),
        // Lo que supera el plan nuevo (docs/242): se conserva, solo no se puede agregar más.
        excess: planExcess({
          businesses: businesses.count ?? 0,
          maxBusinesses: plan.maxBusinesses + (accountPlan.extra_businesses || 0),
          teamMembers: team.count ?? 0,
          maxTeamMembers: getTeamInviteLimit(plan, accountPlan.extra_team_seats || 0),
        }),
      },
    })
  } catch (error) {
    console.error("[api/checkout/preview] Error pidiendo la vista previa a Stripe:", error)
    return NextResponse.json({ error: "No se pudo calcular el cambio." }, { status: 500 })
  }
}
