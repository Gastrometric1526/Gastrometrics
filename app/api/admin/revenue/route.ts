/**
 * Ingresos reales desde Stripe para /admin (docs/195), SOLO LEYENDO: facturas de los últimos
 * 60 días y todas las suscripciones. El cálculo vive en lib/admin/revenue.ts.
 * Respuesta guardada 5 minutos por instancia (el panel se actualiza cada 30 s, docs/192);
 * ?fresh=1 la vuelve a pedir.
 */

import { NextResponse } from "next/server"
import type Stripe from "stripe"
import { hasAdminSession } from "@/lib/admin-auth"
import { getStripeClient, isStripeConfigured } from "@/lib/stripe/client"
import { monthlyFromRecurring, summarizeRevenue, type RevenueInvoice, type RevenueSubscription, type RevenueSummary } from "@/lib/admin/revenue"

export const dynamic = "force-dynamic"

const FIVE_MINUTES = 5 * 60 * 1000
const MAX_ROWS = 3000
let cache: { at: number; data: RevenueSummary & { mode: "live" | "test"; checkedAt: string } } | null = null

const sec = (v: number | null | undefined) => (typeof v === "number" ? v * 1000 : null)

function customerEmail(customer: unknown): string | null {
  if (customer && typeof customer === "object" && "email" in customer) return ((customer as { email?: string | null }).email ?? null) || null
  return null
}

function planOf(metadata: unknown): string | null {
  if (metadata && typeof metadata === "object" && "planSlug" in metadata) return String((metadata as { planSlug?: string }).planSlug || "") || null
  return null
}

export async function GET(request: Request) {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 })
  }
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Stripe no está configurado.", configured: false }, { status: 200 })
  }
  const fresh = new URL(request.url).searchParams.get("fresh") === "1"
  if (!fresh && cache && Date.now() - cache.at < FIVE_MINUTES) return NextResponse.json(cache.data)

  try {
    const stripe = getStripeClient()
    const since = Math.floor((Date.now() - 60 * 24 * 60 * 60 * 1000) / 1000)

    const invoices: RevenueInvoice[] = []
    for await (const inv of stripe.invoices.list({ created: { gte: since }, limit: 100 })) {
      const anyInv = inv as Stripe.Invoice & {
        subscription_details?: { metadata?: Record<string, string> | null } | null
        parent?: { subscription_details?: { metadata?: Record<string, string> | null } | null } | null
      }
      invoices.push({
        id: inv.id ?? "",
        status: inv.status ?? "draft",
        amountPaid: inv.amount_paid ?? 0,
        amountDue: inv.amount_due ?? 0,
        currency: inv.currency ?? "usd",
        createdAt: (inv.created ?? 0) * 1000,
        paidAt: sec(inv.status_transitions?.paid_at ?? null),
        attemptCount: inv.attempt_count ?? 0,
        email: inv.customer_email ?? null,
        planSlug: planOf(anyInv.parent?.subscription_details?.metadata ?? anyInv.subscription_details?.metadata),
        billingReason: inv.billing_reason ?? null,
      })
      if (invoices.length >= MAX_ROWS) break
    }

    const subscriptions: RevenueSubscription[] = []
    for await (const sub of stripe.subscriptions.list({ status: "all", limit: 100, expand: ["data.customer"] })) {
      const monthlyAmount = sub.items.data.reduce((sum, item) => {
        const price = item.price
        if (!price?.recurring || typeof price.unit_amount !== "number") return sum
        return sum + monthlyFromRecurring(price.unit_amount, price.recurring.interval, price.recurring.interval_count ?? 1, item.quantity ?? 1)
      }, 0)
      subscriptions.push({
        id: sub.id,
        status: sub.status,
        monthlyAmount,
        currency: sub.currency ?? "usd",
        planSlug: planOf(sub.metadata),
        email: customerEmail(sub.customer),
        createdAt: (sub.created ?? 0) * 1000,
        canceledAt: sec(sub.canceled_at),
        cancelAtPeriodEnd: !!sub.cancel_at_period_end,
        cancelAt: sec(sub.cancel_at),
      })
      if (subscriptions.length >= MAX_ROWS) break
    }

    const mode: "live" | "test" = (process.env.STRIPE_SECRET_KEY || "").startsWith("sk_live") ? "live" : "test"
    const data = { ...summarizeRevenue(invoices, subscriptions), mode, checkedAt: new Date().toISOString() }
    cache = { at: Date.now(), data }
    return NextResponse.json(data)
  } catch (error) {
    console.error("[api/admin/revenue] Error:", error)
    return NextResponse.json({ error: "No se pudo leer Stripe." }, { status: 500 })
  }
}
