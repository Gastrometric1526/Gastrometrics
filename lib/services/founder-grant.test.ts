import { beforeEach, describe, expect, it, vi } from "vitest"

// Base de datos falsa en memoria: lo justo para runFounderGrant. Cada consulta espera un
// tick antes de responder, como la red, para que tres llamadas a la vez se crucen igual
// que en producción (docs/163: 3 correos en el mismo segundo).
type Plan = { account_id: string; plan_slug: string; stripe_subscription_id: string | null; plan_expires_at?: string }
const db: { plans: Map<string, Plan>; metadata: Record<string, unknown>; createdAt: string } = {
  plans: new Map(),
  metadata: {},
  createdAt: "",
}
const tick = () => new Promise((r) => setTimeout(r, 0))

function query(table: string) {
  const filters: [string, string, unknown][] = []
  let op: "select" | "update" | "insert" | "upsert" = "select"
  let payload: Record<string, unknown> = {}
  let countHead = false
  const run = async () => {
    await tick()
    if (table === "profiles") {
      if (countHead) return { count: 28, error: null }
      return { data: { created_at: db.createdAt, full_name: "Chef" }, error: null }
    }
    const id = filters.find((f) => f[1] === "account_id")?.[2] as string
    const row = db.plans.get(id)
    if (op === "select") return { data: row ?? null, error: null }
    if (op === "upsert") {
      db.plans.set(payload.account_id as string, { ...({ stripe_subscription_id: null } as Partial<Plan>), ...(db.plans.get(payload.account_id as string) || {}), ...(payload as Plan) })
      return { data: null, error: null }
    }
    if (op === "insert") {
      if (db.plans.has(payload.account_id as string)) return { data: null, error: { code: "23505" } }
      db.plans.set(payload.account_id as string, { ...({ stripe_subscription_id: null } as Partial<Plan>), ...(payload as Plan) })
      return { data: [{ account_id: payload.account_id }], error: null }
    }
    const matches = row && filters.every(([kind, col, val]) => (kind === "is" ? (row as never)[col] === val : (row as never)[col] === val))
    if (!matches) return { data: [], error: null }
    Object.assign(row, payload)
    return { data: [{ account_id: id }], error: null }
  }
  const b: Record<string, unknown> = {
    select: (_c?: string, opts?: { head?: boolean }) => ((countHead = Boolean(opts?.head)), b),
    update: (p: Record<string, unknown>) => ((op = "update"), (payload = p), b),
    insert: (p: Record<string, unknown>) => ((op = "insert"), (payload = p), b),
    upsert: (p: Record<string, unknown>) => ((op = "upsert"), (payload = p), b),
    eq: (c: string, v: unknown) => (filters.push(["eq", c, v]), b),
    is: (c: string, v: unknown) => (filters.push(["is", c, v]), b),
    lte: () => b,
    maybeSingle: () => run(),
    then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => run().then(res, rej),
  }
  return b
}

const admin = {
  from: query,
  auth: {
    admin: {
      getUserById: async () => {
        await tick()
        return { data: { user: { id: "u1", email: "chef@example.com", created_at: db.createdAt, app_metadata: { ...db.metadata } } }, error: null }
      },
      updateUserById: async (_id: string, attrs: { app_metadata: Record<string, unknown> }) => {
        await tick()
        db.metadata = attrs.app_metadata
        return { error: null }
      },
    },
  },
}

const sendPlanChangedEmail = vi.fn(async () => {})
const recordPlanChangeNotice = vi.fn(async () => {})
const sendOwnerNotification = vi.fn(async () => true)
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdminClient: () => admin }))
vi.mock("@/lib/services/notify-billing", () => ({ sendPlanChangedEmail: (...a: unknown[]) => sendPlanChangedEmail(...(a as [])) }))
vi.mock("@/lib/services/plan-change-notice", () => ({ recordPlanChangeNotice: (...a: unknown[]) => recordPlanChangeNotice(...(a as [])) }))
vi.mock("@/lib/services/notify-owner", () => ({
  sendOwnerNotification: (...a: unknown[]) => sendOwnerNotification(...(a as [])),
  hondurasTime: () => "hoy",
}))

import { runFounderGrant } from "./founder-grant"
import { FOUNDER_PROGRAM } from "@/lib/founder-program"

describe("runFounderGrant con llamadas simultáneas (docs/163)", () => {
  const created = new Date(new Date(FOUNDER_PROGRAM.startsAt).getTime() + 3600_000).toISOString()
  const now = new Date(created).getTime() + FOUNDER_PROGRAM.delayMs + 1000

  beforeEach(() => {
    db.plans = new Map()
    db.metadata = {}
    db.createdAt = created
    sendPlanChangedEmail.mockClear()
    recordPlanChangeNotice.mockClear()
    sendOwnerNotification.mockClear()
  })

  it("con la fila en Foodie, tres llamadas a la vez dan un solo plan y un solo aviso", async () => {
    db.plans.set("u1", { account_id: "u1", plan_slug: "foodie", stripe_subscription_id: null })
    const results = await Promise.all([runFounderGrant("u1", now), runFounderGrant("u1", now), runFounderGrant("u1", now)])
    expect(results.filter((r) => r.action === "grant")).toHaveLength(1)
    expect(sendOwnerNotification).toHaveBeenCalledTimes(1)
    expect(sendPlanChangedEmail).toHaveBeenCalledTimes(1)
    expect(recordPlanChangeNotice).toHaveBeenCalledTimes(1)
    expect(db.plans.get("u1")?.plan_slug).toBe(FOUNDER_PROGRAM.planSlug)
  })

  it("sin fila de plan todavía, también gana una sola", async () => {
    const results = await Promise.all([runFounderGrant("u1", now), runFounderGrant("u1", now), runFounderGrant("u1", now)])
    expect(results.filter((r) => r.action === "grant")).toHaveLength(1)
    expect(sendOwnerNotification).toHaveBeenCalledTimes(1)
  })

  it("una llamada después de concedido no vuelve a avisar", async () => {
    await runFounderGrant("u1", now)
    const again = await runFounderGrant("u1", now)
    expect(again.action).toBe("skip")
    expect(sendOwnerNotification).toHaveBeenCalledTimes(1)
  })
})
