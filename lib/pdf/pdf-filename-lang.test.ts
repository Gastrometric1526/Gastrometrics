import { describe, it, expect, afterEach } from "vitest"
import { generateInvoicePDFFilename } from "./invoice-pdf-generator"
import { generateSalesHistoryPDFFilename } from "./sales-history-pdf-generator"

// docs/209: los nombres de archivo de factura e historial salían en español en los 6 idiomas.
afterEach(() => localStorage.removeItem("app_language"))

describe("nombres de archivo en el idioma del PDF (docs/209)", () => {
  const invoice = { number: "F-0007", issueDate: "2026-10-28" } as never
  it("factura", () => {
    localStorage.setItem("app_language", "en")
    expect(generateInvoicePDFFilename(invoice)).toBe("Invoice_F_0007_28-10-2026.pdf")
    localStorage.setItem("app_language", "zh")
    expect(generateInvoicePDFFilename(invoice)).toBe("发票_F_0007_28-10-2026.pdf")
  })
  it("historial de ventas", () => {
    localStorage.setItem("app_language", "pt")
    expect(generateSalesHistoryPDFFilename("month")).toMatch(/^Histórico_de_vendas_Mês_\d{2}-\d{2}-\d{4}\.pdf$/)
    localStorage.setItem("app_language", "es")
    expect(generateSalesHistoryPDFFilename("week")).toMatch(/^Historial_de_ventas_Semana_/)
  })
})
