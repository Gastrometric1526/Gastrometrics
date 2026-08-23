import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import type { PurchaseOrder } from "@/types/purchase-order"
import { formatCurrency } from "@/lib/utils/consolidated-utils"
import { getPdfLabels } from "@/lib/i18n/pdf-labels"
import { getBusinessThemeRgb, getBusinessThemeTintRgb } from "@/lib/theme-colors"
import { drawBusinessLogo } from "./pdf-logo"

// ============== HELPERS ==============
// Mismo patron que lib/pdf/recipe-pdf-generator.ts y lib/pdf/menu-pdf-generator.ts:
// sin libreria de charting, sanitizeText/COLORS/CHART_COLORS duplicados localmente a
// proposito (ver docs/31, seccion 2) para no acoplar los generadores entre si.

const sanitizeText = (input: string | undefined | null): string =>
  (input ?? "")
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, "")
    .replace(/[\u{2600}-\u{26FF}]/gu, "")
    .replace(/[\u{2700}-\u{27BF}]/gu, "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
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

const CHART_COLORS: [number, number, number][] = [
  [41, 98, 255],
  [220, 38, 38],
  [21, 128, 61],
  [217, 119, 6],
  [124, 58, 237],
  [8, 145, 178],
  [190, 24, 93],
  [107, 114, 128],
]

interface ChartDatum {
  label: string
  value: number
  color: [number, number, number]
}

function drawPieSlice(
  doc: jsPDF,
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number,
  color: [number, number, number],
) {
  doc.setFillColor(...color)
  const sliceAngle = endAngle - startAngle
  const steps = Math.max(1, Math.ceil(sliceAngle / (Math.PI / 18)))
  for (let i = 0; i < steps; i++) {
    const a1 = startAngle + (sliceAngle * i) / steps
    const a2 = startAngle + (sliceAngle * (i + 1)) / steps
    const x1 = cx + Math.cos(a1) * radius
    const y1 = cy + Math.sin(a1) * radius
    const x2 = cx + Math.cos(a2) * radius
    const y2 = cy + Math.sin(a2) * radius
    doc.triangle(cx, cy, x1, y1, x2, y2, "F")
  }
}

function drawPieChart(
  doc: jsPDF,
  data: ChartDatum[],
  cx: number,
  cy: number,
  radius: number,
  legendX: number,
  legendY: number,
  formatValue: (n: number) => string,
): number {
  const total = data.reduce((sum, d) => sum + Math.max(0, d.value), 0) || 1
  let angle = -Math.PI / 2

  data.forEach((d) => {
    const value = Math.max(0, d.value)
    const slice = (value / total) * Math.PI * 2
    if (slice > 0.001) {
      drawPieSlice(doc, cx, cy, radius, angle, angle + slice, d.color)
      angle += slice
    }
  })

  doc.setDrawColor(...COLORS.white)
  doc.setLineWidth(0.6)
  doc.circle(cx, cy, radius, "S")

  let legendCurrentY = legendY
  data.forEach((d) => {
    const pct = (Math.max(0, d.value) / total) * 100
    doc.setFillColor(...d.color)
    doc.rect(legendX, legendCurrentY - 2.5, 3, 3, "F")
    doc.setFontSize(7)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(...COLORS.text)
    doc.text(`${d.label} (${pct.toFixed(1)}%)`, legendX + 5, legendCurrentY)
    doc.setFont("helvetica", "bold")
    doc.text(formatValue(Math.max(0, d.value)), legendX + 58, legendCurrentY)
    legendCurrentY += 4.6
  })

  return legendCurrentY
}

export interface PurchaseOrderPDFOptions {
  businessName?: string
  businessLogo?: string
  businessId?: string
}

// ============== MAIN GENERATOR ==============
// Un solo diseno (a diferencia de ficha tecnica/menu, que tienen 2-3 copias por
// audiencia): la orden de compra es, por naturaleza, un documento operativo que
// usa el propio negocio o se envia al proveedor, no algo que un cliente vea.

export function generatePurchaseOrderPDF(order: PurchaseOrder, options: PurchaseOrderPDFOptions = {}): jsPDF {
  // Documento operativo, nunca de cara al cliente — siempre refleja el tema del negocio
  // (ver docs/36, sección 5).
  COLORS.primary = getBusinessThemeRgb(options.businessId)
  COLORS.highlightBg = getBusinessThemeTintRgb(options.businessId)
  CHART_COLORS[0] = COLORS.primary

  const labels = getPdfLabels()
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 14
  const contentWidth = pageWidth - 2 * margin
  let yPosition = margin

  const addPageNumber = (pageNum: number, totalPages: number) => {
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
  doc.text(labels.exportado + ": " + new Date().toLocaleString(labels.locale), headerTextX, 18)

  doc.setFontSize(16)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(...COLORS.primary)
  doc.text(labels.ordenCompra.toUpperCase(), pageWidth - margin, 11, { align: "right" })

  doc.setFontSize(9)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(...COLORS.darkGray)
  doc.text(`${labels.numero} ${sanitizeText(order.name)}`, pageWidth - margin, 18, { align: "right" })

  yPosition = 32

  // ===== DATOS GENERALES =====
  const statusLabels: Record<string, string> = {
    pending: "Pendiente",
    approved: "Aprobada",
    ordered: "Ordenada",
    received: "Recibida",
    cancelled: "Cancelada",
  }

  doc.setFillColor(...COLORS.highlightBg)
  doc.roundedRect(margin, yPosition, contentWidth, 20, 2, 2, "F")

  const infoColWidth = contentWidth / 3
  const infoRow = (label: string, value: string, colIndex: number) => {
    const x = margin + 4 + colIndex * infoColWidth
    doc.setFontSize(7.5)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(...COLORS.secondary)
    doc.text(label.toUpperCase(), x, yPosition + 7)
    doc.setFontSize(10)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(...COLORS.text)
    doc.text(sanitizeText(value) || "-", x, yPosition + 14)
  }

  infoRow(labels.fecha, new Date(order.date).toLocaleDateString(labels.locale), 0)
  infoRow(labels.estado, statusLabels[order.status || "pending"] || order.status || "-", 1)
  infoRow(labels.itemsOrden, String(order.items.length), 2)

  yPosition += 26

  // ===== TABLA DE ITEMS =====
  // Los items ya vienen ordenados alfabeticamente por proveedor (sortPurchaseOrderItemsBySupplier,
  // ver lib/purchase-orders.ts) -- se respeta ese orden aqui, no se reordena.
  const tableRows = order.items.map((item) => {
    const qtyLabel =
      item.presentation && item.presentationQuantity
        ? `${item.presentationQuantity} ${item.presentation}${item.presentationQuantity !== 1 ? "s" : ""}`
        : `${item.totalQuantity} ${item.unit}`

    return [
      sanitizeText(item.name),
      item.supplier?.trim() ? sanitizeText(item.supplier) : labels.sinProveedor,
      qtyLabel,
      formatCurrency(item.costPerUnit),
      formatCurrency(item.purchaseCost),
    ]
  })

  autoTable(doc, {
    startY: yPosition,
    head: [[labels.ingrediente, labels.proveedor, labels.cantidad, labels.costo, labels.extension]],
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
      1: { cellWidth: 36 },
      2: { cellWidth: 32, halign: "right" },
      3: { cellWidth: 26, halign: "right" },
      4: { cellWidth: 26, halign: "right" },
    },
    didParseCell: (data) => {
      // Resalta filas sin proveedor (van al final por diseno, ver docs/31) para que
      // salten a la vista y el usuario sepa que hace falta completarlas.
      if (data.section === "body" && data.column.index === 1 && data.cell.raw === labels.sinProveedor) {
        data.cell.styles.textColor = [185, 28, 28]
        data.cell.styles.fontStyle = "italic"
      }
    },
  })

  // @ts-expect-error -- lastAutoTable es inyectado en runtime por jspdf-autotable
  yPosition = (doc.lastAutoTable?.finalY || yPosition) + 8

  const pageHeightLimit = pageHeight - 60
  if (yPosition > pageHeightLimit) {
    doc.addPage()
    yPosition = margin
  }

  // ===== TOTAL =====
  doc.setFillColor(...COLORS.tableHeader)
  doc.rect(pageWidth - margin - 70, yPosition, 70, 12, "F")
  doc.setFontSize(9)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(...COLORS.white)
  doc.text(labels.totalOrden.toUpperCase(), pageWidth - margin - 66, yPosition + 5)
  doc.setFontSize(12)
  doc.setFont("helvetica", "bold")
  doc.text(formatCurrency(order.total), pageWidth - margin - 4, yPosition + 9.5, { align: "right" })

  yPosition += 20

  // ===== DISTRIBUCION POR PROVEEDOR (barra + pastel, estilo "administrativo") =====
  const bySupplier = new Map<string, number>()
  order.items.forEach((item) => {
    const key = item.supplier?.trim() || labels.sinProveedor
    bySupplier.set(key, (bySupplier.get(key) || 0) + item.purchaseCost)
  })

  const supplierEntries = Array.from(bySupplier.entries())
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1])

  if (supplierEntries.length > 1) {
    if (yPosition + 55 > pageHeight - 20) {
      doc.addPage()
      yPosition = margin
    }

    doc.setFontSize(11)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(...COLORS.darkGray)
    doc.text("DISTRIBUCION POR PROVEEDOR", margin, yPosition)
    drawLine(yPosition + 2)
    yPosition += 10

    const top = supplierEntries.slice(0, 5)
    const rest = supplierEntries.slice(5)
    const restTotal = rest.reduce((sum, [, v]) => sum + v, 0)
    const pieData: ChartDatum[] = top.map(([label, value], i) => ({
      label,
      value,
      color: CHART_COLORS[i % CHART_COLORS.length],
    }))
    if (restTotal > 0) {
      pieData.push({ label: "Otros", value: restTotal, color: CHART_COLORS[7] })
    }

    const pieCx = margin + 24
    const pieCy = yPosition + 20
    drawPieChart(doc, pieData, pieCx, pieCy, 20, margin + 55, yPosition + 4, (n) => formatCurrency(n))

    yPosition += 55
  }

  // Add page numbers to all pages
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    addPageNumber(i, totalPages)
  }

  return doc
}

export function generatePurchaseOrderPDFFilename(order: PurchaseOrder): string {
  const orderName = sanitizeText(order.name).replace(/[^a-zA-Z0-9]/g, "_")
  const date = new Date()
  const dateStr = date.toISOString().split("T")[0].replace(/-/g, "")
  return `OC_${orderName}_${dateStr}.pdf`
}

export function downloadPurchaseOrderPDF(order: PurchaseOrder, options: PurchaseOrderPDFOptions = {}): void {
  try {
    const doc = generatePurchaseOrderPDF(order, options)
    doc.save(generatePurchaseOrderPDFFilename(order))
  } catch (error) {
    console.error("Error generating purchase order PDF:", error)
    throw new Error("No se pudo generar el PDF")
  }
}
