import { describe, expect, it } from "vitest"
import { computeAppOverview } from "./app-overview"

const now = Date.parse("2026-11-12T12:00:00.000Z")
const daysAgo = (d: number) => new Date(now - d * 86_400_000).toISOString()

describe("toda la app en números (docs/286)", () => {
  const o = computeAppOverview({
    now,
    accounts: [
      { id: "a", confirmed: true },
      { id: "b", confirmed: true },
      { id: "c", confirmed: true },
      { id: "x", confirmed: false },
    ],
    profiles: [
      { id: "a", preferred_language: "es", nationality: "Honduras", business_type: "Restaurante" },
      { id: "b", preferred_language: "es", nationality: "Honduras", business_type: "Cafetería", deletion_requested_at: daysAgo(3) },
      { id: "c", preferred_language: "en", nationality: "Dinamarca", business_type: "" },
      { id: "x", preferred_language: "fr" },
    ],
    plans: [
      { account_id: "a", plan_slug: "chef-ejecutivo" },
      { account_id: "b", plan_slug: null },
      { account_id: "x", plan_slug: "sous-chef" },
    ],
    owners: { recipes: ["a", "a", "a", "b", "x"], pos_data: ["a"] },
    activity: [
      { user_id: "a", module: "recetas", created_at: daysAgo(1) },
      { user_id: "a", module: "recetas", created_at: daysAgo(2) },
      { user_id: "b", module: "recetas", created_at: daysAgo(20) },
      { user_id: "x", module: "pos", created_at: daysAgo(1) },
    ],
  })

  it("solo cuenta cuentas confirmadas", () => {
    expect(o.confirmedAccounts).toBe(3)
    expect(o.languages).toEqual([{ key: "es", count: 2 }, { key: "en", count: 1 }])
    expect(o.plans.map((p) => p.key)).toEqual(["chef-ejecutivo", "foodie"])
  })

  it("adopción por módulo y promedio entre quienes lo usan", () => {
    const recipes = o.modules.find((m) => m.module === "recipes")!
    expect(recipes).toMatchObject({ rows: 4, accounts: 2, perAccount: 2 })
    expect(recipes.adoption).toBeCloseTo(2 / 3)
    expect(o.modules.find((m) => m.module === "menus")).toMatchObject({ rows: 0, accounts: 0, adoption: 0, perAccount: 0 })
  })

  it("actividad por módulo, activas en 7 y 30 días y cuentas por eliminarse", () => {
    expect(o.activity).toEqual([{ module: "recetas", users: 2, actions: 3 }])
    expect(o.active7).toBe(1)
    expect(o.active30).toBe(2)
    expect(o.pendingDeletion).toBe(1)
    expect(o.businessTypes.find((b) => b.key === "—")?.count).toBe(1)
  })
})
