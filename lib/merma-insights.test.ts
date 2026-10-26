import { describe, expect, it } from "vitest"
import { mermaInsights } from "./merma-insights"
import type { Ingredient } from "@/types/ingredient"
import type { PriceObservation } from "./supplier-insights"

const now = Date.UTC(2026, 9, 25)
const merma = (over: Partial<NonNullable<Ingredient["merma"]>>) => ({ enabled: true, useGlobal: true, globalPercentage: 0, customType: "percentage" as const, customPercentage: 0, customValue: 0, ...over })

// Pollo 10 kg a L 600, merma personalizada 20 % ya aplicada (8 kg aprovechables).
const pollo = { id: "pollo", name: "Pollo", category: "AVES", unit: "kilogramos", originalNetContent: 10, merma: merma({ useGlobal: false, customPercentage: 20 }), pricing: { purchasePrice: 600, netContent: 8, pricePerUnit: 75, lastUpdated: "" } } as unknown as Ingredient
// Lechuga con merma global de su categoría (VEGETAL 21 %), sin aplicar todavía en el contenido.
const lechuga = { id: "lech", name: "Lechuga", category: "VEGETAL", unit: "unidad", merma: merma({}), pricing: { purchasePrice: 100, netContent: 10, pricePerUnit: 10, lastUpdated: "" } } as unknown as Ingredient
// Cebolla sin merma activa: categoría con merma alta → sugerencia.
const cebolla = { id: "ceb", name: "Cebolla", category: "VEGETAL", unit: "kilogramos", pricing: { purchasePrice: 30, netContent: 1, pricePerUnit: 30, lastUpdated: "" } } as unknown as Ingredient

const obs = (ingredientId: string, quantity: number, daysAgo: number): PriceObservation => ({
  key: ingredientId, ingredientId, name: ingredientId, unit: "", supplier: null, pricePerUnit: 1, date: new Date(now - daysAgo * 86_400_000).toISOString(), source: "order", quantity,
})

describe("información de merma (docs/202)", () => {
  const m = mermaInsights([pollo, lechuga, cebolla], [obs("pollo", 30, 10), obs("pollo", 99, 200)], now)

  it("usa la merma personalizada o la global de la categoría", () => {
    const p = m.rows.find((r) => r.ingredientId === "pollo")!
    expect(p.mode).toBe("custom")
    expect(p.percent).toBeCloseTo(20)
    expect(p.lostPerPurchase).toBeCloseTo(120)
    expect(p.pricePerBoughtUnit).toBeCloseTo(60)
    expect(p.pricePerUsableUnit).toBeCloseTo(75)
    const l = m.rows.find((r) => r.ingredientId === "lech")!
    expect(l.mode).toBe("global")
    expect(l.percent).toBeCloseTo(21)
  })

  it("estima el costo al mes con lo comprado en 90 días", () => {
    const p = m.rows.find((r) => r.ingredientId === "pollo")!
    // 30 kg en 90 días → 10 kg/mes × L 60 × 20 % = L 120
    expect(p.monthlyCost).toBeCloseTo(120)
    expect(m.monthlyCost).toBeCloseTo(120)
    expect(m.withMerma).toBe(2)
  })

  it("sugiere activar merma en categorías que suelen tenerla", () => {
    expect(m.suggestions.map((s) => s.name)).toEqual(["Cebolla"])
  })
})
