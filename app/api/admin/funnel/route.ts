/**
 * /admin → Crecimiento → Embudo (docs/275): de la cuenta nueva a la renovación, y el
 * resultado real de la invitación a volver a un módulo. Solo lee lo que ya se guarda
 * (cuentas confirmadas, ingredientes, recetas con costo, activity_log, planes y cobros de
 * Stripe); el cálculo es puro, en lib/admin/funnel.ts.
 */

import { NextResponse } from "next/server"
import { hasAdminSession } from "@/lib/admin-auth"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { selectAll } from "@/lib/admin/select-all"
import { fetchAllPages } from "@/lib/services/notify-reengagement"
import { loadAdminMetricAccounts } from "@/lib/admin-metric-accounts"
import { getStripeClient, isStripeConfigured } from "@/lib/stripe/client"
import { summarizeFunnel, summarizeNudges, type FunnelAccount, type NudgeEvent } from "@/lib/admin/funnel"

export const dynamic = "force-dynamic"

const PASSIVE = new Set(["entered", "read", "nudge_shown", "nudge_opened"])

export async function GET(request: Request) {
  if (!(await hasAdminSession())) return NextResponse.json({ error: "No autorizado." }, { status: 401 })
  const url = new URL(request.url)
  const sinceParam = url.searchParams.get("since")
  const sinceDays = sinceParam && sinceParam !== "all" ? Number(sinceParam) || null : null

  try {
    const admin = getSupabaseAdminClient()
    const accounts = await loadAdminMetricAccounts(admin)

    const ingredients = await fetchAllPages<{ owner_id: string; created_at: string }>((from, to) =>
      admin.from("ingredients").select("owner_id, created_at").order("created_at").range(from, to),
    )
    const firstIngredientAt = new Map<string, string>()
    for (const r of ingredients) if (!firstIngredientAt.has(r.owner_id)) firstIngredientAt.set(r.owner_id, r.created_at)

    const { data: activity, error: activityError } = await selectAll<{ user_id: string; module: string; action: string; created_at: string }>((from, to) =>
      admin.from("activity_log").select("user_id, module, action, created_at").order("created_at").order("id").range(from, to),
    )
    if (activityError) throw activityError
    const activeDays = new Map<string, Set<string>>()
    const nudgeEvents: NudgeEvent[] = []
    const actions: { userId: string; module: string; at: string }[] = []
    for (const row of activity ?? []) {
      const set = activeDays.get(row.user_id) ?? activeDays.set(row.user_id, new Set()).get(row.user_id)!
      set.add(row.created_at.slice(0, 10))
      if (row.action === "nudge_shown" || row.action === "nudge_opened") {
        nudgeEvents.push({ userId: row.user_id, module: row.module, action: row.action, at: row.created_at })
      } else if (!PASSIVE.has(row.action)) {
        actions.push({ userId: row.user_id, module: row.module, at: row.created_at })
      }
    }

    // Renovó = la suscripción tiene 2 o más facturas pagadas con importe (docs/242: mirar `total`).
    const renewed = new Set<string>()
    let stripeChecked = false
    if (isStripeConfigured()) {
      const { data: plans, error: plansError } = await selectAll<{ account_id: string; stripe_subscription_id: string | null }>((from, to) =>
        admin.from("account_plans").select("account_id, stripe_subscription_id").order("account_id").range(from, to),
      )
      if (plansError) throw plansError
      const stripe = getStripeClient()
      const paying = new Set(accounts.filter((a) => a.paying).map((a) => a.id))
      for (const p of plans ?? []) {
        if (!p.stripe_subscription_id || !paying.has(p.account_id)) continue
        const invoices = await stripe.invoices.list({ subscription: p.stripe_subscription_id, status: "paid", limit: 10 })
        if (invoices.data.filter((inv) => (inv.total ?? 0) > 0).length >= 2) renewed.add(p.account_id)
      }
      stripeChecked = true
    }

    const funnelAccounts: FunnelAccount[] = accounts.map((a) => ({
      id: a.id,
      createdAt: a.createdAt,
      firstIngredientAt: firstIngredientAt.get(a.id) ?? null,
      firstCostAt: a.firstCostAt,
      activeDays: [...(activeDays.get(a.id) ?? [])],
      paying: a.paying,
      renewed: renewed.has(a.id),
    }))

    return NextResponse.json({
      funnel: summarizeFunnel(funnelAccounts, { sinceDays }),
      nudges: summarizeNudges(nudgeEvents, actions),
      stripeChecked,
      sinceDays,
    })
  } catch (error) {
    console.error("[api/admin/funnel] Error calculando el embudo:", error)
    return NextResponse.json({ error: "No se pudo calcular el embudo." }, { status: 500 })
  }
}
