import { describe, it, expect } from "vitest"
import { buildPackageContentLookup, inventoryItemValue, snapshotValue, stockValue } from "./inventory-value"
import { computeCOGS } from "./sales-analytics"
import type { Ingredient } from "@/types/ingredient"
import type { InventoryItem, InventorySnapshot } from "@/types/inventory"

const ingredient = (id: string, name: string, netContent: number, originalNetContent?: number) =>
  ({
    id,
    name,
    category: "VINOS",
    unit: "mililitros",
    pricing: { purchasePrice: 20, netContent, pricePerUnit: 20 / netContent, lastUpdated: "" },
    originalNetContent,
  }) as unknown as Ingredient

const item = (over: Partial<InventoryItem>): InventoryItem => ({
  id: "wine",
  name: "Malbec",
  category: "VINOS",
  currentStock: 2250,
  minStock: 0,
  unit: "mililitros",
  price: 20,
  lastUpdated: "",
  status: "normal",
  ...over,
})

describe("valor de inventario = stock × precio del envase ÷ contenido (docs/136)", () => {
  it("3 botellas de 750 ml a $20 valen $60, no $45,000", () => {
    expect(stockValue(2250, 20, 750)).toBeCloseTo(60, 6)
  })

  it("sin contenido conocido mantiene el cálculo anterior", () => {
    expect(stockValue(5, 10, undefined)).toBe(50)
    expect(stockValue(0, 10, 750)).toBe(0)
  })

  it("usa el contenido físico del ingrediente (sin merma)", () => {
    const lookup = buildPackageContentLookup([ingredient("wine", "Malbec", 712.5, 750)])
    expect(inventoryItemValue(item({}), lookup)).toBeCloseTo(60, 6)
  })

  it("busca por nombre si el id no coincide, y cae a netContent del ítem", () => {
    const lookup = buildPackageContentLookup([ingredient("otro-id", "Malbec", 750)])
    expect(inventoryItemValue(item({}), lookup)).toBeCloseTo(60, 6)
    expect(inventoryItemValue(item({ name: "X", id: "x", netContent: 750 }), lookup)).toBeCloseTo(60, 6)
  })
})

describe("snapshotValue y COGS", () => {
  const snapshot = (date: string, quantity: number, storedTotal: number): InventorySnapshot => ({
    id: date,
    date,
    type: "final",
    modifiedItems: 1,
    totalValue: storedTotal,
    items: [{ id: "wine", name: "Malbec", category: "VINOS", quantity, unit: "mililitros", price: 20, totalPrice: 0, netContent: 750 }],
  })

  it("recalcula conteos viejos cuyo totalValue quedó multiplicado por el contenido", () => {
    expect(snapshotValue(snapshot("2026-09-01", 1500, 30000))).toBeCloseTo(40, 6)
  })

  it("COGS usa el valor recalculado: 4 botellas → 1 botella = $60 de costo", () => {
    const result = computeCOGS({
      snapshots: [snapshot("2026-09-01", 3000, 60000), snapshot("2026-09-30", 750, 15000)],
      purchaseOrders: [],
      periodStart: "2026-09-01",
      periodEnd: "2026-09-30",
      currentInventoryValue: 0,
    })
    expect(result.cogs).toBeCloseTo(60, 6)
  })
})
