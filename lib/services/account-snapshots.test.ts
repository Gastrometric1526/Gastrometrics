import { describe, it, expect, vi } from "vitest"

vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdminClient: () => ({}) }))

import { parseSnapshotFileName, snapshotFileName, snapshotsToPrune, type SnapshotInfo } from "./account-snapshots"

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

  it("quedan los 5 más nuevos y los de antes de borrar/restaurar de los últimos 30 días", () => {
    const now = Date.parse("2026-11-30T00:00:00Z")
    const mk = (day: number, reason: SnapshotInfo["reason"]): SnapshotInfo => ({
      ...base,
      reason,
      createdAt: `2026-11-${String(day).padStart(2, "0")}T00:00:00Z`,
      path: `acc/${day}-${reason}`,
    })
    const list = [mk(29, "daily"), mk(28, "daily"), mk(27, "daily"), mk(26, "daily"), mk(25, "daily"), mk(24, "daily"), mk(20, "before_wipe"), mk(1, "before_restore")]
    const pruned = snapshotsToPrune(list, now).map((s) => s.path)
    expect(pruned).toContain("acc/24-daily")
    expect(pruned).not.toContain("acc/20-before_wipe")
    expect(pruned).not.toContain("acc/1-before_restore") // 29 días: todavía protegido
    expect(snapshotsToPrune(list, now + 2 * 86_400_000).map((s) => s.path)).toContain("acc/1-before_restore")
  })
})
