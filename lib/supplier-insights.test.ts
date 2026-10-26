import { describe, expect, it } from "vitest"
import { cleanSupplier, collectPriceObservations, summarizeIngredients, summarizeSuppliers } from "./supplier-insights"
import type { Ingredient } from "@/types/ingredient"
import type { PurchaseOrder } from "@/types/purchase-order"
import type { InventorySnapshot } from "@/types/inventory"

const now = Date.UTC(2026, 9, 25)
const daysAgo = (d: number) => new Date(now - d * 86_400_000).toISOString()

const tomato = { id: "tom", name: "Tomate", unit: "kilogramos", supplier: "Mercado A", pricing: { pricePerUnit: 42, purchasePrice: 42, netContent: 1, lastUpdated: daysAgo(1) } } as unknown as Ingredient
const order = (id: string, supplier: string, price: number, qty: number, date: string, status?: PurchaseOrder["status"]): PurchaseOrder =>
  ({ id, name: id, number: 1, date, recipes: [], total: price * qty, status, items: [{ ingredientId: "tom", name: "Tomate", totalQuantity: qty, unit: "kilogramos", costPerUnit: price, purchaseCost: price * qty, quantityToBuy: qty, supplier }] }) as PurchaseOrder

const orders = [
  order("o1", "Mercado A", 30, 10, daysAgo(60)),
  order("o2", "Mercado A", 42, 10, daysAgo(5)),
  order("o3", "Distribuidora B", 36, 6, daysAgo(10)),
  order("o4", "Caro C", 99, 1, daysAgo(3), "cancelled"),
]
const snapshots = [
  { id: "s1", date: daysAgo(20), type: "purchase", modifiedItems: 1, totalValue: 0, items: [{ id: "tom", name: "Tomate", category: "", quantity: 4, unit: "kilogramos", price: 152, totalPrice: 0, netContent: 4, priceAtDate: 152, supplier: "Distribuidora B" }] },
] as unknown as InventorySnapshot[]

describe("precios y proveedores (docs/202)", () => {
  const obs = collectPriceObservations({ ingredients: [tomato], orders, snapshots, changes: [{ ingredientId: "tom", ingredientName: "Tomate", oldPrice: 30, newPrice: 42, timestamp: daysAgo(5) }], now: daysAgo(0) })
  const [sum] = summarizeIngredients(obs, now)

  it("junta órdenes (sin las canceladas), compras de inventario, cambios y el precio actual", () => {
    expect(obs.filter((o) => o.source === "order")).toHaveLength(3)
    expect(obs.find((o) => o.source === "purchase")?.pricePerUnit).toBe(38) // 152 ÷ 4 kg
    expect(obs.some((o) => o.supplier === "Caro C")).toBe(false)
  })

  it("historial, cambio total y de 30 días", () => {
    expect(sum.firstPrice).toBe(30)
    expect(sum.lastPrice).toBe(42)
    expect(Math.round(sum.changePercent)).toBe(40)
    expect(sum.change30Percent).not.toBeNull()
  })

  it("compara proveedores y estima el ahorro", () => {
    expect(sum.suppliers.map((s) => s.supplier)).toEqual(["Distribuidora B", "Mercado A"])
    expect(sum.currentSupplier).toBe("Mercado A")
    expect(sum.cheapest?.supplier).toBe("Distribuidora B")
    expect(Math.round(sum.savingPercent)).toBe(14) // (42 − 36) ÷ 42
    // 90 días: órdenes 10 + 10 + 6 y compra 4 = 30 kg → 10 kg/mes × L 6 = L 60
    expect(Math.round(sum.monthlySaving)).toBe(60)
  })

  it("resumen por proveedor con gasto en órdenes", () => {
    const sups = summarizeSuppliers(obs, orders, [sum])
    expect(sups[0]).toMatchObject({ supplier: "Mercado A", spend: 720, orders: 2 })
    expect(sups.find((s) => s.supplier === "Distribuidora B")?.cheapestFor).toBe(1)
  })

  it("proveedores sin nombre no cuentan", () => {
    expect(cleanSupplier("No especificado")).toBeNull()
    expect(cleanSupplier("  Mercado A ")).toBe("Mercado A")
  })
})
