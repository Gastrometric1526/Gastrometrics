import { beforeEach, describe, expect, it, vi } from "vitest"

let session = true
const events: unknown[] = []
const push = vi.fn(async (_message: unknown) => 1)
let tableRows: Record<string, unknown>[] = []

vi.mock("@/lib/admin-auth", () => ({ hasAdminSession: async () => session }))
vi.mock("@/lib/stripe/client", () => ({ isStripeConfigured: () => false, getStripeClient: () => null }))
vi.mock("@/lib/services/account-snapshots", () => ({ SNAPSHOT_BUCKET: "account-backups" }))
vi.mock("@/lib/services/admin-push", () => ({
  BUCKET: "admin-push",
  readConfig: async () => ({ subscriptions: [{ label: "Celular", addedAt: "2026-11-01", subscription: { endpoint: "secreto" } }] }),
  sendAdminPush: (message: unknown) => push(message),
}))
vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdminClient: () => ({
    from: () => {
      let head = false
      const query = {
        select: (_columns: string, options?: { head?: boolean }) => {
          head = Boolean(options?.head)
          return query
        },
        order: () => query,
        range: async (from: number, to: number) => ({ data: tableRows.slice(from, to + 1), error: null }),
        insert: async (row: unknown) => {
          events.push(row)
          return { error: null }
        },
        then: (resolve: (value: unknown) => void) => resolve(head ? { count: tableRows.length, error: null } : { data: [], error: null }),
      }
      return query
    },
    auth: {
      admin: {
        listUsers: async () => ({
          data: { users: [{ id: "u1", email: "ana@correo.com", encrypted_password: "x", identities: [{}] }] },
          error: null,
        }),
      },
    },
    storage: { from: () => ({ list: async () => ({ data: [{ name: "u9.json", updated_at: "2026-11-02" }], error: null }) }) },
  }),
}))

import { GET, POST } from "./route"

const get = async (query: string) => {
  const res = await GET(new Request(`http://localhost/api/admin/export?${query}`))
  return { status: res.status, body: await res.json() }
}

describe("/api/admin/export", () => {
  beforeEach(() => {
    session = true
    tableRows = []
    events.length = 0
    push.mockClear()
  })

  it("exige sesión de admin para leer y para registrar", async () => {
    session = false
    expect((await get("source=recipes")).status).toBe(401)
    expect((await POST()).status).toBe(401)
    expect(events).toEqual([])
  })

  it("rechaza fuentes que no están en la lista", async () => {
    expect((await get("source=pg_user")).status).toBe(400)
  })

  it("pagina hasta traer todas las filas y da el total", async () => {
    tableRows = Array.from({ length: 450 }, (_, id) => ({ id }))
    const first = await get("source=recipes")
    expect(first.body).toMatchObject({ next: "200", total: 450 })
    expect(first.body.rows).toHaveLength(200)
    const last = await get("source=recipes&cursor=400")
    expect(last.body.rows).toHaveLength(50)
    expect(last.body.next).toBeNull()
  })

  it("corta por peso y sigue donde quedó", async () => {
    tableRows = Array.from({ length: 3 }, (_, id) => ({ id, data: "x".repeat(2_000_000) }))
    const { body } = await get("source=support_messages")
    expect(body.rows).toHaveLength(1)
    expect(body.next).toBe("1")
  })

  it("no entrega tokens de invitación", async () => {
    tableRows = [{ token: "secreto", business_id: "b1" }]
    expect((await get("source=business_invites")).body.rows).toEqual([{ business_id: "b1" }])
  })

  it("de las cuentas solo salen los campos permitidos", async () => {
    expect((await get("source=auth_users")).body.rows).toEqual([{ id: "u1", email: "ana@correo.com" }])
  })

  it("de los aparatos no sale la dirección de suscripción", async () => {
    const { body } = await get("source=push_devices")
    expect(JSON.stringify(body)).not.toContain("secreto")
    expect(body.rows[0]).toEqual({ scope: "admin", label: "Celular", added_at: "2026-11-01" })
  })

  it("deja constancia de la descarga y avisa", async () => {
    await POST()
    expect(events).toEqual([{ event_name: "admin_full_export" }])
    expect(push).toHaveBeenCalledTimes(1)
  })
})
