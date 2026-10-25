/**
 * Historial de cuentas para /admin → Cuentas → Historial (docs/197): una sola línea de tiempo
 * con altas, cambios de plan, pedidos de borrado (y cuándo se borra de verdad), cuentas ya
 * borradas, cancelaciones y cobros atrasados de Stripe. Función pura sobre datos ya leídos
 * (app/api/admin/account-history/route.ts), para poder probarla.
 */

import type { PurgedAccountRecord } from "@/lib/admin/account-ledger"

export type HistoryEventType =
  | "created"
  | "plan_changed"
  | "deletion_requested"
  | "purged"
  | "subscription_canceled"
  | "cancel_scheduled"
  | "payment_overdue"

export interface HistoryEvent {
  at: string
  type: HistoryEventType
  email: string | null // null en cuentas ya borradas (no se guarda el correo)
  plan: string | null
  fromPlan?: string | null
  toPlan?: string | null
  source?: string | null
  dueAt?: string | null // pedido de borrado: cuándo se borra de verdad; cancelación programada: cuándo termina
  createdAt?: string | null // cuentas borradas: cuándo se habían creado
  country?: string | null
}

export interface HistoryInput {
  users: { id: string; email: string; createdAt: string }[]
  plans: { accountId: string; planSlug: string }[]
  deletionRequests: { id: string; requestedAt: string }[]
  planChanges: { userId: string; at: string; from: string | null; to: string | null; source: string | null }[]
  purged: PurgedAccountRecord[]
  subscriptions: { email: string | null; planSlug: string | null; status: string; createdAt: string; canceledAt: string | null; cancelAt: string | null; cancelAtPeriodEnd: boolean }[]
}

export interface HistorySummary {
  activeAccounts: number
  created30d: number
  deletionPending: number
  purgedTotal: number
  purged30d: number
  canceledTotal: number
  canceled30d: number
  cancelScheduled: number
  planChanges30d: number
  overdue: number
}

const GRACE_DAYS = 30
const DAY = 24 * 60 * 60 * 1000

export function buildAccountHistory(input: HistoryInput, now = Date.now()): { events: HistoryEvent[]; summary: HistorySummary } {
  const emailById = new Map(input.users.map((u) => [u.id, u.email]))
  const planById = new Map(input.plans.map((p) => [p.accountId, p.planSlug]))
  const plan = (id: string) => planById.get(id) || "foodie"
  const events: HistoryEvent[] = []

  for (const u of input.users) events.push({ at: u.createdAt, type: "created", email: u.email, plan: plan(u.id) })

  for (const c of input.planChanges)
    events.push({ at: c.at, type: "plan_changed", email: emailById.get(c.userId) ?? null, plan: c.to, fromPlan: c.from, toPlan: c.to, source: c.source })

  for (const d of input.deletionRequests)
    events.push({
      at: d.requestedAt,
      type: "deletion_requested",
      email: emailById.get(d.id) ?? null,
      plan: plan(d.id),
      dueAt: new Date(new Date(d.requestedAt).getTime() + GRACE_DAYS * DAY).toISOString(),
    })

  for (const p of input.purged)
    events.push({ at: p.purgedAt, type: "purged", email: null, plan: p.plan, createdAt: p.createdAt, country: p.country, dueAt: p.requestedAt })

  for (const s of input.subscriptions) {
    if (s.status === "canceled" && s.canceledAt) events.push({ at: s.canceledAt, type: "subscription_canceled", email: s.email, plan: s.planSlug })
    else if ((s.status === "active" || s.status === "trialing") && (s.cancelAtPeriodEnd || s.cancelAt))
      events.push({ at: s.cancelAt || s.createdAt, type: "cancel_scheduled", email: s.email, plan: s.planSlug, dueAt: s.cancelAt })
    else if (s.status === "past_due" || s.status === "unpaid") events.push({ at: s.createdAt, type: "payment_overdue", email: s.email, plan: s.planSlug })
  }

  events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())

  const since30 = now - 30 * DAY
  const in30 = (iso: string | null | undefined) => !!iso && new Date(iso).getTime() >= since30
  const pendingIds = new Set(input.deletionRequests.map((d) => d.id))

  return {
    events,
    summary: {
      activeAccounts: input.users.filter((u) => !pendingIds.has(u.id)).length,
      created30d: input.users.filter((u) => in30(u.createdAt)).length,
      deletionPending: input.deletionRequests.length,
      purgedTotal: input.purged.length,
      purged30d: input.purged.filter((p) => in30(p.purgedAt)).length,
      canceledTotal: input.subscriptions.filter((s) => s.status === "canceled").length,
      canceled30d: input.subscriptions.filter((s) => s.status === "canceled" && in30(s.canceledAt)).length,
      cancelScheduled: input.subscriptions.filter((s) => (s.status === "active" || s.status === "trialing") && (s.cancelAtPeriodEnd || s.cancelAt)).length,
      planChanges30d: input.planChanges.filter((c) => in30(c.at)).length,
      overdue: input.subscriptions.filter((s) => s.status === "past_due" || s.status === "unpaid").length,
    },
  }
}
