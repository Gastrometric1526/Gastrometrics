import { beforeEach, describe, expect, it, vi } from "vitest"

/** Avisos de Stripe fuera de orden (docs/242). Sin red: Stripe y la base están simulados. */
const state = vi.hoisted(() => ({
  row: { account_id: "acc", plan_slug: "sous-chef", stripe_subscription_id: "sub_new" as string | null },
  event: null as any,
  liveStatus: "active",
  upserts: [] as any[],
}))

vi.mock("@/lib/stripe/client", () => ({
  getStripeClient: () => ({
    webhooks: { constructEvent: () => state.event },
    subscriptions: {
      retrieve: async (id: string) => ({ id, status: state.liveStatus, cancel_at_period_end: false, items: { data: [] } }),
    },
  }),
}))
vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdminClient: () => ({
    from: () => {
      const query: any = {
        select: () => query,
        eq: () => query,
        maybeSingle: async () => ({ data: state.row, error: null }),
        upsert: async (value: any) => {
          state.upserts.push(value)
          return { error: null }
        },
      }
      return query
    },
  }),
}))
vi.mock("@/lib/services/notify-billing", () => ({
  sendPlanChangedEmail: vi.fn(),
  sendSubscriptionCancelledEmail: vi.fn(),
  sendOwnerBillingNotification: vi.fn(),
}))
vi.mock("@/lib/services/payment-notice", () => ({ confirmPayment: vi.fn() }))
vi.mock("@/lib/services/plan-change-notice", () => ({ recordPlanChangeNotice: vi.fn() }))
vi.mock("@/lib/services/scheduled-renewal", () => ({
  cancelScheduledRenewal: vi.fn(),
  getScheduledRenewal: vi.fn(async () => null),
  saveScheduledRenewal: vi.fn(),
  verifyScheduledRenewal: vi.fn(),
}))

import { POST } from "./route"

const send = (type: string, object: unknown) => {
  state.event = { type, data: { object } }
  return POST(new Request("http://localhost/api/webhooks/stripe", { method: "POST", headers: { "stripe-signature": "x" }, body: "{}" }))
}

beforeEach(() => {
  process.env.STRIPE_WEBHOOK_SECRET = "test"
  state.row = { account_id: "acc", plan_slug: "sous-chef", stripe_subscription_id: "sub_new" }
  state.liveStatus = "active"
  state.upserts = []
})

describe("avisos de Stripe fuera de orden", () => {
  it("cancelar otra suscripción no deja la cuenta en Foodie", async () => {
    await send("customer.subscription.deleted", { id: "sub_old", customer: "cus", metadata: {} })
    expect(state.upserts).toEqual([])
  })

  it("cancelar la suscripción de la cuenta sí termina el plan", async () => {
    await send("customer.subscription.deleted", { id: "sub_new", customer: "cus", metadata: {} })
    expect(state.upserts[0]).toMatchObject({ plan_slug: "foodie", stripe_subscription_id: null })
  })

  it("un aviso «activa» que llega después de cancelar no devuelve el plan", async () => {
    state.row = { account_id: "acc", plan_slug: "foodie", stripe_subscription_id: null }
    state.liveStatus = "canceled"
    await send("customer.subscription.updated", { id: "sub_old", customer: "cus", status: "active", metadata: { planSlug: "sous-chef", accountId: "acc" } })
    expect(state.upserts).toEqual([])
  })

  it("con la suscripción de la cuenta manda el estado de ahora, no el del aviso", async () => {
    state.liveStatus = "canceled"
    await send("customer.subscription.updated", { id: "sub_new", customer: "cus", status: "active", metadata: { planSlug: "sous-chef", accountId: "acc" } })
    expect(state.upserts[0]).toMatchObject({ plan_slug: "foodie" })
  })

  it("un pago que llega tarde no revive una suscripción terminada", async () => {
    state.liveStatus = "canceled"
    await send("checkout.session.completed", {
      id: "cs",
      payment_status: "paid",
      subscription: "sub_old",
      customer: "cus",
      metadata: { planSlug: "sous-chef", accountId: "acc" },
    })
    expect(state.upserts).toEqual([])
  })
})
