import { describe, it, expect } from "vitest"
import { rankUsersByUsage, type ActivityRow } from "./top-users"

const row = (user_id: string, day: string, action: string, module = "recetas"): ActivityRow => ({
  user_id,
  user_name: user_id.toUpperCase(),
  module,
  action,
  created_at: `2026-09-${day}T10:00:00Z`,
})

const activity: ActivityRow[] = [
  // Ana: 3 días distintos, 2 acciones, 2 visitas
  row("ana", "10", "created"), row("ana", "11", "entered", "inventario"), row("ana", "12", "updated", "inventario"), row("ana", "12", "entered", "dashboard"),
  // Beto: 1 día, 5 acciones
  ...Array.from({ length: 5 }, () => row("beto", "20", "created", "ingredientes")),
]
const base = {
  activity,
  presence: new Map([
    ["ana", { total_active_seconds: 600, last_seen_at: "2026-09-12T10:00:00Z" }],
    ["beto", { total_active_seconds: 7200, last_seen_at: null }],
    ["carla", { total_active_seconds: 99999, last_seen_at: null }],
  ]),
  planBy: new Map([["beto", "sous-chef"]]),
  emailBy: new Map([["ana", "ana@x.com"]]),
}

describe("rankUsersByUsage (docs/141)", () => {
  it("cuenta días distintos, acciones y visitas; el dashboard no cuenta como módulo más usado", () => {
    const [ana] = rankUsersByUsage({ ...base, sort: "days" })
    expect(ana).toMatchObject({ userId: "ana", activeDays: 3, actions: 2, visits: 2, email: "ana@x.com", plan: "foodie" })
    expect(ana.topModules).toEqual(["inventario", "recetas"])
  })

  it("ordena por el criterio elegido", () => {
    expect(rankUsersByUsage({ ...base, sort: "days" }).map((u) => u.userId)).toEqual(["ana", "beto"])
    expect(rankUsersByUsage({ ...base, sort: "actions" }).map((u) => u.userId)).toEqual(["beto", "ana"])
    expect(rankUsersByUsage({ ...base, sort: "time" })[0]).toMatchObject({ userId: "beto", plan: "sous-chef", totalActiveSeconds: 7200 })
  })

  it("quien no tuvo actividad en el período no aparece aunque tenga tiempo acumulado", () => {
    expect(rankUsersByUsage({ ...base, sort: "time" }).some((u) => u.userId === "carla")).toBe(false)
  })
})
