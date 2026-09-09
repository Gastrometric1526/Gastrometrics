/**
 * Aviso de cambio de plan pendiente de mostrar como popup en el dashboard (docs/89).
 * GET: la sesión actual pregunta si tiene un cambio sin confirmar (account_plans.
 * last_change_acknowledged=false, ver supabase/migrations/0018_plan_change_notice.sql
 * y lib/services/plan-change-notice.ts, que es quien escribe estas columnas).
 * POST: marca el aviso actual como confirmado, para que no vuelva a aparecer.
 *
 * Por qué es una ruta de servidor: account_plans no es escribible por el cliente
 * (RLS, ver 0004_account_plans.sql) — la sesión real (cookie httpOnly) es la única
 * forma de saber de quién es el aviso a leer/apagar.
 */

import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"

export async function GET() {
  const supabase = getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ notice: null })

  const admin = getSupabaseAdminClient()
  const { data, error } = await admin
    .from("account_plans")
    .select(
      "last_change_from_plan, last_change_to_plan, last_change_amount_cents, last_change_next_charge_at, last_change_expires_at, last_change_source, last_change_acknowledged",
    )
    .eq("account_id", user.id)
    .maybeSingle()

  // Tolera que supabase/migrations/0018_plan_change_notice.sql todavía no se haya
  // corrido (columnas nuevas) — sin esto, cualquier carga del dashboard rompería en
  // vez de simplemente no mostrar ningún aviso.
  if (error || !data || data.last_change_acknowledged || !data.last_change_from_plan || !data.last_change_to_plan) {
    return NextResponse.json({ notice: null })
  }

  return NextResponse.json({
    notice: {
      fromPlanSlug: data.last_change_from_plan,
      toPlanSlug: data.last_change_to_plan,
      amountCents: data.last_change_amount_cents,
      nextChargeAt: data.last_change_next_charge_at,
      expiresAt: data.last_change_expires_at,
      source: data.last_change_source,
    },
  })
}

export async function POST() {
  const supabase = getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false }, { status: 401 })

  const admin = getSupabaseAdminClient()
  const { error } = await admin
    .from("account_plans")
    .update({ last_change_acknowledged: true })
    .eq("account_id", user.id)

  if (error) {
    console.error("[api/plan/change-notice] Error confirmando el aviso:", error)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
