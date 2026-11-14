import { describe, expect, it } from "vitest"
import { baseOf, dailyReset, differsFromBase, editBase, restoreBase, saveTodayAsBase } from "./pos-floor-base"
import type { FloorPlan, FloorTable } from "@/types/pos"

const table = (id: string, over: Partial<FloorTable> = {}): FloorTable => ({ id, areaId: "a1", label: id, shape: "square", seats: 4, x: 100, y: 100, w: 120, h: 120, ...over })
const at = new Date("2026-11-14T12:00:00.000Z")

const withBase = (): FloorPlan =>
  saveTodayAsBase({ areas: [{ id: "a1", name: "Salón" }], tables: [table("1"), table("2", { x: 300 })], updatedAt: "2026-11-01T00:00:00.000Z" }, at)

describe("plano base y cambios del día (docs/303)", () => {
  it("sin base (planos de antes), el de hoy hace de base y no hay cambios", () => {
    const old: FloorPlan = { areas: [{ id: "a1", name: "Salón" }], tables: [table("1")], updatedAt: "x" }
    expect(differsFromBase(old)).toBe(false)
    expect(baseOf(old).tables.map((t) => t.id)).toEqual(["1"])
  })

  it("juntar mesas hoy no toca la base, y volver a la base lo deshace", () => {
    const plan = withBase()
    const today: FloorPlan = { ...plan, tables: [table("1", { w: 240, seats: 8 }), table("9", { x: 600, label: "Extra" })] }
    expect(differsFromBase(today)).toBe(true)
    expect(baseOf(today).tables.map((t) => t.id)).toEqual(["1", "2"])
    const { plan: back, kept } = restoreBase(today, [], at)
    expect(kept).toEqual([])
    expect(back.tables.map((t) => [t.id, t.w])).toEqual([
      ["1", 120],
      ["2", 120],
    ])
    expect(differsFromBase(back)).toBe(false)
  })

  it("una mesa con cuenta abierta que no está en la base se queda", () => {
    const plan = withBase()
    const today: FloorPlan = { ...plan, tables: [...plan.tables, table("9", { areaId: "gone", label: "Extra" })] }
    const { plan: back, kept } = restoreBase(today, ["9"], at)
    expect(kept.map((t) => t.id)).toEqual(["9"])
    expect(back.tables.find((t) => t.id === "9")?.areaId).toBe("a1")
  })

  it("editar la base: si hoy era igual, se ve hoy; si hoy tenía cambios, solo la base", () => {
    const plan = withBase()
    const next = { areas: plan.areas, tables: [...plan.tables, table("3", { x: 500 })] }
    const same = editBase(plan, next, at)
    expect(same.tables.map((t) => t.id)).toEqual(["1", "2", "3"])
    expect(differsFromBase(same)).toBe(false)

    const changed: FloorPlan = { ...plan, tables: [table("1", { x: 700 })] }
    const onlyBase = editBase(changed, next, at)
    expect(onlyBase.tables.map((t) => t.id)).toEqual(["1"])
    expect(onlyBase.base?.tables.map((t) => t.id)).toEqual(["1", "2", "3"])
  })

  it("guardar hoy como base fija los cambios", () => {
    const plan = withBase()
    const today: FloorPlan = { ...plan, tables: [table("1", { x: 700 })] }
    const saved = saveTodayAsBase(today, at)
    expect(differsFromBase(saved)).toBe(false)
    expect(saved.base?.tables[0].x).toBe(700)
  })

  it("vuelta automática: una vez por día, solo si está encendida", () => {
    const plan = { ...withBase(), resetDaily: true }
    const today: FloorPlan = { ...plan, tables: [table("1", { x: 700 })] }
    const reset = dailyReset(today, "2026-11-15", [], at)
    expect(reset?.resetOn).toBe("2026-11-15")
    expect(reset?.tables.map((t) => t.id)).toEqual(["1", "2"])
    expect(dailyReset({ ...today, resetOn: "2026-11-15" }, "2026-11-15", [], at)).toBeNull()
    expect(dailyReset({ ...today, resetDaily: false }, "2026-11-15", [], at)).toBeNull()
    // Sin cambios, solo se anota el día (para no deshacer a media jornada lo que se cambie después).
    const quiet = dailyReset(plan, "2026-11-15", [], at)
    expect(quiet?.resetOn).toBe("2026-11-15")
    expect(quiet?.tables).toEqual(plan.tables)
  })
})
