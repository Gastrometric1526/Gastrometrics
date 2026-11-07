import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/storage/businesses", () => ({ getBusinessById: () => undefined, updateBusiness: async () => true }))
vi.mock("@/lib/plan-access", () => ({ getCurrentPlanSlug: () => "foodie", hasActiveMembership: () => false }))
vi.mock("@/lib/supabase/client", () => ({ getSupabaseBrowserClient: () => ({}) }))

import { jsPDF } from "jspdf"
import { drawFiscalBlock, fiscalLines } from "./pdf-fiscal"
import { isWhiteLabelPdf, normalizePdfBranding, pdfMenuFont, setMainPdfBranding } from "./pdf-branding"

describe("datos fiscales de los PDF", () => {
  it("sin datos no hay líneas", () => {
    expect(fiscalLines(undefined, "ID fiscal")).toEqual([])
    expect(fiscalLines({}, "ID fiscal")).toEqual([])
  })

  it("arma las líneas con lo que haya", () => {
    const full = { legalName: "La Terraza S. de R. L.", taxId: "08011999123456", address: "Col. Palmira", phone: "2222-3333", email: "a@b.hn" }
    expect(fiscalLines(full, "ID fiscal")).toEqual(["La Terraza S. de R. L.", "ID fiscal: 08011999123456 · Col. Palmira", "2222-3333 · a@b.hn"])
    expect(fiscalLines({ phone: "2222-3333" }, "ID fiscal")).toEqual(["2222-3333"])
  })

  it("sin líneas no dibuja ni mueve el contenido", () => {
    expect(drawFiscalBlock(new jsPDF(), { lines: [], title: "Datos", x: 14, y: 32, width: 180 })).toBe(32)
  })

  it("con líneas baja el contenido", () => {
    expect(drawFiscalBlock(new jsPDF(), { lines: ["Uno", "Dos"], title: "Datos", x: 14, y: 32, width: 180 })).toBeGreaterThan(40)
  })

  it("limpia y recorta lo guardado, y descarta campos desconocidos", () => {
    const branding = normalizePdfBranding({
      fiscal: { legalName: "  La   Terraza ", taxId: "x".repeat(99), otro: "no", phone: 5 },
      menuFont: "rara",
    })
    expect(branding.fiscal?.legalName).toBe("La Terraza")
    expect(branding.fiscal?.taxId).toHaveLength(40)
    expect(branding.fiscal).not.toHaveProperty("otro")
    expect(branding.fiscal).not.toHaveProperty("phone")
    expect(branding).not.toHaveProperty("menuFont")
    expect(normalizePdfBranding({ fiscal: { legalName: " " } })).toEqual({})
  })

  it("la carta es clásica salvo que se elija la moderna", () => {
    setMainPdfBranding({})
    expect(pdfMenuFont()).toBe("times")
    setMainPdfBranding({ menuFont: "moderna" })
    expect(pdfMenuFont()).toBe("helvetica")
  })

  it("los datos fiscales no quitan la marca GastroMetrics", () => {
    expect(isWhiteLabelPdf("negocio")).toBe(false)
  })
})
