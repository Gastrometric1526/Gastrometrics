import { describe, expect, it } from "vitest"
import { orderSuppliers, splitOrderBySupplier } from "./purchase-order-split"

const order = {
  orderNumber: "OC-100",
  supplier: "",
  subtotal: 300,
  tax: 45,
  total: 345,
  items: [
    { name: "Tomate", supplier: "Mercado Central", totalPrice: 100 },
    { name: "Queso", supplier: "Lácteos Sula", totalPrice: 150 },
    { name: "Cebolla", supplier: "mercado central", totalPrice: 20 },
    { name: "Sal", supplier: "", totalPrice: 30 },
  ],
}

describe("una orden de compra por proveedor (docs/264)", () => {
  it("cuenta los proveedores sin distinguir mayúsculas", () => {
    expect(orderSuppliers(order)).toEqual(["Mercado Central", "Lácteos Sula", ""])
  })

  it("parte la orden con su subtotal y el impuesto en proporción", () => {
    const parts = splitOrderBySupplier(order, "Sin proveedor")
    expect(parts.map((p) => p.supplier)).toEqual(["Mercado Central", "Lácteos Sula", "Sin proveedor"])
    expect(parts.map((p) => p.orderNumber)).toEqual(["OC-100-1", "OC-100-2", "OC-100-3"])
    expect(parts[0].items.map((i) => i.name)).toEqual(["Tomate", "Cebolla"])
    expect(parts.map((p) => p.subtotal)).toEqual([120, 150, 30])
    // 45 × 120/300 = 18, 45 × 150/300 = 22.5, el resto 4.5
    expect(parts.map((p) => p.tax)).toEqual([18, 22.5, 4.5])
    expect(parts.reduce((s, p) => s + p.total, 0)).toBeCloseTo(345)
  })

  it("con un solo proveedor no cambia nada", () => {
    const one = { ...order, items: [order.items[0], order.items[2]] }
    expect(splitOrderBySupplier(one, "Sin proveedor")).toEqual([one])
  })
})
