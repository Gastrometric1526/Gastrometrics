import { describe, it, expect, vi } from "vitest"

vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdminClient: () => ({}) }))

import { parseSnapshotFileName, restoreAllowed, snapshotFileName, snapshotsOverBudget, snapshotsToPrune, type SnapshotInfo } from "./account-snapshots"

// docs/229: respaldos por cuenta. El nombre del archivo lleva fecha, motivo y conteos para
// que /admin liste sin abrir el contenido.
describe("account-snapshots: nombres y retención", () => {
  const base = { reason: "daily" as const, hash: "0123456789ab", counts: { ingredients: 12, recipes: 4, businesses: 1, menus: 2, inventory: 7 } }

  it("el nombre se puede leer de vuelta", () => {
    const name = snapshotFileName({ ...base, createdAt: "2026-11-02T10:05:09.123Z" })
    expect(name).toBe("20261102T100509Z_daily_0123456789ab_12.4.1.2.7.json.gz")
    const info = parseSnapshotFileName("acc", name)
    expect(info).toEqual({ ...base, createdAt: "2026-11-02T10:05:09Z", path: `acc/${name}` })
    expect(parseSnapshotFileName("acc", "20261102T100509Z_before_restore_0123456789ab_1.1.1.1.1.json.gz")?.reason).toBe("before_restore")
    expect(parseSnapshotFileName("acc", "otro-archivo.json")).toBeNull()
  })

  const day = 86_400_000
  const now = Date.parse("2026-11-30T00:00:00Z")
  const ago = (days: number, reason: SnapshotInfo["reason"] = "daily"): SnapshotInfo => ({
    ...base,
    reason,
    createdAt: new Date(now - days * day).toISOString(),
    path: `acc/${days}-${reason}`,
  })
  const pruned = (list: SnapshotInfo[], at = now) => snapshotsToPrune(list, at).map((s) => s.path)

  it("guarda todos los de 14 días", () => {
    const list = Array.from({ length: 14 }, (_, i) => ago(i + 0.5))
    expect(pruned(list)).toEqual([])
  })

  it("de 14 a 90 días queda uno por semana", () => {
    const list = [...Array.from({ length: 5 }, (_, i) => ago(i)), ago(20), ago(21), ago(22), ago(30)]
    const out = pruned(list)
    // 20 días es la semana 2; 21 y 22, la semana 3: queda uno de cada semana.
    expect(out).toEqual(["acc/22-daily"])
    expect(out).not.toContain("acc/30-daily")
  })

  it("de 90 a 180 días queda uno por mes y nada pasa de 180", () => {
    const list = [...Array.from({ length: 5 }, (_, i) => ago(i)), ago(100), ago(110), ago(150), ago(181)]
    const out = pruned(list)
    expect(out).toContain("acc/110-daily") // mismo mes que 100
    expect(out).not.toContain("acc/100-daily")
    expect(out).not.toContain("acc/150-daily")
    expect(out).toContain("acc/181-daily")
  })

  it("con el tope de espacio borra primero los diarios viejos y nunca el más nuevo de cada cuenta", () => {
    const mb = 1024 * 1024
    const at = (acc: string, days: number, reason: SnapshotInfo["reason"] = "daily"): SnapshotInfo => ({ ...ago(days, reason), path: `${acc}/${days}-${reason}`, size: mb })
    const list = [at("a", 1), at("a", 50), at("a", 60, "before_wipe"), at("b", 100), at("c", 2)]
    expect(snapshotsOverBudget(list, 5 * mb)).toEqual([])
    expect(snapshotsOverBudget(list, 4 * mb).map((s) => s.path)).toEqual(["a/50-daily"])
    expect(snapshotsOverBudget(list, 2 * mb).map((s) => s.path)).toEqual(["a/50-daily", "a/60-before_wipe"])
    // b/100 es el único de su cuenta: se queda aunque no alcance.
    expect(snapshotsOverBudget(list, 0).map((s) => s.path)).toEqual(["a/50-daily", "a/60-before_wipe"])
  })

  it("lo de antes de borrar o restaurar queda los 180 días, aunque haya otros esa semana", () => {
    const list = [...Array.from({ length: 5 }, (_, i) => ago(i)), ago(40), ago(41, "before_wipe"), ago(170, "before_delete"), ago(190, "before_restore")]
    const out = pruned(list)
    expect(out).not.toContain("acc/41-before_wipe")
    expect(out).not.toContain("acc/170-before_delete")
    expect(out).toContain("acc/190-before_restore")
  })

  it("los 5 más nuevos quedan aunque sean de la misma semana vieja", () => {
    const list = [ago(60), ago(61), ago(62), ago(63), ago(64), ago(65)]
    expect(pruned(list)).toEqual(["acc/65-daily"])
  })

  it("una cuenta eliminada se queda sin nada a los 180 días", () => {
    const list = [ago(10, "before_delete"), ago(12)]
    expect(pruned(list, now + 200 * day)).toHaveLength(2)
  })
})

describe("account-snapshots: cuándo se puede restaurar (docs/252)", () => {
  const snap = (reason: SnapshotInfo["reason"]): SnapshotInfo => ({ reason, hash: "0123456789ab", counts: { ingredients: 0, recipes: 0, businesses: 0, menus: 0, inventory: 0 }, createdAt: "2026-11-01T00:00:00Z", path: "x" })
  it("solo si borró su contenido, pidió eliminarse o ya no existe", () => {
    expect(restoreAllowed({ exists: true, deletionRequested: false, snapshots: [snap("daily"), snap("manual")] })).toBe(false)
    expect(restoreAllowed({ exists: true, deletionRequested: false, snapshots: [snap("before_wipe")] })).toBe(true)
    expect(restoreAllowed({ exists: true, deletionRequested: true, snapshots: [] })).toBe(true)
    expect(restoreAllowed({ exists: false, deletionRequested: false, snapshots: [] })).toBe(true)
  })
})
