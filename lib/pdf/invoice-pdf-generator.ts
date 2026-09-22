import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import type { Invoice } from "@/types/invoice"
import { formatCurrency } from "@/lib/utils/consolidated-utils"
import { getPdfLabels } from "@/lib/i18n/pdf-labels"
import { getBusinessThemeRgb, getBusinessThemeTintRgb } from "@/lib/theme-colors"
import { drawBusinessLogo } from "./pdf-logo"

// Mismo patrón que lib/pdf/purchase-order-pdf-generator.ts — sanitizeText/COLORS
// duplicados localmente a propósito (ver docs/31, sección 2), sin acoplar los
// generadores entre sí.
const sanitizeText = (input: string | undefined | null): string =>
  (input ?? "")
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, "")
    .replace(/[\u{2600}-\u{26FF}]/gu, "")
    .replace(/[\u{2700}-\u{27BF}]/gu, "")
    .replace(/[\x00-\x1f\x7f]/g, "")
    .replace(/\s+/g, " ")
    .trim()

const COLORS = {
  primary: [41, 98, 255] as [number, number, number],
  secondary: [100, 100, 100] as [number, number, number],
  text: [40, 40, 40] as [number, number, number],
  lightGray: [245, 245, 245] as [number, number, number],
  darkGray: [60, 60, 60] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  tableHeader: [51, 51, 51] as [number, number, number],
  tableBorder: [200, 200, 200] as [number, number, number],
  highlightBg: [240, 248, 255] as [number, number, number],
}

export interface InvoicePDFOptions {
  businessName?: string
  businessLogo?: string
  businessId?: string
}

