/**
 * Estado del plan para el indicador del menú lateral y la ventana de vencimiento
 * (docs/165), y cancelación del pago programado.
 *
 * GET: plan actual, vencimiento y pago programado. De paso revisa en Stripe si el pago
 * programado ya se cobró y, solo entonces, aplica el plan (lib/services/scheduled-renewal.ts).
 * DELETE: cancela el pago programado (la suscripción en prueba de Stripe).
 */

import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { verifyScheduledRenewal, cancelScheduledRenewal } from "@/lib/services/scheduled-renewal"

export const dynamic = "force-dynamic"

async function currentUserId(): Promise<string | null> {
  const {
    data: { user },
  } = await getSupabaseServerClient().auth.getUser()
  return user?.id ?? null
}

export async function GET() {
  const userId = await currentUserId()
  if (!userId) return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 })

  try {
    const renewal = await verifyScheduledRenewal(userId)
    const { data: planRow } = await getSupabaseAdminClient()
      .from("account_plans")
      .select("plan_slug, plan_expires_at, stripe_subscription_id")
      .eq("account_id", userId)
      .maybeSingle()

    return NextResponse.json({
      planSlug: planRow?.plan_slug || "foodie",
      planExpiresAt: planRow?.plan_expires_at ?? null,
      hasSubscription: Boolean(planRow?.stripe_subscription_id),
      renewal:
        renewal.status === "scheduled" || renewal.status === "payment_failed"
          ? { status: renewal.status, planSlug: renewal.renewal.planSlug, startsAt: renewal.renewal.startsAt }
          : null,
      justApplied: renewal.status === "applied" ? renewal.planSlug : null,
    })
  } catch (error) {
    console.error("[api/plan/renewal GET] Error:", error)
    return NextResponse.json({ error: "No se pudo leer el plan." }, { status: 500 })
  }
}

export async function DELETE() {
  const userId = await currentUserId()
  if (!userId) return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 })
  try {
    await cancelScheduledRenewal(userId)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[api/plan/renewal DELETE] Error:", error)
    return NextResponse.json({ error: "No se pudo cancelar el pago programado." }, { status: 500 })
  }
}
