/**
 * Arma el PDF del informe completo de /admin (docs/206) a partir de las secciones ya leídas.
 * Separado del botón (components/admin/full-report-button.tsx) para poder probarlo.
 */
import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import { formatDateTime } from "@/lib/date-format"
import type { ReportBlock } from "./full-report"

export interface ReportSectionResult {
  title: string
  blocks: ReportBlock[]
  error: string | null
}

const ORANGE: [number, number, number] = [240, 83, 36]
const INK: [number, number, number] = [18, 18, 18]
const MUTED: [number, number, number] = [110, 110, 110]

export function buildFullReportPdf(results: ReportSectionResult[], t: (key: string) => string, now = new Date()): jsPDF {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const M = 40

  // Portada
  doc.setFillColor(...ORANGE)
  doc.rect(0, 0, W, 8, "F")
  doc.setTextColor(...INK)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(30)
  doc.text("GastroMetrics", M, 120)
  doc.setFontSize(18)
  doc.setFont("helvetica", "normal")
  doc.text(t("admin_full_report_title"), M, 150)
  doc.setFontSize(11)
  doc.setTextColor(...MUTED)
  doc.text(t("admin_full_report_generated").replace("{date}", formatDateTime(now)), M, 180)
  doc.text(t("admin_full_report_sections").replace("{n}", String(results.length)), M, 198)
  doc.setTextColor(...INK)
  doc.text(doc.splitTextToSize(t("admin_full_report_privacy"), W - 2 * M), M, 240)

  // Secciones (el índice se arma al final y se mueve a la página 2).
  const sectionPages: number[] = []
  const tableRows = (b: Extract<ReportBlock, { kind: "table" }>) => b.rows
  results.forEach((r, idx) => {
    doc.addPage()
    sectionPages.push(doc.getNumberOfPages())
    doc.setFont("helvetica", "bold")
    doc.setFontSize(16)
    doc.setTextColor(...INK)
    doc.text(`${idx + 1}. ${r.title}`, M, M + 10)
    doc.setDrawColor(...ORANGE)
    doc.setLineWidth(1.5)
    doc.line(M, M + 18, W - M, M + 18)
    let y = M + 34
    if (r.error) {
      doc.setFont("helvetica", "normal")
      doc.setFontSize(10)
      doc.setTextColor(...MUTED)
      doc.text(t("admin_full_report_section_error").replace("{error}", r.error), M, y)
      return
    }
    if (!r.blocks.length) {
      doc.setFont("helvetica", "normal")
      doc.setFontSize(10)
      doc.setTextColor(...MUTED)
      doc.text(t("admin_full_report_empty"), M, y)
      return
    }
    for (const b of r.blocks) {
      if (y > H - 80) {
        doc.addPage()
        y = M
      }
      if (b.title) {
        doc.setFont("helvetica", "bold")
        doc.setFontSize(10.5)
        doc.setTextColor(...INK)
        doc.text(b.title, M, y + 4)
        y += 10
      }
      const isTable = b.kind === "table"
      autoTable(doc, {
        startY: y + 2,
        margin: { left: M, right: M },
        head: isTable ? [b.columns] : undefined,
        body: isTable ? tableRows(b) : b.rows.map(([k, v]) => (k ? [k, v] : [v])),
        theme: isTable ? "striped" : "plain",
        styles: { font: "helvetica", fontSize: isTable && b.columns.length > 7 ? 6.5 : 8, cellPadding: 3, overflow: "linebreak", textColor: INK },
        headStyles: { fillColor: [245, 245, 245], textColor: INK, fontStyle: "bold" },
        columnStyles: isTable ? {} : { 0: { fontStyle: "bold", cellWidth: 220 } },
      })
      // @ts-expect-error lastAutoTable lo agrega jspdf-autotable
      y = (doc.lastAutoTable?.finalY ?? y) + 12
      if (isTable && b.total > b.rows.length) {
        doc.setFont("helvetica", "italic")
        doc.setFontSize(8)
        doc.setTextColor(...MUTED)
        doc.text(t("admin_full_report_truncated").replace("{shown}", String(b.rows.length)).replace("{total}", String(b.total)), M, y)
        y += 14
      }
    }
  })

  // Índice con número de página, movido justo después de la portada.
  doc.addPage()
  doc.setFont("helvetica", "bold")
  doc.setFontSize(16)
  doc.setTextColor(...INK)
  doc.text(t("admin_full_report_toc"), M, M + 10)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(11)
  results.forEach((r, idx) => {
    const y = M + 40 + idx * 20
    doc.text(`${idx + 1}. ${r.title}`, M, y)
    // +1 porque el índice entra como página 2 y corre todo una página.
    doc.text(String(sectionPages[idx] + 1), W - M, y, { align: "right" })
  })
  doc.movePage(doc.getNumberOfPages(), 2)

  // Pie con número de página.
  const total = doc.getNumberOfPages()
  for (let p = 2; p <= total; p++) {
    doc.setPage(p)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(8)
    doc.setTextColor(...MUTED)
    doc.text(`GastroMetrics · ${t("admin_full_report_title")} · ${formatDateTime(now)}`, M, H - 18)
    doc.text(`${p} / ${total}`, W - M, H - 18, { align: "right" })
  }
  return doc
}
