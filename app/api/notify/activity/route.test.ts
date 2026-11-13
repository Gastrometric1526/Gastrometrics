import { beforeEach, describe, expect, it, vi } from "vitest"

const push = vi.fn(async (_message: unknown) => 1)
let user: { id: string; email: string } | null = null
let business: { name: string; owner_id: string } | null = null
let member: { user_id: string } | null = null

vi.mock("@/lib/services/admin-push", () => ({ sendAdminPush: (message: unknown) => push(message) }))
vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: () => ({ auth: { getUser: async () => ({ data: { user } }) } }),
}))
vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdminClient: () => ({
    from: (table: string) => {
      const query = {
        select: () => query,
        eq: () => query,
        maybeSingle: async () => ({
          data: table === "businesses" ? business : table === "business_members" ? member : { full_name: "Ana" },
        }),
      }
      return query
    },
  }),
}))

import { POST } from "./route"

const call = (body: unknown) =>
  POST(new Request("http://localhost/api/notify/activity", { method: "POST", body: JSON.stringify(body) }))
let n = 0

describe("/api/notify/activity", () => {
  beforeEach(() => {
    push.mockClear()
    user = { id: `u${++n}`, email: "ana@correo.com" }
    business = { name: "La Terraza", owner_id: user.id }
    member = null
    delete process.env.FEEDBACK_NOTIFY_TO
  })

  it("rechaza acciones fuera de la lista y a quien no tiene sesión", async () => {
    expect((await call({ module: "recetas", action: "deleted" })).status).toBe(400)
    user = null
    expect((await call({ module: "recetas", action: "created" })).status).toBe(401)
    expect(push).not.toHaveBeenCalled()
  })

  it("avisa con el nombre del negocio", async () => {
    await call({ module: "recetas", action: "created", businessId: "b1" })
    expect(push).toHaveBeenCalledWith({ title: "Receta creada", body: "Ana · ana@correo.com · La Terraza", url: `/admin?tab=cuentas&sub=lista&account=${user!.id}` })
  })

  it("sin negocio dice dashboard personal", async () => {
    await call({ module: "ingredientes", action: "imported", businessId: "main", count: 40 })
    expect(push).toHaveBeenCalledWith({
      title: "Ingredientes importados",
      body: "Ana · ana@correo.com · Dashboard personal · 40 elementos",
      url: `/admin?tab=cuentas&sub=lista&account=${user!.id}`,
    })
  })

  it("no acepta un negocio ajeno, pero sí a quien es del equipo", async () => {
    business = { name: "Ajeno", owner_id: "otro" }
    expect((await call({ module: "menus", action: "created", businessId: "b2" })).status).toBe(404)
    expect(push).not.toHaveBeenCalled()
    member = { user_id: "x" }
    expect((await call({ module: "menus", action: "created", businessId: "b2" })).status).toBe(200)
    expect(push).toHaveBeenCalledTimes(1)
  })

  it("no avisa las acciones del dueño", async () => {
    process.env.FEEDBACK_NOTIFY_TO = "ana@correo.com"
    await call({ module: "app", action: "opened" })
    expect(push).not.toHaveBeenCalled()
  })

  it("el ingreso avisa una vez por hora y las acciones tienen tope", async () => {
    await call({ module: "app", action: "opened" })
    await call({ module: "app", action: "opened" })
    expect(push).toHaveBeenCalledTimes(1)
    push.mockClear()
    for (let i = 0; i < 8; i++) await call({ module: "recetas", action: "created" })
    expect(push).toHaveBeenCalledTimes(5)
  })
})
