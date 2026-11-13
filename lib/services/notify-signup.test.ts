import { beforeEach, describe, expect, it, vi } from "vitest"

// docs/293: «Nueva cuenta confirmada» llegaba dos veces cuando el Dashboard se cargaba dos veces
// a la vez. Base falsa: cada lectura y escritura espera un tick, como la red.
const state: { meta: Record<string, unknown> } = { meta: {} }
const tick = () => new Promise((r) => setTimeout(r, 5))
const confirmedIso = new Date(Date.now() - 60_000).toISOString()

const admin = {
  auth: {
    admin: {
      getUserById: async () => {
        await tick()
        return { data: { user: { id: "u1", email: "chef@correo.com", email_confirmed_at: confirmedIso, created_at: confirmedIso, invited_at: null, app_metadata: { ...state.meta }, user_metadata: {} } }, error: null }
      },
      updateUserById: async (_id: string, attrs: { app_metadata: Record<string, unknown> }) => {
        await tick()
        state.meta = attrs.app_metadata
        return { error: null }
      },
    },
  },
  from: () => ({
    insert: async () => ({ error: null }),
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }),
  }),
}

const sendWithRetry = vi.fn(async () => ({ error: null }))
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdminClient: () => admin }))
vi.mock("./send-email", () => ({ sendWithRetry: (...a: unknown[]) => sendWithRetry(...(a as [])) }))
vi.mock("./admin-push", () => ({ sendAdminPush: async () => {} }))
vi.mock("./referrals", () => ({ notifyOwnerReferralSignup: async () => {} }))
vi.mock("resend", () => ({ Resend: function Resend() {} }))

import { notifyOwnerAccountConfirmed } from "./notify-signup"

describe("aviso de cuenta confirmada, una sola vez (docs/293)", () => {
  beforeEach(() => {
    state.meta = {}
    sendWithRetry.mockClear()
    process.env.RESEND_API_KEY = "test"
    process.env.FEEDBACK_NOTIFY_TO = "dueno@correo.com"
  })

  it("dos cargas del Dashboard a la vez mandan un solo correo", async () => {
    const results = await Promise.all([notifyOwnerAccountConfirmed("u1"), notifyOwnerAccountConfirmed("u1")])
    expect(results.filter(Boolean)).toHaveLength(1)
    expect(sendWithRetry).toHaveBeenCalledTimes(1)
  }, 10_000)

  it("una carga después del aviso no vuelve a mandarlo", async () => {
    await notifyOwnerAccountConfirmed("u1")
    await notifyOwnerAccountConfirmed("u1")
    expect(sendWithRetry).toHaveBeenCalledTimes(1)
  }, 10_000)
})
