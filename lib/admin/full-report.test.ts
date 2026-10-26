import { describe, expect, it } from "vitest"
import { flattenForReport, formatCell, labelFor, MAX_TABLE_ROWS, REPORT_SECTIONS } from "./full-report"

describe("informe completo de /admin (docs/206)", () => {
  it("lee solo rutas GET de /admin, sin repetir", () => {
    expect(REPORT_SECTIONS.every((s) => s.url.startsWith("/api/admin/"))).toBe(true)
    expect(new Set(REPORT_SECTIONS.map((s) => s.id)).size).toBe(REPORT_SECTIONS.length)
    expect(REPORT_SECTIONS.find((s) => s.id === "accounts")?.url).toContain("all=1")
  })

  it("formatea celdas: fechas día/mes/año, punto decimal, sí/no y archivos", () => {
    expect(formatCell(true)).toBe("Sí")
    expect(formatCell(12.345)).toBe("12.35")
    expect(formatCell(null)).toBe("—")
    expect(formatCell("data:image/png;base64,AAAA")).toBe("[archivo adjunto]")
    expect(formatCell("2026-10-26T15:30:00Z")).toMatch(/^26\/10\/2026/)
    expect(formatCell(["a", "b"])).toBe("a, b")
    expect(formatCell("x".repeat(300)).length).toBeLessThanOrEqual(140)
  })

  it("nombres legibles de los campos", () => {
    expect(labelFor("email")).toBe("Correo")
    expect(labelFor("lastSeenAt")).toBe("Última vez en línea")
    expect(labelFor("ocr_reads_total")).toBe("Ocr reads total")
  })

  it("convierte datos sueltos en pares y listas en tablas, también anidadas", () => {
    const blocks = flattenForReport({
      total: 3,
      confirmed: true,
      accounts: [
        { email: "a@x.com", plan: "foodie", createdAt: "2026-10-01T10:00:00Z", extra: { recipes: 2 } },
        { email: "b@x.com", plan: "sous-chef" },
      ],
      byPlan: { foodie: 1, sous: 2 },
    })
    expect(blocks[0]).toEqual({ kind: "kv", title: null, rows: [["Total", "3"], ["Confirmed", "Sí"]] })
    const table = blocks.find((b) => b.kind === "table")
    expect(table && table.kind === "table" && table.columns).toEqual(["Correo", "Plan", "Creado", "Extra"])
    expect(table && table.kind === "table" && table.rows[0][3]).toBe("Recetas: 2")
    expect(blocks.some((b) => b.title === "By plan")).toBe(true)
  })

  it("tablas largas se cortan con el total real", () => {
    const rows = Array.from({ length: MAX_TABLE_ROWS + 5 }, (_, i) => ({ n: i }))
    const [b] = flattenForReport(rows)
    expect(b.kind === "table" && b.rows.length).toBe(MAX_TABLE_ROWS)
    expect(b.kind === "table" && b.total).toBe(MAX_TABLE_ROWS + 5)
  })
})

describe("PDF del informe completo (docs/206)", () => {
  it("arma portada, índice y una sección por fuente, también con errores y tablas largas", async () => {
    const { buildFullReportPdf } = await import("./full-report-pdf")
    const t = (k: string) => ({ admin_full_report_progress: "x" } as Record<string, string>)[k] ?? k
    const results = [
      { title: "Resumen", blocks: flattenForReport({ total: 120, confirmed: 98, byPlan: { foodie: 80, sous: 18 } }), error: null },
      { title: "Cuentas", blocks: flattenForReport({ accounts: Array.from({ length: 140 }, (_, i) => ({ email: `c${i}@x.com`, plan: "foodie", createdAt: "2026-10-01T10:00:00Z", recipes: i, businesses: 1, lastSeenAt: "2026-10-26T12:00:00Z", country: "HN", language: "es", confirmed: true, team: 0, extra: { a: 1 } })) }), error: null },
      { title: "Ingresos", blocks: [], error: "Stripe no está configurado." },
    ]
    const doc = buildFullReportPdf(results, t, new Date("2026-10-26T18:00:00Z"))
    const pages = doc.getNumberOfPages()
    expect(pages).toBeGreaterThanOrEqual(6) // portada + índice + 3 secciones (cuentas en varias páginas)
    if (process.env.REPORT_SAMPLE_OUT) {
      const fs = await import("fs")
      fs.writeFileSync(process.env.REPORT_SAMPLE_OUT, Buffer.from(doc.output("arraybuffer")))
    }
  })
})
