/**
 * Buscar una cuenta real por correo y ver/cambiar su plan — el mecanismo detrás de
 * "migrar cuentas de testers a pagadas cuando yo quiera" (ver CLAUDE.md, sección de
 * testers). No mueve ningún dato: los negocios/ingredientes/recetas de un tester ya
 * están permanentemente ligados a su cuenta real de Supabase (owner_id), sin importar
 * el plan — cambiar el plan aquí solo actualiza account_plans.plan_slug, nunca toca
 * businesses/ingredients/recipes. Gateado por la misma cookie de sesión admin que el
 * resto de /admin.
 *
 * No hay un endpoint de Supabase para buscar un usuario por correo exacto en esta
 * versión del SDK, así que listUsers() pagina y filtra en memoria — aceptable para la
 * escala real de este proyecto (dueño + hasta 10 testers, ver TESTER_ALLOWLIST_EMAILS).
 */

import { NextResponse } from "next/server"
import { hasAdminSession } from "@/lib/admin-auth"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { plans } from "@/lib/plans"
import { sendPlanChangedEmail } from "@/lib/services/notify-billing"
import { recordPlanChangeNotice } from "@/lib/services/plan-change-notice"

const FREE_PLAN_SLUG = "foodie"

const VALID_PLAN_SLUGS = plans.map((plan) => plan.slug)

async function findUserByEmail(email: string) {
  const admin = getSupabaseAdminClient()
  const target = email.trim().toLowerCase()
  let page = 1

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error

    const match = data.users.find((u) => u.email?.toLowerCase() === target)
    if (match) return match

    if (data.users.length < 200) return null
    page += 1
  }
}

