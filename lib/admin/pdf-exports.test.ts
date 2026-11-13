import { describe, expect, it } from "vitest"
import { summarizePdfExports, toPdfExportRow } from "@/lib/admin/pdf-exports"

const names = new Map([["b1", "Taquería Centro"]])
const emails = new Map([
  ["u1", "uno@correo.com"],
  ["u2", "dos@correo.com"],
])

describe("PDF descargados en /admin (docs/291)", () => {
  it("lee el documento, la versión, el negocio y la cuenta de cada descarga", () => {
    const row = toPdfExportRow(
      { user_id: "u1", business_id: "b1", entity_label: "recipe", metadata: { name: "Hamburguesa clásica", variant: "administrative" }, created_at: "2026-11-12T10:00:00Z" },
      names,
      emails,
    )
    expect(row).toEqual({
      at: "2026-11-12T10:00:00Z",
      kind: "recipe",
      name: "Hamburguesa clásica",
      variant: "administrative",
      businessId: "b1",
      businessName: "Taquería Centro",
      userId: "u1",
      email: "uno@correo.com",
    })
  })

  it("las descargas de antes (sin nombre) y del espacio principal también salen", () => {
    const row = toPdfExportRow({ user_id: "u2", business_id: null, entity_label: null, metadata: null, created_at: "2026-10-01T10:00:00Z" }, names, emails)
    expect(row).toMatchObject({ kind: "other", name: null, variant: null, businessName: null, email: "dos@correo.com" })
  })

  it("resume cuántos, de cuántas cuentas, por tipo y quién descargó más", () => {
    const r = (userId: string, kind: string) => ({ at: "", kind, name: null, variant: null, businessId: null, businessName: null, userId, email: emails.get(userId) ?? null })
    const s = summarizePdfExports([r("u1", "recipe"), r("u1", "recipe"), r("u1", "menu"), r("u2", "recipe")])
    expect(s.total).toBe(4)
    expect(s.accounts).toBe(2)
    expect(s.byKind).toEqual([
      { kind: "recipe", count: 3 },
      { kind: "menu", count: 1 },
    ])
    expect(s.topAccount).toEqual({ userId: "u1", email: "uno@correo.com", count: 3 })
    expect(summarizePdfExports([]).topAccount).toBeNull()
  })
})
