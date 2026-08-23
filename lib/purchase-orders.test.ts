import { describe, it, expect } from "vitest"
import { sortPurchaseOrderItemsBySupplier } from "./purchase-orders"

// Pedido explícito: la orden de compra debe listarse alfabética por proveedor (para
// poder llamar a cada proveedor de una sola vez), con los ingredientes sin proveedor
// registrado al final, también alfabético entre ellos.
describe("sortPurchaseOrderItemsBySupplier", () => {
  it("ordena alfabeticamente por proveedor", () => {
    const items = [
      { ingredientName: "Z-Item", supplier: "Proveedor B" },
      { ingredientName: "A-Item", supplier: "Proveedor A" },
    ]
    const sorted = sortPurchaseOrderItemsBySupplier(items)
    expect(sorted.map((i) => i.supplier)).toEqual(["Proveedor A", "Proveedor B"])
  })

  it("los ingredientes sin proveedor van al final, sin importar el nombre", () => {
    const items = [
      { ingredientName: "Aceite", supplier: "" },
      { ingredientName: "Zanahoria", supplier: "Proveedor Z" },
      { ingredientName: "Bacalao", supplier: undefined },
    ]
    const sorted = sortPurchaseOrderItemsBySupplier(items)
    expect(sorted.map((i) => i.ingredientName)).toEqual(["Zanahoria", "Aceite", "Bacalao"])
  })

  it("entre ingredientes sin proveedor, ordena alfabetico por nombre", () => {
    const items = [
      { ingredientName: "Zanahoria", supplier: "" },
      { ingredientName: "Aceite", supplier: "" },
    ]
    const sorted = sortPurchaseOrderItemsBySupplier(items)
    expect(sorted.map((i) => i.ingredientName)).toEqual(["Aceite", "Zanahoria"])
  })

  it("con el mismo proveedor, ordena alfabetico por nombre de ingrediente", () => {
    const items = [
      { ingredientName: "Zanahoria", supplier: "Proveedor A" },
      { ingredientName: "Aceite", supplier: "Proveedor A" },
    ]
    const sorted = sortPurchaseOrderItemsBySupplier(items)
    expect(sorted.map((i) => i.ingredientName)).toEqual(["Aceite", "Zanahoria"])
  })
})
