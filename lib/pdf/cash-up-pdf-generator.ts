import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import { formatCurrency } from "@/lib/currency"
import { getPdfLabels, type PdfLabels } from "@/lib/i18n/pdf-labels"
import { getBusinessThemeRgb } from "@/lib/theme-colors"
import { safeFilePart } from "./pdf-filename"
import { drawBusinessLogo } from "./pdf-logo"
import { computeCashUp, type CashUpMethod, type CashUpResult } from "@/lib/cash-up"
import type { CashUp, SalesImport } from "@/types/sales-import"
import { fileDate, formatDate, formatDateTime } from "@/lib/date-format"

// Cuadre de caja en PDF (docs/217): la hoja que se imprime o se manda al cerrar el día.
// Mismo encabezado y pie que el resto de lib/pdf/.

const COLORS = {
  primary: [41, 98, 255] as [number, number, number],
  secondary: [100, 100, 100] as [number, number, number],
  text: [40, 40, 40] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  tableHeader: [51, 51, 51] as [number, number, number],
  tableBorder: [200, 200, 200] as [number, number, number],
  highlightBg: [240, 248, 255] as [number, number, number],
  positive: [21, 128, 61] as [number, number, number],
  negative: [185, 28, 28] as [number, number, number],
  warning: [161, 98, 7] as [number, number, number],
}

export interface CashUpPDFOptions {
  businessName?: string
  businessLogo?: string
  businessId?: string
  /** Día del registro (YYYY-MM-DD). */
  day: string
}

const clean = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim()

export function methodLabel(labels: PdfLabels, method: CashUpMethod): string {
  return method === "cash" ? labels.efectivo : method === "card" ? labels.tarjeta : labels.transferencia
}

export function statusLabel(labels: PdfLabels, status: CashUpResult["status"]): string {
  switch (status) {
    case "balanced":
      return labels.estadoCuadrado
    case "short":
      return labels.estadoFaltante
    case "over":
      return labels.estadoSobrante
    case "mixed":
      return labels.estadoMixto
    default:
      return labels.estadoIncompleto
  }
}

const signed = (n: number) => (n > 0 ? `+${formatCurrency(n)}` : n < 0 ? `− ${formatCurrency(-n)}` : formatCurrency(0))

