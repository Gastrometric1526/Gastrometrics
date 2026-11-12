import { describe, expect, it } from "vitest"
import { applyStockLoss, lossesByReason, lostAfter, sumLosses } from "./stock-losses"
import { computeStockControl } from "./stock-control"
import { computeTheoreticalStock, type TheoreticalStockEntry } from "./theoretical-stock"
import type { InventoryItem, InventorySnapshot } from "@/types/inventory"

const base = (extra: Partial<InventoryItem> = {}): InventoryItem => ({
  id: "ron",
  name: "Ron",
  category: "DESTILADOS",
  currentStock: 3000,
  minStock: 750,
  unit: "ml",
  price: 300,
  netContent: 750,
  lastUpdated: "",
  status: "normal",
  ...extra,
})

describe("pérdidas registradas a mano (docs/283)", () => {
  it("resta del stock, guarda el motivo y recalcula el estado", () => {
    const patch = applyStockLoss(base(), { quantity: 2400, reason: "broken", note: "  Se cayó una caja  ", at: "2026-11-12T10:00:00.000Z" })!
    expect(patch.currentStock).toBe(600)
    expect(patch.status).toBe("critical")
    expect(patch.stockLosses).toEqual([{ quantity: 2400, at: "2026-11-12T10:00:00.000Z", reason: "broken", note: "Se cayó una caja" }])
  })

  it("no deja el stock en negativo y rechaza cantidades o motivos que no valen", () => {
    expect(applyStockLoss(base({ currentStock: 100 }), { quantity: 500, reason: "spill" })?.currentStock).toBe(0)
    expect(applyStockLoss(base(), { quantity: 0, reason: "spill" })).toBeNull()
    expect(applyStockLoss(base(), { quantity: -5, reason: "spill" })).toBeNull()
    expect(applyStockLoss(base(), { quantity: Number.NaN, reason: "spill" })).toBeNull()
    expect(applyStockLoss(base(), { quantity: 10, reason: "robo" as never })).toBeNull()
    expect(applyStockLoss(base({ currentStock: 0 }), { quantity: 10, reason: "spill" })).toBeNull()
  })

  it("suma por motivo y después de un momento", () => {
    const losses = [
      { quantity: 50, at: "2026-11-10T10:00:00.000Z", reason: "spill" as const },
      { quantity: 30, at: "2026-11-11T10:00:00.000Z", reason: "spill" as const },
      { quantity: 45, at: "2026-11-11T12:00:00.000Z", reason: "courtesy" as const },
    ]
    expect(lossesByReason(losses)).toEqual({ spill: 80, courtesy: 45 })
    expect(sumLosses(lossesByReason(losses))).toBe(125)
    expect(lostAfter({ stockLosses: losses }, "2026-11-10T12:00:00.000Z")).toBe(75)
  })
})

function snap(date: string, quantity: number, lost?: Record<string, number>): InventorySnapshot {
  return {
    id: date,
    date,
    type: "final",
    modifiedItems: 1,
    totalValue: 0,
    items: [{ id: "ron", name: "Ron", category: "DESTILADOS", quantity, unit: "ml", price: 300, totalPrice: 0, ...(lost ? { lostSincePrevious: lost } : {}) }],
  }
}

describe("stock teórico y diferencia con pérdidas (docs/283)", () => {
  it("el stock teórico resta las pérdidas registradas después del conteo", () => {
    const counted = base({ currentStock: 2900, stockCountedAt: "2026-11-10T08:00:00.000Z", stockLosses: [{ quantity: 100, at: "2026-11-10T20:00:00.000Z", reason: "spill" }] })
    const r = computeTheoreticalStock({ items: [counted], snapshots: [], salesImports: [], recipes: [], ingredients: [], menus: [] }).get("ron")!
    // El conteo fue 3000 (el stock actual ya restó los 100 derramados).
    expect(r.baseline).toBe(3000)
    expect(r.lost).toBe(100)
    expect(r.theoretical).toBe(2900)
  })

  it("en el conteo, lo explicado por pérdidas deja de contar como faltante", () => {
    const snapshots = [snap("2026-11-01T08:00:00.000Z", 3000), snap("2026-11-08T08:00:00.000Z", 2500, { spill: 150, courtesy: 50 })]
    const r = computeTheoreticalStock({ items: [base()], snapshots, salesImports: [], recipes: [], ingredients: [], menus: [] }).get("ron")!
    // Esperado: 3000 − 200 de pérdidas = 2800; contado 2500 → faltan 300 sin explicar (no 500).
    expect(r.lastCountLost).toBe(200)
    expect(r.lastCountVariance).toBeCloseTo(-300)
  })
})

describe("control de faltantes y pérdidas (docs/283)", () => {
  const entry = (variance: number | null): TheoreticalStockEntry => ({ baseline: 0, baselineAt: "", consumed: 0, received: 0, lost: 0, theoretical: 0, lastCountVariance: variance, lastCountLost: 0 })

  it("valora el faltante y las pérdidas al precio del envase y separa la barra", () => {
    const ron = base({ stockLosses: [{ quantity: 75, at: "2026-11-11T10:00:00.000Z", reason: "courtesy" }] })
    const harina = { ...base(), id: "harina", name: "Harina", category: "HARINAS", unit: "g", price: 20, netContent: 1000, stockLosses: [] }
    const theoretical = new Map([
      ["ron", entry(-300)],
      ["harina", entry(200)],
    ])
    const all = computeStockControl([ron, harina], theoretical)
    // Ron: 300 ml faltantes × (300 ÷ 750) = 120; pérdida 75 ml = 30.
    expect(all.shortageValue).toBeCloseTo(120)
    expect(all.lostValue).toBeCloseTo(30)
    expect(all.lostByReason.courtesy).toBeCloseTo(30)
    // Harina: 200 g de más × (20 ÷ 1000) = 4 de sobrante.
    expect(all.surplusValue).toBeCloseTo(4)
    expect(all.rows[0].id).toBe("ron")
    expect(all.hasBar).toBe(true)
    expect(all.measured).toBe(2)
    const bar = computeStockControl([ron, harina], theoretical, undefined, { onlyBar: true })
    expect(bar.rows.map((r) => r.id)).toEqual(["ron"])
  })

  it("sin dos conteos ni pérdidas, el producto no sale", () => {
    const r = computeStockControl([base()], new Map([["ron", entry(null)]]))
    expect(r.rows).toEqual([])
    expect(r.measured).toBe(0)
  })
})
