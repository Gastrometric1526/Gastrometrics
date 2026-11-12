import { beforeEach, describe, expect, it, vi } from "vitest"

// Base de datos falsa en memoria: lo justo para runFounderGrant. Cada consulta espera un
// tick antes de responder, como la red, para que tres llamadas a la vez se crucen igual
// que en producción (docs/163: 3 correos en el mismo segundo).
type Plan = { account_id: string; plan_slug: string; stripe_subscription_id: string | null; plan_expires_at?: string }
type Other = { id: string; confirmed: boolean; founderAt?: string }
type RecipeRow = { owner_id: string; created_at: string }
type TrashRow = { owner_id: string; deleted_at: string }
const db: { plans: Map<string, Plan>; metadata: Record<string, unknown>; createdAt: string; confirmed: boolean; others: Other[]; recipes: RecipeRow[]; trash: TrashRow[] } = {
  plans: new Map(),
  metadata: {},
  createdAt: "",
  confirmed: true,
  // Cuentas anteriores (todas con created_at ≤ la de u1): 27 confirmadas → u1 es la #28.
  others: [],
  // Recetas y papelera de las fundadoras anteriores (docs/289).
  recipes: [],
  trash: [],
}
const tick = () => new Promise((r) => setTimeout(r, 0))

function query(table: string) {
  const filters: [string, string, unknown][] = []
  let op: "select" | "update" | "insert" | "upsert" = "select"
  let payload: Record<string, unknown> = {}
  let countHead = false
  let ranged = false
  const run = async () => {
    await tick()
    if (table === "recipes" || table === "recipes_trash") {
      const ids = (filters.find((f) => f[0] === "in")?.[2] as string[]) ?? []
      const rows = (table === "recipes" ? db.recipes : db.trash) as { owner_id: string }[]
      return { data: rows.filter((r) => ids.includes(r.owner_id)), error: null }
    }
    if (table === "profiles") {
      if (countHead) return { count: 28, error: null }
      if (ranged) return { data: [...db.others.map((o) => ({ id: o.id })), { id: "u1" }], error: null }
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
    in: (c: string, v: unknown) => (filters.push(["in", c, v]), b),
    lte: () => b,
    order: () => b,
    range: () => ((ranged = true), b),
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
        return {
          data: { user: { id: "u1", email: "chef@example.com", created_at: db.createdAt, email_confirmed_at: db.confirmed ? db.createdAt : null, app_metadata: { ...db.metadata } } },
          error: null,
        }
      },
      listUsers: async ({ page = 1, perPage = 200 }: { page?: number; perPage?: number } = {}) => {
        await tick()
        const all = [
          ...db.others.map((o) => ({ id: o.id, email_confirmed_at: o.confirmed ? db.createdAt : null, app_metadata: o.founderAt ? { founder_grant: { at: o.founderAt } } : {} })),
          { id: "u1", email_confirmed_at: db.confirmed ? db.createdAt : null, app_metadata: {} },
        ]
        return { data: { users: all.slice((page - 1) * perPage, page * perPage) }, error: null }
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
    db.confirmed = true
    db.others = Array.from({ length: 27 }, (_, i) => ({ id: `c${i}`, confirmed: true }))
    db.recipes = []
    db.trash = []
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

  it("sin el correo confirmado no se le da todavía (docs/201)", async () => {
    db.confirmed = false
    const result = await runFounderGrant("u1", now)
    expect(result.action).toBe("wait")
    expect(sendOwnerNotification).not.toHaveBeenCalled()
  })

  it("la posición cuenta solo cuentas confirmadas (docs/201)", async () => {
    // 27 confirmadas + 200 sin confirmar antes: sigue siendo la #28, dentro de las 100.
    db.others = [...db.others, ...Array.from({ length: 200 }, (_, i) => ({ id: `n${i}`, confirmed: false }))]
    const result = await runFounderGrant("u1", now)
    expect(result.action).toBe("grant")
    expect(result.ordinal).toBe(28)
  })

  it("una llamada después de concedido no vuelve a avisar", async () => {
    await runFounderGrant("u1", now)
    const again = await runFounderGrant("u1", now)
    expect(again.action).toBe("skip")
    expect(sendOwnerNotification).toHaveBeenCalledTimes(1)
  })
  // docs/289: la fundadora que terminó sus 30 días con menos de 5 recetas libera su lugar.
  describe("lugares que se liberan", () => {
    const day = 86_400_000
    // 100 confirmadas antes: u1 sería la #101 (fuera).
    const full = () => Array.from({ length: 100 }, (_, i) => ({ id: `c${i}`, confirmed: true }) as Other)
    const recipesFor = (id: string, n: number, at: string) => Array.from({ length: n }, () => ({ owner_id: id, created_at: at }))

    it("sin fundadoras que liberen, la #101 se queda fuera", async () => {
      db.others = full()
      const result = await runFounderGrant("u1", now)
      expect(result).toMatchObject({ action: "skip", reason: "over_limit", ordinal: 101 })
    })

    it("una fundadora que terminó con 4 recetas libera su lugar y la siguiente entra", async () => {
      db.others = full()
      const grantedAt = new Date(now - 31 * day).toISOString()
      db.others[0].founderAt = grantedAt
      db.recipes = recipesFor("c0", 3, new Date(now - 20 * day).toISOString())
      // Una en la papelera, borrada dentro del período: también cuenta como creada.
      db.trash = [{ owner_id: "c0", deleted_at: new Date(now - 10 * day).toISOString() }]
      const result = await runFounderGrant("u1", now)
      expect(result).toMatchObject({ action: "grant", ordinal: 100 })
    })

    it("con 5 recetas dentro del período conserva su lugar", async () => {
      db.others = full()
      db.others[0].founderAt = new Date(now - 31 * day).toISOString()
      db.recipes = recipesFor("c0", 5, new Date(now - 20 * day).toISOString())
      const result = await runFounderGrant("u1", now)
      expect(result).toMatchObject({ action: "skip", reason: "over_limit", ordinal: 101 })
    })

    it("las recetas creadas después del período no cuentan", async () => {
      db.others = full()
      db.others[0].founderAt = new Date(now - 40 * day).toISOString()
      db.recipes = recipesFor("c0", 6, new Date(now - 2 * day).toISOString())
      const result = await runFounderGrant("u1", now)
      expect(result).toMatchObject({ action: "grant", ordinal: 100 })
    })

    it("mientras su período corre, la fundadora cuenta aunque no tenga recetas", async () => {
      db.others = full()
      db.others[0].founderAt = new Date(now - 10 * day).toISOString()
      const result = await runFounderGrant("u1", now)
      expect(result).toMatchObject({ action: "skip", reason: "over_limit", ordinal: 101 })
    })
  })
})
