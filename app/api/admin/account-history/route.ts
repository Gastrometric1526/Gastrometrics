/**
 * Historial de cuentas (docs/197), solo lectura: cuentas actuales, pedidos de borrado,
 * cambios de plan (activity_log), cuentas ya borradas (registro sin datos personales,
 * lib/admin/account-ledger.ts) y suscripciones de Stripe. El cálculo vive en
 * lib/admin/account-history.ts. Stripe se guarda 5 minutos por instancia.
 */

import { NextResponse } from "next/server"
import { hasAdminSession } from "@/lib/admin-auth"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { getStripeClient, isStripeConfigured } from "@/lib/stripe/client"
import { selectAll } from "@/lib/admin/select-all"
import { ACCOUNT_PURGED_EVENT, decodePurgedRecord } from "@/lib/admin/account-ledger"
import { buildAccountHistory, type HistoryInput } from "@/lib/admin/account-history"

export const dynamic = "force-dynamic"

const FIVE_MINUTES = 5 * 60 * 1000
let stripeCache: { at: number; subs: HistoryInput["subscriptions"] } | null = null

const iso = (sec: number | null | undefined) => (typeof sec === "number" ? new Date(sec * 1000).toISOString() : null)

async function loadSubscriptions(): Promise<HistoryInput["subscriptions"]> {
  if (!isStripeConfigured()) return []
  if (stripeCache && Date.now() - stripeCache.at < FIVE_MINUTES) return stripeCache.subs
  const subs: HistoryInput["subscriptions"] = []
  for await (const sub of getStripeClient().subscriptions.list({ status: "all", limit: 100, expand: ["data.customer"] })) {
    const customer = sub.customer as { email?: string | null } | string
    subs.push({
      email: typeof customer === "object" ? customer.email ?? null : null,
      planSlug: (sub.metadata?.planSlug as string | undefined) || null,
      status: sub.status,
      createdAt: iso(sub.created) || new Date().toISOString(),
      canceledAt: iso(sub.canceled_at),
      cancelAt: iso(sub.cancel_at),
      cancelAtPeriodEnd: !!sub.cancel_at_period_end,
    })
    if (subs.length >= 3000) break
  }
  stripeCache = { at: Date.now(), subs }
  return subs
}

export async function GET() {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 })
  }
  try {
    const admin = getSupabaseAdminClient()

    const users: HistoryInput["users"] = []
    for (let page = 1; ; page += 1) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
      if (error) throw error
      users.push(...data.users.map((u) => ({ id: u.id, email: u.email || "", createdAt: u.created_at })))
      if (data.users.length < 200) break
    }

    const [plans, deletion, planLog, purgedRows, subscriptions] = await Promise.all([
      selectAll<{ account_id: string; plan_slug: string }>((from, to) => admin.from("account_plans").select("account_id, plan_slug").order("account_id").range(from, to)),
      selectAll<{ id: string; deletion_requested_at: string }>((from, to) =>
        admin.from("profiles").select("id, deletion_requested_at").not("deletion_requested_at", "is", null).order("id").range(from, to),
      ),
      selectAll<{ user_id: string; created_at: string; entity_label: string | null; metadata: Record<string, unknown> | null }>((from, to) =>
        admin.from("activity_log").select("user_id, created_at, entity_label, metadata").eq("module", "plan").eq("action", "plan_changed").order("id").range(from, to),
      ),
      selectAll<{ business_id: string | null; created_at: string }>((from, to) =>
        admin.from("product_events").select("business_id, created_at").eq("event_name", ACCOUNT_PURGED_EVENT).order("id").range(from, to),
      ),
      loadSubscriptions().catch((error) => {
        console.error("[api/admin/account-history] Stripe:", error)
        return [] as HistoryInput["subscriptions"]
      }),
    ])

    const input: HistoryInput = {
      users,
      plans: (plans.data ?? []).map((p) => ({ accountId: p.account_id, planSlug: p.plan_slug })),
      deletionRequests: (deletion.data ?? []).map((d) => ({ id: d.id, requestedAt: d.deletion_requested_at })),
      planChanges: (planLog.data ?? []).map((r) => ({
        userId: r.user_id,
        at: r.created_at,
        from: (r.metadata?.from as string | undefined) ?? null,
        to: (r.metadata?.to as string | undefined) ?? r.entity_label ?? null,
        source: (r.metadata?.source as string | undefined) ?? null,
      })),
      purged: (purgedRows.data ?? []).map((r) => decodePurgedRecord(r.business_id, r.created_at)),
      subscriptions,
    }
    return NextResponse.json({ ...buildAccountHistory(input), stripe: isStripeConfigured() })
  } catch (error) {
    console.error("[api/admin/account-history] Error:", error)
    return NextResponse.json({ error: "No se pudo armar el historial." }, { status: 500 })
  }
}
