import { describe, expect, it } from "vitest"
import { buildBackupReadme } from "./backup-readme"

describe("LEEME del respaldo (docs/223)", () => {
  it("lista fecha, moneda, versión, cantidades y lo que no incluye", () => {
    const text = buildBackupReadme({
      language: "es",
      exportedAt: "2026-11-01T10:30:00.000Z",
      currency: "DKK",
      formatVersion: 2,
      counts: [{ label: "main", ingredients: 2, recipes: 1, menus: 1, inventory: 8, purchaseOrders: 2, invoices: 1, salesImports: 2, recipePdfs: 1, menuPdfs: 1 }],
    })
    expect(text).toContain("Moneda: DKK")
    expect(text).toContain("Versión del formato: 2")
    expect(text).toContain("Principal")
    expect(text).toContain("Productos de inventario: 8")
    expect(text).toContain("Contraseñas")
    expect(text).toMatch(/01\/11\/2026/)
  })
})
