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
    const [{ data: planRow }, { count: businessCount }] = await Promise.all([
      admin.from("account_plans").select("plan_slug, updated_at, stripe_customer_id").eq("account_id", user.id).maybeSingle(),
      admin.from("businesses").select("id", { count: "exact", head: true }).eq("owner_id", user.id),
    ])

    return NextResponse.json({
      found: true,
      userId: user.id,
      email: user.email,
      createdAt: user.created_at,
      emailConfirmed: Boolean(user.email_confirmed_at),
      planSlug: planRow?.plan_slug || "foodie",
      planUpdatedAt: planRow?.updated_at || null,
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
    const { data, error } = await admin
      .from("account_plans")
      .upsert({ account_id: user.id, plan_slug: planSlug, updated_at: new Date().toISOString() })
      .select("plan_slug, updated_at")
      .single()

    if (error) throw error

    return NextResponse.json({ ok: true, email: user.email, planSlug: data.plan_slug, updatedAt: data.updated_at })
  } catch (error) {
    console.error("[api/admin/account-plan] Error cambiando el plan:", error)
    return NextResponse.json({ error: "No se pudo cambiar el plan." }, { status: 500 })
  }
}
