import { describe, it, expect } from "vitest"
import { summarizeImports } from "./import-summary"

describe("resumen de importaciones para /admin (docs/211)", () => {
  it("separa ingredientes, recetas y otras, con Excel, filas, precios y cuentas", () => {
    const s = summarizeImports([
      { email: "a@x.test", kind: "ingredientes", format: "excel", count: 120, updated: 0 },
      { email: "a@x.test", kind: "ingredientes", format: "foto", count: 0, updated: 8 }, // ticket que solo actualizó precios
      { email: "b@x.test", kind: "ingredientes", format: "csv", count: 30 },
      { email: "a@x.test", kind: "recetas", format: "excel", count: 1, newIngredients: 4 },
      { email: "c@x.test", kind: "recetas", format: "texto", count: 1, newIngredients: 0 },
      { email: "c@x.test", kind: "inventario", format: "pdf", count: 25 },
      { email: "c@x.test", kind: "estadisticas", format: "excel", count: 60 },
    ])
    expect(s.ingredientes).toEqual({ imports: 3, excel: 2, rows: 150, updated: 8, newIngredients: 0, accounts: 2 })
    expect(s.recetas).toEqual({ imports: 2, excel: 1, rows: 2, updated: 0, newIngredients: 4, accounts: 2 })
    expect(s.otras).toEqual({ imports: 2, excel: 1, rows: 85, updated: 0, newIngredients: 0, accounts: 1 })
  })
})
