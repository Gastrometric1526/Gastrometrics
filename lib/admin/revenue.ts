/**
 * Ingresos reales para /admin (docs/195): lo que Stripe cobró de verdad, el ingreso mensual
 * recurrente de las suscripciones activas, las cancelaciones y los cobros que fallaron.
 * Antes el panel solo mostraba un MRR *estimado* a partir de los planes asignados.
 *
 * Funciones puras sobre filas ya leídas de Stripe (app/api/admin/revenue/route.ts las trae,
 * solo leyendo), para poder probarlas sin red.
 */

export interface RevenueInvoice {
  id: string
  status: string // draft | open | paid | uncollectible | void
  amountPaid: number // centavos
  amountDue: number // centavos
  currency: string
  createdAt: number // ms
  paidAt: number | null // ms
  attemptCount: number
  email: string | null
  planSlug: string | null
  billingReason: string | null
}

export interface RevenueSubscription {
  id: string
  status: string // active | trialing | past_due | unpaid | canceled | incomplete | incomplete_expired | paused
  monthlyAmount: number // centavos al mes (ya normalizado por intervalo y cantidad)
  currency: string
  planSlug: string | null
  email: string | null
  createdAt: number
  canceledAt: number | null
  cancelAtPeriodEnd: boolean
  cancelAt: number | null
}

const DAY = 24 * 60 * 60 * 1000

/** Monto mensual de un precio recurrente: año ÷ 12, semana × 52 ÷ 12, día × 365 ÷ 12. */
export function monthlyFromRecurring(unitAmount: number, interval: string, intervalCount = 1, quantity = 1): number {
  const per = unitAmount * quantity
  const count = Math.max(1, intervalCount)
  switch (interval) {
    case "year":
      return per / (12 * count)
    case "week":
      return (per * 52) / (12 * count)
    case "day":
      return (per * 365) / (12 * count)
    default:
      return per / count
  }
}

export interface RevenueSummary {
  currency: string
  mrr: number
  activeSubscriptions: number
  trialingSubscriptions: number
  mrrByPlan: { planSlug: string; mrr: number; count: number }[]
  collected30d: number
  collectedPrev30d: number
  collectedThisMonth: number
  paidInvoices30d: number
  daily: { day: string; amount: number }[] // últimos 30 días, YYYY-MM-DD en hora local del servidor
  cancellations30d: { email: string | null; planSlug: string | null; at: number }[]
  scheduledCancellations: { email: string | null; planSlug: string | null; at: number | null }[]
  failed: { email: string | null; planSlug: string | null; amount: number; at: number; status: string; attempts: number }[]
  newSubscriptions30d: number
  churnRate30d: number | null // cancelaciones ÷ (activas al inicio del período), en %
}

const dayKey = (ms: number) => {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export function summarizeRevenue(invoices: RevenueInvoice[], subscriptions: RevenueSubscription[], now = Date.now()): RevenueSummary {
  const since30 = now - 30 * DAY
  const since60 = now - 60 * DAY
  const monthStart = new Date(new Date(now).getFullYear(), new Date(now).getMonth(), 1).getTime()
  const currency = (subscriptions[0]?.currency || invoices[0]?.currency || "usd").toLowerCase()

  // Ingreso recurrente: suscripciones que hoy cobran (activas o con cobro atrasado que Stripe
  // sigue intentando). Las de prueba se cuentan aparte: todavía no pagan.
  const billing = subscriptions.filter((s) => s.status === "active" || s.status === "past_due")
  const mrr = billing.reduce((sum, s) => sum + s.monthlyAmount, 0)
  const byPlan = new Map<string, { mrr: number; count: number }>()
  for (const s of billing) {
    const key = s.planSlug || "?"
    const row = byPlan.get(key) || { mrr: 0, count: 0 }
    row.mrr += s.monthlyAmount
    row.count += 1
    byPlan.set(key, row)
  }

  const paid = invoices.filter((i) => i.status === "paid" && i.amountPaid > 0)
  const paidAt = (i: RevenueInvoice) => i.paidAt ?? i.createdAt
  const collected30d = paid.filter((i) => paidAt(i) >= since30).reduce((s, i) => s + i.amountPaid, 0)
  const collectedPrev30d = paid.filter((i) => paidAt(i) >= since60 && paidAt(i) < since30).reduce((s, i) => s + i.amountPaid, 0)
  const collectedThisMonth = paid.filter((i) => paidAt(i) >= monthStart).reduce((s, i) => s + i.amountPaid, 0)

  const dailyMap = new Map<string, number>()
  for (let d = 29; d >= 0; d--) dailyMap.set(dayKey(now - d * DAY), 0)
  for (const i of paid) {
    const k = dayKey(paidAt(i))
    if (dailyMap.has(k)) dailyMap.set(k, (dailyMap.get(k) || 0) + i.amountPaid)
  }

  const cancellations30d = subscriptions
    .filter((s) => s.status === "canceled" && s.canceledAt !== null && s.canceledAt >= since30)
    .map((s) => ({ email: s.email, planSlug: s.planSlug, at: s.canceledAt as number }))
    .sort((a, b) => b.at - a.at)
  const scheduledCancellations = subscriptions
    .filter((s) => (s.status === "active" || s.status === "trialing") && (s.cancelAtPeriodEnd || s.cancelAt !== null))
    .map((s) => ({ email: s.email, planSlug: s.planSlug, at: s.cancelAt }))

  // Cobros fallidos: facturas abiertas que Stripe ya intentó cobrar al menos una vez, o
  // marcadas como incobrables, más suscripciones con el cobro atrasado sin factura en la lista.
  const failedInvoices = invoices
    .filter((i) => (i.status === "open" && i.attemptCount > 0) || i.status === "uncollectible")
    .map((i) => ({ email: i.email, planSlug: i.planSlug, amount: i.amountDue, at: i.createdAt, status: i.status, attempts: i.attemptCount }))
  const failedEmails = new Set(failedInvoices.map((f) => f.email))
  const pastDue = subscriptions
    .filter((s) => (s.status === "past_due" || s.status === "unpaid") && !failedEmails.has(s.email))
    .map((s) => ({ email: s.email, planSlug: s.planSlug, amount: s.monthlyAmount, at: s.createdAt, status: s.status, attempts: 0 }))
  const failed = [...failedInvoices, ...pastDue].sort((a, b) => b.at - a.at)

  const newSubscriptions30d = subscriptions.filter((s) => s.createdAt >= since30 && s.status !== "incomplete" && s.status !== "incomplete_expired").length
  // Activas al inicio del período ≈ las que existían antes y no se habían cancelado todavía.
  const activeAtStart = subscriptions.filter(
    (s) => s.createdAt < since30 && (s.canceledAt === null || s.canceledAt >= since30) && s.status !== "incomplete" && s.status !== "incomplete_expired",
  ).length
  const churnRate30d = activeAtStart > 0 ? (cancellations30d.length / activeAtStart) * 100 : null

  return {
    currency,
    mrr,
    activeSubscriptions: billing.length,
    trialingSubscriptions: subscriptions.filter((s) => s.status === "trialing").length,
    mrrByPlan: [...byPlan.entries()].map(([planSlug, v]) => ({ planSlug, ...v })).sort((a, b) => b.mrr - a.mrr),
    collected30d,
    collectedPrev30d,
    collectedThisMonth,
    paidInvoices30d: paid.filter((i) => paidAt(i) >= since30).length,
    daily: [...dailyMap.entries()].map(([day, amount]) => ({ day, amount })),
    cancellations30d,
    scheduledCancellations,
    failed,
    newSubscriptions30d,
    churnRate30d,
  }
}