export function generateCashUpPDF(imp: SalesImport, cashUp: CashUp, options: CashUpPDFOptions): jsPDF {
  COLORS.primary = getBusinessThemeRgb(options.businessId)
  const labels = getPdfLabels()
  const result = computeCashUp(imp, cashUp)
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 14
  const contentWidth = pageWidth - 2 * margin

  // ===== ENCABEZADO =====
  doc.setFillColor(245, 245, 245)
  doc.rect(0, 0, pageWidth, 24, "F")
  doc.setDrawColor(...COLORS.tableBorder)
  doc.setLineWidth(0.3)
  doc.line(margin, 24, pageWidth - margin, 24)
  if (options.businessLogo) drawBusinessLogo(doc, options.businessLogo, margin, 3, 15, 15)
  const headerX = margin + (options.businessLogo ? 18 : 0)
  doc.setFontSize(11)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(...COLORS.text)
  doc.text(clean(options.businessName) || "GastroMetrics", headerX, 11)
  doc.setFontSize(8)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(...COLORS.secondary)
  doc.text(`${labels.exportado}: ${formatDateTime(new Date())}`, headerX, 18)
  doc.setFontSize(15)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(...COLORS.primary)
  doc.text(labels.cuadreCaja, pageWidth - margin, 11, { align: "right" })
  doc.setFontSize(9)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(...COLORS.text)
  doc.text(formatDate(new Date(`${options.day}T00:00:00`)), pageWidth - margin, 18, { align: "right" })

  // ===== ESTADO =====
  let y = 32
  const statusColor =
    result.status === "balanced" ? COLORS.positive : result.status === "incomplete" || result.status === "mixed" ? COLORS.warning : COLORS.negative
  doc.setFillColor(...COLORS.highlightBg)
  doc.roundedRect(margin, y, contentWidth, 16, 2, 2, "F")
  doc.setFontSize(12)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(...statusColor)
  doc.text(statusLabel(labels, result.status), margin + 4, y + 7)
  doc.setFontSize(9)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(...COLORS.text)
  doc.text(`${labels.diferencia}: ${signed(result.totalDifference)}`, margin + 4, y + 13)
  y += 22

  // ===== TABLA POR FORMA DE PAGO =====
  autoTable(doc, {
    startY: y,
    head: [[labels.formaPago, labels.ventasCuentas, labels.propinas, labels.esperado, labels.real, labels.diferencia]],
    body: result.rows.map((r) => [
      methodLabel(labels, r.method),
      formatCurrency(r.sales),
      formatCurrency(r.tips),
      formatCurrency(r.expected),
      r.actual === null ? labels.noAnotado : formatCurrency(r.actual),
      r.difference === null ? "—" : signed(r.difference),
    ]),
    theme: "grid",
    margin: { left: margin, right: margin },
    headStyles: { fillColor: COLORS.tableHeader, textColor: COLORS.white, fontSize: 8, fontStyle: "bold", halign: "center", cellPadding: 2 },
    bodyStyles: { fontSize: 9, textColor: COLORS.text, cellPadding: 2 },
    columnStyles: { 0: { cellWidth: "auto" }, 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right", fontStyle: "bold" } },
    didParseCell: (data) => {
      if (data.section !== "body" || data.column.index !== 5) return
      const d = result.rows[data.row.index]?.difference
      if (d !== null && d !== undefined && Math.abs(d) > 0.005) data.cell.styles.textColor = d < 0 ? COLORS.negative : COLORS.positive
    },
  })
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8

  // ===== DETALLE DEL EFECTIVO =====
  const kv: [string, string][] = [[labels.fondoInicial, formatCurrency(cashUp.openingFloat)]]
  if (result.unassigned.tickets) kv.push([`${labels.sinFormaPago} (${result.unassigned.tickets})`, formatCurrency(result.unassigned.amount)])
  if (result.other.tickets) kv.push([`${labels.otraFormaPago} (${result.other.tickets})`, formatCurrency(result.other.amount)])
  if (cashUp.closedBy) kv.push([labels.cerradoPor, clean(cashUp.closedBy)])
  autoTable(doc, {
    startY: y,
    body: kv,
    theme: "plain",
    margin: { left: margin, right: margin },
    bodyStyles: { fontSize: 9, textColor: COLORS.text, cellPadding: 1.5 },
    columnStyles: { 0: { cellWidth: "auto" }, 1: { halign: "right", fontStyle: "bold" } },
  })
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6

  if (cashUp.payouts.length) {
    autoTable(doc, {
      startY: y,
      head: [[labels.salidasCaja, labels.monto]],
      body: [...cashUp.payouts.map((p) => [clean(p.concept) || "—", formatCurrency(p.amount)]), [labels.total, formatCurrency(result.payouts)]],
      theme: "grid",
      margin: { left: margin, right: margin },
      headStyles: { fillColor: COLORS.tableHeader, textColor: COLORS.white, fontSize: 8, fontStyle: "bold", cellPadding: 2 },
      bodyStyles: { fontSize: 9, textColor: COLORS.text, cellPadding: 2 },
      columnStyles: { 1: { halign: "right", cellWidth: 40 } },
    })
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6
  }

  if (clean(cashUp.note)) {
    doc.setFontSize(9)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(...COLORS.text)
    doc.text(labels.notas, margin, y + 4)
    doc.setFont("helvetica", "normal")
    doc.text(doc.splitTextToSize(clean(cashUp.note), contentWidth), margin, y + 10)
  }

  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(...COLORS.secondary)
    doc.text(`GastroMetrics | ${labels.pagina} ${i} ${labels.de} ${pages}`, pageWidth / 2, pageHeight - 8, { align: "center" })
  }
  return doc
}

export function generateCashUpPDFFilename(day: string): string {
  const labels = getPdfLabels()
  return `${safeFilePart(labels.cuadreCaja, "cuadre_de_caja")}_${fileDate(new Date(`${day}T00:00:00`))}.pdf`
}