// A diferencia de Orden de Compra (documento operativo interno/proveedor), la factura
// SÍ es de cara al cliente — mismo criterio de tema por negocio (docs/36, sección 5)
// porque igual la genera y descarga el dueño del negocio, nunca el cliente desde la
// app.
export function generateInvoicePDF(invoice: Invoice, options: InvoicePDFOptions = {}): jsPDF {
  COLORS.primary = getBusinessThemeRgb(options.businessId)
  COLORS.highlightBg = getBusinessThemeTintRgb(options.businessId)

  const labels = getPdfLabels()
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 14
  const contentWidth = pageWidth - 2 * margin
  let yPosition = margin

  // Aviso de que esto no es una factura fiscal oficial por país (CAI, CUFE, folio
  // fiscal, etc.) — pedido explícito del dueño del proyecto tras identificar el riesgo
  // real: el módulo genera un documento de cobro real, pero GastroMetrics no integra
  // ningún sistema de facturación fiscal específico de ningún país. En cada página, no
  // solo la primera, para que sea visible sin importar cuál se imprima o comparta.
  const addFiscalDisclaimer = () => {
    doc.setFontSize(6.5)
    doc.setTextColor(...COLORS.secondary)
    doc.text(sanitizeText(labels.facturaAvisoNoFiscal), pageWidth / 2, pageHeight - 12, {
      align: "center",
      maxWidth: contentWidth,
    })
  }

  const addPageNumber = (pageNum: number, totalPages: number) => {
    addFiscalDisclaimer()
    doc.setFontSize(8)
    doc.setTextColor(...COLORS.secondary)
    doc.text(`GastroMetrics | ${labels.pagina} ${pageNum} ${labels.de} ${totalPages}`, pageWidth / 2, pageHeight - 8, {
      align: "center",
    })
  }

  const drawLine = (y: number, color: [number, number, number] = COLORS.tableBorder) => {
    doc.setDrawColor(...color)
    doc.setLineWidth(0.3)
    doc.line(margin, y, pageWidth - margin, y)
  }

  // ===== HEADER =====
  doc.setFillColor(...COLORS.lightGray)
  doc.rect(0, 0, pageWidth, 24, "F")
  drawLine(24)

  if (options.businessLogo) {
    drawBusinessLogo(doc, options.businessLogo, margin, 4, 15, 15)
  }
  const headerTextX = margin + (options.businessLogo ? 18 : 0)

  doc.setFontSize(11)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(...COLORS.text)
  doc.text(sanitizeText(options.businessName) || "GastroMetrics", headerTextX, 11)

  doc.setFontSize(8)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(...COLORS.secondary)
  doc.text(labels.fecha + " " + new Date(invoice.issueDate).toLocaleDateString(labels.locale), headerTextX, 18)

  doc.setFontSize(16)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(...COLORS.primary)
  doc.text(labels.factura.toUpperCase(), pageWidth - margin, 11, { align: "right" })

  doc.setFontSize(9)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(...COLORS.darkGray)
  doc.text(`${labels.numero} ${sanitizeText(invoice.number)}`, pageWidth - margin, 18, { align: "right" })

  yPosition = 32

  // ===== DATOS DEL CLIENTE =====
  doc.setFillColor(...COLORS.highlightBg)
  const hasClientExtra = Boolean(invoice.clientTaxId || invoice.clientEmail || invoice.clientAddress)
  const clientBoxHeight = hasClientExtra ? 24 : 18
  doc.roundedRect(margin, yPosition, contentWidth, clientBoxHeight, 2, 2, "F")

  doc.setFontSize(7.5)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(...COLORS.secondary)
  doc.text(labels.cliente.toUpperCase(), margin + 4, yPosition + 7)

  doc.setFontSize(11)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(...COLORS.text)
  doc.text(sanitizeText(invoice.clientName) || labels.sinCliente, margin + 4, yPosition + 14)

  if (hasClientExtra) {
    const extraLine = [invoice.clientTaxId, invoice.clientEmail, invoice.clientAddress]
      .map((v) => sanitizeText(v))
      .filter(Boolean)
      .join("  ·  ")
    doc.setFontSize(8)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(...COLORS.secondary)
    doc.text(extraLine, margin + 4, yPosition + 20)
  }

  yPosition += clientBoxHeight + 6

  // ===== TABLA DE ITEMS =====
  const tableRows = invoice.items.map((item) => [
    sanitizeText(item.description),
    String(item.quantity),
    formatCurrency(item.unitPrice),
    formatCurrency(item.amount),
  ])

  autoTable(doc, {
    startY: yPosition,
    head: [[labels.descripcion, labels.cantidad, labels.precioUnitario, labels.extension]],
    body: tableRows,
    theme: "grid",
    margin: { left: margin, right: margin },
    headStyles: {
      fillColor: COLORS.tableHeader,
      textColor: COLORS.white,
      fontSize: 8,
      fontStyle: "bold",
      halign: "center",
      cellPadding: 2,
    },
    bodyStyles: {
      fontSize: 8,
      textColor: COLORS.text,
      cellPadding: 2,
    },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { cellWidth: 26, halign: "right" },
      2: { cellWidth: 32, halign: "right" },
      3: { cellWidth: 32, halign: "right" },
    },
  })

  // @ts-expect-error -- lastAutoTable es inyectado en runtime por jspdf-autotable
  yPosition = (doc.lastAutoTable?.finalY || yPosition) + 8

  const pageHeightLimit = pageHeight - 70
  if (yPosition > pageHeightLimit) {
    doc.addPage()
    yPosition = margin
  }

  // ===== TOTALES =====
  const totalsBoxWidth = 76
  const totalsX = pageWidth - margin - totalsBoxWidth
  const totalsRow = (label: string, value: string, bold: boolean, y: number) => {
    doc.setFontSize(9)
    doc.setFont("helvetica", bold ? "bold" : "normal")
    doc.setTextColor(...(bold ? COLORS.text : COLORS.secondary))
    doc.text(label, totalsX, y)
    doc.text(value, pageWidth - margin, y, { align: "right" })
  }

  totalsRow(labels.subtotal, formatCurrency(invoice.subtotal), false, yPosition)
  yPosition += 6
  if (invoice.taxPercent > 0) {
    totalsRow(`${labels.impuesto} (${invoice.taxPercent}%)`, formatCurrency(invoice.taxAmount), false, yPosition)
    yPosition += 6
  }
  drawLine(yPosition)
  yPosition += 2

  doc.setFillColor(...COLORS.tableHeader)
  doc.rect(totalsX, yPosition, totalsBoxWidth, 12, "F")
  doc.setFontSize(9)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(...COLORS.white)
  doc.text(labels.total.toUpperCase(), totalsX + 4, yPosition + 8)
  doc.setFontSize(12)
  doc.setFont("helvetica", "bold")
  doc.text(formatCurrency(invoice.total), pageWidth - margin - 4, yPosition + 8.5, { align: "right" })

  yPosition += 20

  // ===== NOTAS =====
  if (invoice.notes?.trim()) {
    if (yPosition + 20 > pageHeight - 20) {
      doc.addPage()
      yPosition = margin
    }
    doc.setFontSize(9)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(...COLORS.darkGray)
    doc.text(labels.notas, margin, yPosition)
    yPosition += 5
    doc.setFontSize(8.5)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(...COLORS.text)
    const noteLines = doc.splitTextToSize(sanitizeText(invoice.notes), contentWidth)
    doc.text(noteLines, margin, yPosition)
  }

  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    addPageNumber(i, totalPages)
  }

  return doc
}

export function generateInvoicePDFFilename(invoice: Invoice): string {
  const number = sanitizeText(invoice.number).replace(/[^a-zA-Z0-9]/g, "_") || "sin_numero"
  const date = new Date(invoice.issueDate || Date.now()).toISOString().split("T")[0].replace(/-/g, "")
  return `Factura_${number}_${date}.pdf`
}

export function downloadInvoicePDF(invoice: Invoice, options: InvoicePDFOptions = {}): void {
  try {
    const doc = generateInvoicePDF(invoice, options)
    doc.save(generateInvoicePDFFilename(invoice))
  } catch (error) {
    console.error("Error generating invoice PDF:", error)
    throw new Error("No se pudo generar el PDF")
  }
}
