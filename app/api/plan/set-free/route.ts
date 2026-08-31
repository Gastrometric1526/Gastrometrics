/**
 * Aplica un plan GRATIS (priceUsdCents === 0) a la cuenta que hace la petición.
 * Existe para que el cliente pueda "elegir el plan gratuito" (registro sin pagar,
 * botón "Omitir por ahora", bajar de plan desde /planes) sin poder escribir
 * directamente en account_plans (ver RLS en supabase/migrations/0004_account_plans.sql)
 * — un downgrade a gratis nunca es un problema de seguridad, así que no hace falta
 * verificarlo contra Stripe como sí se hace con los planes pagos
 * (app/api/checkout/session/route.ts), pero igual pasa por el servidor para que
 * account_plans en Supabase (la fuente de verdad real) quede consistente, no solo el
 * caché local del navegador.
 */

import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { getPlanBySlug } from "@/lib/plans"
import { getStripeClient, isStripeConfigured } from "@/lib/stripe/client"

export async function POST(request: Request) {
  const supabase = getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Debes iniciar sesión para continuar." }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const planSlug = body?.planSlug as string | undefined
  const plan = getPlanBySlug(planSlug)

  if (!planSlug || plan.slug !== planSlug || plan.priceUsdCents > 0) {
    return NextResponse.json({ error: `"${planSlug}" no es un plan gratuito válido.` }, { status: 400 })
  }

  const admin = getSupabaseAdminClient()

  // BUG CORREGIDO (ver docs/76): esto nunca cancelaba la suscripción real de
  // Stripe — solo cambiaba plan_slug acá. Alguien con un plan pago activo que
  // volviera a "gratis" desde /planes (o le diera "Omitir por ahora" en el pago)
  // seguía siendo cobrado cada mes por Stripe en segundo plano, mientras la app le
  // mostraba "Foodie" sin ningún aviso. Se cancela primero la suscripción real (si
  // existe una activa) — si eso falla, se aborta el downgrade completo en vez de
  // dejar a la cuenta mostrando gratis mientras Stripe le sigue cobrando en
  // silencio (mismo criterio que el borrado de cuenta desde /admin, ver docs/71).
  const { data: existingPlan } = await admin
    .from("account_plans")
    .select("stripe_subscription_id")
    .eq("account_id", user.id)
    .maybeSingle()

  if (existingPlan?.stripe_subscription_id && isStripeConfigured()) {
    try {
      await getStripeClient().subscriptions.cancel(existingPlan.stripe_subscription_id)
    } catch (stripeError: any) {
      // "resource_missing" = ya no existe en Stripe (canceló por otro lado, o el id
      // quedó viejo) — no es un motivo real para bloquear el downgrade.
      if (stripeError?.code !== "resource_missing") {
        console.error("[api/plan/set-free] Error cancelando la suscripción de Stripe:", stripeError)
        return NextResponse.json(
          { error: "No se pudo cancelar tu suscripción activa. Intenta de nuevo o hazlo desde el Portal de Cliente en Mi Plan." },
          { status: 500 },
        )
      }
    }
  }

  const { error } = await admin.from("account_plans").upsert({
    account_id: user.id,
    plan_slug: plan.slug,
    stripe_subscription_id: null,
    updated_at: new Date().toISOString(),
  })

  if (error) {
    console.error("[api/plan/set-free] Error guardando el plan:", error)
    return NextResponse.json({ error: "No se pudo guardar el plan." }, { status: 500 })
  }

  return NextResponse.json({ planSlug: plan.slug })
}
