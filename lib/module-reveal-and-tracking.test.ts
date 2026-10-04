import { describe, it, expect, vi } from "vitest"
vi.mock("@/contexts/auth-context", () => ({ useAuth: () => ({ user: null }) }))
import { hiddenModulesFor } from "./module-reveal"
import { withEmailTracking, isClickRow, sanitizeCampaign } from "./email-tracking"

describe("revelación progresiva de módulos (docs/145)", () => {
  it("0 recetas: ocultos Reportes, Ventas y los avanzados", () => {
    expect(hiddenModulesFor(0).sort()).toEqual(["/equipo", "/estadisticas", "/inventario", "/menu-y-compras", "/menus", "/ventas"])
  })
  it("1–2 recetas: aparecen Reportes y Ventas", () => {
    expect(hiddenModulesFor(2).sort()).toEqual(["/equipo", "/inventario", "/menu-y-compras", "/menus"])
  })
  it("3 recetas: todo visible", () => {
    expect(hiddenModulesFor(3)).toEqual([])
  })
})

describe("seguimiento de clics en correos (docs/145)", () => {
  it("agrega utm sin perder parámetros existentes", () => {
    const url = withEmailTracking("https://gastrometrics.org/contacto?type=experiencia", "four_hour_experience")
    expect(url).toContain("type=experiencia")
    expect(url).toContain("utm_source=email")
    expect(url).toContain("utm_campaign=four_hour_experience")
  })
  it("los clics no cuentan como envíos y la campaña se limpia", () => {
    expect(isClickRow("click:weekly_summary")).toBe(true)
    expect(isClickRow("weekly_summary")).toBe(false)
    expect(sanitizeCampaign("low_stock")).toBe("low_stock")
    expect(sanitizeCampaign("x'; drop table")).toBeNull()
  })
})