export async function GET(request: Request) {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 })
  }

  const email = new URL(request.url).searchParams.get("email")?.trim()
  if (!email) {
    return NextResponse.json({ error: "Falta el correo a buscar." }, { status: 400 })
  }

  try {
    const user = await findUserByEmail(email)
    if (!user) {
      return NextResponse.json({ found: false })
    }

    const admin = getSupabaseAdminClient()
    const [planResult, { count: businessCount }] = await Promise.all([
      admin
        .from("account_plans")
        .select("plan_slug, updated_at, stripe_customer_id, plan_expires_at, extra_businesses, extra_team_seats")
        .eq("account_id", user.id)
        .maybeSingle(),
      admin.from("businesses").select("id", { count: "exact", head: true }).eq("owner_id", user.id),
    ])
    // Tolera que supabase/migrations/0008_plan_expiry.sql y/o 0019_account_overrides.sql
    // todavía no se hayan corrido (columnas nuevas, ver docs/59) — sin esto, este panel
    // mostraría "Foodie" para TODAS las cuentas (aunque tengan otro plan real) hasta que
    // alguien las corra.
    let planRow: {
      plan_slug: string
      updated_at: string
      stripe_customer_id: string | null
      plan_expires_at: string | null
      extra_businesses: number
      extra_team_seats: number
    } | null = planResult.data
    if (planResult.error) {
      const fallback = await admin
        .from("account_plans")
        .select("plan_slug, updated_at, stripe_customer_id")
        .eq("account_id", user.id)
        .maybeSingle()
      planRow = fallback.data
        ? { ...fallback.data, plan_expires_at: null, extra_businesses: 0, extra_team_seats: 0 }
        : null
    }

    return NextResponse.json({
      found: true,
      userId: user.id,
      email: user.email,
      createdAt: user.created_at,
      emailConfirmed: Boolean(user.email_confirmed_at),
      planSlug: planRow?.plan_slug || "foodie",
      planUpdatedAt: planRow?.updated_at || null,
      planExpiresAt: planRow?.plan_expires_at || null,
      extraBusinesses: planRow?.extra_businesses || 0,
      extraTeamSeats: planRow?.extra_team_seats || 0,
      hasStripeCustomer: Boolean(planRow?.stripe_customer_id),
      businessCount: businessCount || 0,
    })
  } catch (error) {
    console.error("[api/admin/account-plan] Error buscando la cuenta:", error)
    return NextResponse.json({ error: "No se pudo buscar la cuenta." }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const email = typeof body?.email === "string" ? body.email.trim() : ""
  const planSlug = typeof body?.planSlug === "string" ? body.planSlug.trim() : ""
  // null/undefined = sin vencimiento (permanente, comportamiento de siempre). Cada
  // llamada manda el estado completo del campo de vencimiento — no hay "dejarlo como
  // estaba", el panel de /admin siempre manda lo que se ve en el formulario.
  const expiresAtRaw = body?.expiresAt
  let expiresAt: string | null = null
  if (typeof expiresAtRaw === "string" && expiresAtRaw.trim()) {
    const parsed = new Date(expiresAtRaw)
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json({ error: "Fecha de vencimiento inválida." }, { status: 400 })
    }
    expiresAt = parsed.toISOString()
  }

  // Negocios/cupos de equipo extra otorgados a mano, por encima del límite base del
  // plan (ver supabase/migrations/0019_account_overrides.sql). 0 = sin extra, el
  // comportamiento de siempre. Se redondea y nunca se acepta negativo — "cederle
  // menos que su plan base" no es lo que este control hace, para eso se cambia el
  // plan mismo.
  const extraBusinesses = Math.max(0, Math.floor(Number(body?.extraBusinesses) || 0))
  const extraTeamSeats = Math.max(0, Math.floor(Number(body?.extraTeamSeats) || 0))

  if (!email || !planSlug) {
    return NextResponse.json({ error: "Falta el correo o el plan." }, { status: 400 })
  }
  if (!VALID_PLAN_SLUGS.includes(planSlug)) {
    return NextResponse.json({ error: `Plan "${planSlug}" no existe.` }, { status: 400 })
  }

  try {
    const user = await findUserByEmail(email)
    if (!user) {
      return NextResponse.json({ error: "No existe ninguna cuenta con ese correo." }, { status: 404 })
    }

    const admin = getSupabaseAdminClient()

    // Plan anterior, ANTES de sobreescribirlo — para el popup/correo de "de X a Y"
    // (docs/89). Mismo patrón que ya usa app/api/webhooks/stripe/route.ts.
    const { data: previousRow } = await admin
      .from("account_plans")
      .select("plan_slug")
      .eq("account_id", user.id)
      .maybeSingle()
    const previousPlanSlug = previousRow?.plan_slug || FREE_PLAN_SLUG

    let { data, error } = await admin
      .from("account_plans")
      .upsert({
        account_id: user.id,
        plan_slug: planSlug,
        plan_expires_at: expiresAt,
        extra_businesses: extraBusinesses,
        extra_team_seats: extraTeamSeats,
        updated_at: new Date().toISOString(),
      })
      .select("plan_slug, updated_at, plan_expires_at, extra_businesses, extra_team_seats")
      .single()

    // Tolera que supabase/migrations/0008_plan_expiry.sql y/o
    // 0019_account_overrides.sql todavía no se hayan corrido (columnas nuevas, ver
    // docs/59) — sin esto, aplicar CUALQUIER plan se rompería por completo hasta que
    // alguien las corra a mano. Si pasa esto Y de verdad pidieron algo que necesita
    // esas columnas, se avisa en vez de aplicarlo en silencio como si no tuviera efecto.
    if (error) {
      if (expiresAt || extraBusinesses > 0 || extraTeamSeats > 0) {
        return NextResponse.json(
          {
            error:
              "Falta correr supabase/migrations/0008_plan_expiry.sql y/o 0019_account_overrides.sql antes de poder usar el vencimiento o los extras.",
          },
          { status: 409 },
        )
      }
      const fallback = await admin
        .from("account_plans")
        .upsert({ account_id: user.id, plan_slug: planSlug, updated_at: new Date().toISOString() })
        .select("plan_slug, updated_at")
        .single()
      data = fallback.data ? { ...fallback.data, plan_expires_at: null, extra_businesses: 0, extra_team_seats: 0 } : null
      error = fallback.error
    }

    if (error || !data) throw error || new Error("No se pudo guardar el plan.")

    // Popup en el dashboard + correo, igual que un cambio real por Stripe — pero sin
    // cobro (bypasa Stripe por completo) y con la fecha de vencimiento en vez de
    // "próximo cobro" cuando el admin puso una (docs/89). Best-effort: el plan ya
    // quedó aplicado arriba sin importar si esto falla.
    const expiresAtUnixSeconds = expiresAt ? Math.floor(new Date(expiresAt).getTime() / 1000) : null
    try {
      await sendPlanChangedEmail({
        accountId: user.id,
        fromPlanSlug: previousPlanSlug,
        toPlanSlug: planSlug,
        nextChargeUnixSeconds: null,
        nextChargeAmountCents: null,
        expiresAtUnixSeconds,
        source: "admin",
      })
    } catch (emailError) {
      console.error("[api/admin/account-plan] Error mandando el correo de cambio de plan:", emailError)
    }
    await recordPlanChangeNotice({
      accountId: user.id,
      fromPlanSlug: previousPlanSlug,
      toPlanSlug: planSlug,
      amountCents: null,
      nextChargeUnixSeconds: null,
      expiresAtUnixSeconds,
      source: "admin",
    })

    return NextResponse.json({
      ok: true,
      email: user.email,
      planSlug: data.plan_slug,
      updatedAt: data.updated_at,
      planExpiresAt: data.plan_expires_at,
      extraBusinesses: data.extra_businesses || 0,
      extraTeamSeats: data.extra_team_seats || 0,
    })
  } catch (error) {
    console.error("[api/admin/account-plan] Error cambiando el plan:", error)
    return NextResponse.json({ error: "No se pudo cambiar el plan." }, { status: 500 })
  }
}
