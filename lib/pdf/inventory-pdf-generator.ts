import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import type { InventoryItem, InventorySnapshot } from "@/types/inventory"
import { formatCurrency } from "@/lib/utils/consolidated-utils"
import { getPdfLabels } from "@/lib/i18n/pdf-labels"
import { getBusinessThemeRgb, getBusinessThemeTintRgb } from "@/lib/theme-colors"
import { drawBusinessLogo } from "./pdf-logo"

// ============== HELPERS ==============
// Mismo patron que los demas generadores en lib/pdf/ (recipe/menu/purchase-order):
// sin libreria de charting, sanitizeText/COLORS/CHART_COLORS duplicados a proposito.

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
  critical: [185, 28, 28] as [number, number, number],
  low: [217, 119, 6] as [number, number, number],
  normal: [21, 128, 61] as [number, number, number],
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

/**
 * BUG CORREGIDO (hallazgo de uso real, mismo problema en lib/pdf/recipe-pdf-generator.ts):
 * usado para que el valor de una barra/leyenda nunca se salga del ancho que tiene
 * disponible — reduce el tamano de fuente (sin truncar el numero) hasta que quepa.
 */
const fitFontSize = (doc: jsPDF, text: string, maxWidth: number, baseFontSize: number, minFontSize = 5.5): number => {
  let size = baseFontSize
  doc.setFontSize(size)
  while (size > minFontSize && doc.getTextWidth(text) > maxWidth) {
    size -= 0.5
    doc.setFontSize(size)
  }
  return size
}

function drawBarChart(
  doc: jsPDF,
  data: ChartDatum[],
  x: number,
  y: number,
  width: number,
  formatValue: (n: number) => string,
): number {
  const labelWidth = width * 0.32
  const barAreaX = x + labelWidth
  const barAreaWidth = width * 0.48
  const barHeight = 4.2
  const gap = 2.6
  const maxValue = Math.max(...data.map((d) => d.value), 0.01)

  let currentY = y
  data.forEach((d) => {
    const barWidth = Math.max(0.5, (d.value / maxValue) * barAreaWidth)

    doc.setFontSize(7)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(...COLORS.text)
    // BUG CORREGIDO: `maxWidth` en jsPDF envuelve el texto en varias lineas en vez de
    // truncarlo — una etiqueta larga desbordaba el alto de esta fila y quedaba montada
    // sobre la barra siguiente. Se trunca con "…" en una sola linea en su lugar.
    let barLabel = d.label
    const labelMaxWidth = labelWidth - 2
    if (doc.getTextWidth(barLabel) > labelMaxWidth) {
      while (barLabel.length > 1 && doc.getTextWidth(barLabel + "…") > labelMaxWidth) {
        barLabel = barLabel.slice(0, -1)
      }
      barLabel = barLabel.trimEnd() + "…"
    }
    doc.text(barLabel, x, currentY + barHeight - 1)

    doc.setFillColor(...COLORS.lightGray)
    doc.rect(barAreaX, currentY, barAreaWidth, barHeight, "F")
    doc.setFillColor(...d.color)
    doc.rect(barAreaX, currentY, barWidth, barHeight, "F")

    doc.setFont("helvetica", "bold")
    doc.setTextColor(...COLORS.darkGray)
    const barValueText = formatValue(d.value)
    const barValueMaxWidth = width - labelWidth - barAreaWidth - 5
    fitFontSize(doc, barValueText, barValueMaxWidth, 7)
    doc.text(barValueText, barAreaX + barAreaWidth + 3, currentY + barHeight - 1)
    doc.setFontSize(7)

    currentY += barHeight + gap
  })

  return currentY
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
  legendWidth: number,
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

  // BUG CORREGIDO (hallazgo de uso real, mismo problema en lib/pdf/recipe-pdf-generator.ts):
  // el valor se dibujaba siempre a legendX + 58, un offset fijo mas ancho de lo que en
  // realidad queda disponible junto al pastel — con una etiqueta larga o un porcentaje
  // de 2 digitos, el texto del monto quedaba montado encima de la etiqueta. Ahora el
  // monto se ancla al borde derecho real de la leyenda y la etiqueta se trunca con "…"
  // para dejarle siempre el espacio que necesita.
  let legendCurrentY = legendY
  data.forEach((d) => {
    const pct = (Math.max(0, d.value) / total) * 100
    doc.setFillColor(...d.color)
    doc.rect(legendX, legendCurrentY - 2.5, 3, 3, "F")

    doc.setFontSize(7)
    doc.setFont("helvetica", "bold")
    const valueText = formatValue(Math.max(0, d.value))
    const valueWidth = doc.getTextWidth(valueText)

    doc.setFont("helvetica", "normal")
    const labelGap = 3
    const labelMaxWidth = Math.max(10, legendWidth - 5 - valueWidth - labelGap)
    let labelText = `${d.label} (${pct.toFixed(1)}%)`
    if (doc.getTextWidth(labelText) > labelMaxWidth) {
      while (labelText.length > 1 && doc.getTextWidth(labelText + "…") > labelMaxWidth) {
        labelText = labelText.slice(0, -1)
      }
      labelText = labelText.trimEnd() + "…"
    }
    doc.setTextColor(...COLORS.text)
    doc.text(labelText, legendX + 5, legendCurrentY)

    doc.setFont("helvetica", "bold")
    doc.text(valueText, legendX + legendWidth - valueWidth, legendCurrentY)

    legendCurrentY += 4.6
  })

  return legendCurrentY
}

// ============== FORMA NORMALIZADA (comun a inventario actual y a un snapshot historico) ==============

interface InventoryPDFRow {
  name: string
  category: string
  quantity: number
  unit: string
  price: number
  totalValue: number
  supplier?: string
  status?: "critical" | "low" | "normal"
}

interface InventoryPDFData {
  title: string
  // BUG CORREGIDO (hallazgo de auditoria externa, ver docs/98/99): antes esto ya
  // llegaba formateado como string (toLocaleDateString() sin locale, es decir con el
  // locale por defecto del entorno) desde build*() mas abajo, mezclando formatos de
  // fecha con el resto del PDF (que si usa labels.locale). Ahora se guarda la fecha
  // cruda y se formatea con labels.locale recien al momento de dibujar, igual que
  // todos los demas PDFs.
  subtitle: Date
  rows: InventoryPDFRow[]
}

export interface InventoryPDFOptions {
  businessName?: string
  businessLogo?: string
  businessId?: string
}

export function buildInventoryPDFDataFromCurrent(items: InventoryItem[]): InventoryPDFData {
  const labels = getPdfLabels()
  return {
    title: labels.inventarioActualTitulo,
    subtitle: new Date(),
    rows: items.map((item) => ({
      name: item.name,
      category: item.category,
      quantity: item.currentStock ?? 0,
      unit: item.unit,
      price: item.price,
      totalValue: (item.currentStock ?? 0) * item.price,
      supplier: item.supplier,
      status: item.status,
    })),
  }
}

export function buildInventoryPDFDataFromSnapshot(snapshot: InventorySnapshot): InventoryPDFData {
  const labels = getPdfLabels()
  const typeLabel =
    snapshot.type === "initial"
      ? labels.inventarioInicial
      : snapshot.type === "final"
        ? labels.inventarioFinalLabel
        : labels.compraLabel
  return {
    title: `${labels.inventario} - ${typeLabel.toUpperCase()}`,
    subtitle: new Date(snapshot.date),
    rows: (snapshot.items || []).map((item) => ({
      name: item.name,
      category: item.category,
      quantity: item.displayQuantity ?? item.quantity,
      unit: item.unit,
      price: item.price,
      totalValue: item.totalPrice,
      supplier: item.supplier,
    })),
  }
}

// ============== GENERADOR PRINCIPAL ==============
// Reporte de inventario, un solo diseno de tipo administrativo: es un documento
// interno de control (valorizacion, estado de stock, distribucion por categoria),
// no algo que se comparta con clientes ni con empleados de cocina.

function renderInventoryPDF(doc: jsPDF, data: InventoryPDFData, options: InventoryPDFOptions): void {
  const labels = getPdfLabels()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 14
  const contentWidth = pageWidth - 2 * margin
  let yPosition = margin

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
    drawBusinessLogo(doc, options.businessLogo, margin, 3, 15, 15)
  }
  const headerTextX = margin + (options.businessLogo ? 18 : 0)

  doc.setFontSize(11)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(...COLORS.text)
  doc.text(sanitizeText(options.businessName) || "GastroMetrics", headerTextX, 11)

  doc.setFontSize(8)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(...COLORS.secondary)
  doc.text(`${labels.exportado}: ${new Date().toLocaleString(labels.locale)}`, headerTextX, 18)

  doc.setFontSize(15)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(...COLORS.primary)
  doc.text(sanitizeText(data.title), pageWidth - margin, 11, { align: "right" })

  doc.setFontSize(9)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(...COLORS.darkGray)
  doc.text(`${labels.fecha}: ${data.subtitle.toLocaleDateString(labels.locale)}`, pageWidth - margin, 18, { align: "right" })

  yPosition = 32

  // ===== RESUMEN GENERAL =====
  const totalValue = data.rows.reduce((sum, r) => sum + (r.totalValue || 0), 0)
  const criticalCount = data.rows.filter((r) => r.status === "critical").length
  const lowCount = data.rows.filter((r) => r.status === "low").length

  doc.setFillColor(...COLORS.highlightBg)
  doc.roundedRect(margin, yPosition, contentWidth, 20, 2, 2, "F")

  const summaryColWidth = contentWidth / 4
  const summaryCell = (label: string, value: string, colIndex: number, color: [number, number, number] = COLORS.text) => {
    const x = margin + 4 + colIndex * summaryColWidth
    doc.setFontSize(7.5)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(...COLORS.secondary)
    doc.text(label.toUpperCase(), x, yPosition + 7)
    doc.setFontSize(11)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(...color)
    doc.text(value, x, yPosition + 14)
  }

  summaryCell(labels.productosRegistrados, String(data.rows.length), 0)
  summaryCell(labels.valorTotalInventario, formatCurrency(totalValue), 1)
  summaryCell(labels.critico, String(criticalCount), 2, criticalCount > 0 ? COLORS.critical : COLORS.text)
  summaryCell(labels.bajo, String(lowCount), 3, lowCount > 0 ? COLORS.low : COLORS.text)

  yPosition += 28

  // ===== DISTRIBUCION VISUAL (por categoria) =====
  const byCategory = new Map<string, number>()
  data.rows.forEach((r) => {
    byCategory.set(r.category || labels.sinCategoria, (byCategory.get(r.category || labels.sinCategoria) || 0) + r.totalValue)
  })
  const categoryEntries = Array.from(byCategory.entries())
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])

  if (categoryEntries.length > 0) {
    doc.setFontSize(11)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(...COLORS.darkGray)
    doc.text(labels.distribucionCategoria.toUpperCase(), margin, yPosition)
    drawLine(yPosition + 2)
    yPosition += 10

    // Con una sola categoria el "pastel" es un circulo completo de un solo color —
    // no compara nada, asi que se omite (mismo criterio que recipe-pdf-generator) y
    // la barra de top productos, que si sigue siendo util con una sola categoria,
    // ocupa el ancho completo en su lugar de compartirlo con un grafico vacio.
    const hasPie = categoryEntries.length > 1
    let legendMaxY = yPosition

    if (hasPie) {
      const top = categoryEntries.slice(0, 6)
      const rest = categoryEntries.slice(6)
      const restTotal = rest.reduce((sum, [, v]) => sum + v, 0)
      const pieData: ChartDatum[] = top.map(([label, value], i) => ({
        label,
        value,
        color: CHART_COLORS[i % CHART_COLORS.length],
      }))
      if (restTotal > 0) pieData.push({ label: labels.otros, value: restTotal, color: CHART_COLORS[7] })

      const pieCx = margin + 24
      const pieCy = yPosition + 22
      const pieLegendX = margin + 58
      // La columna de "top productos" empieza en margin + 118 cuando hay pastel (ver
      // barX debajo) — la leyenda debe dejar de dibujar texto antes de esa columna.
      const pieLegendWidth = 118 - 58 - 4
      legendMaxY = drawPieChart(doc, pieData, pieCx, pieCy, 22, pieLegendX, yPosition + 4, pieLegendWidth, (n) =>
        formatCurrency(n),
      )
    }

    // Top productos por valor, como barra al lado del pastel (o a todo el ancho si
    // no hay pastel que dibujar)
    const topProducts = [...data.rows]
      .filter((r) => r.totalValue > 0)
      .sort((a, b) => b.totalValue - a.totalValue)
      .slice(0, 6)
    if (topProducts.length > 0) {
      const barX = hasPie ? margin + 118 : margin
      if (barX + 70 <= pageWidth - margin) {
        doc.setFontSize(8)
        doc.setFont("helvetica", "bold")
        doc.setTextColor(...COLORS.secondary)
        doc.text(labels.topProductosPorValor, barX, yPosition)
        drawBarChart(
          doc,
          topProducts.map((p, i) => ({ label: p.name, value: p.totalValue, color: CHART_COLORS[i % CHART_COLORS.length] })),
          barX,
          yPosition + 6,
          pageWidth - margin - barX,
          (n) => formatCurrency(n),
        )
      }
    }

    yPosition = Math.max(legendMaxY, yPosition + 46) + 8
  }

  if (yPosition > pageHeight - 40) {
    doc.addPage()
    yPosition = margin
  }

  // ===== TABLA DETALLADA =====
  const statusLabel = (status?: string) =>
    status === "critical" ? labels.critico : status === "low" ? labels.bajo : status === "normal" ? labels.normal : "-"

  const tableRows = [...data.rows]
    .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name))
    .map((r) => [
      sanitizeText(r.name),
      sanitizeText(r.category),
      `${r.quantity} ${r.unit}`,
      r.supplier?.trim() ? sanitizeText(r.supplier) : labels.sinProveedor,
      formatCurrency(r.price),
      formatCurrency(r.totalValue),
      statusLabel(r.status),
    ])

  autoTable(doc, {
    startY: yPosition,
    head: [[labels.ingrediente, labels.categoria, labels.cantidad, labels.proveedor, labels.costo, labels.valorizado, labels.estado]],
    body: tableRows,
    theme: "grid",
    margin: { left: margin, right: margin },
    headStyles: {
      fillColor: COLORS.tableHeader,
      textColor: COLORS.white,
      fontSize: 7.5,
      fontStyle: "bold",
      halign: "center",
      cellPadding: 1.8,
    },
    bodyStyles: { fontSize: 7.5, textColor: COLORS.text, cellPadding: 1.8 },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { cellWidth: 32 },
      2: { cellWidth: 22, halign: "right" },
      3: { cellWidth: 28 },
      4: { cellWidth: 20, halign: "right" },
      5: { cellWidth: 22, halign: "right" },
      6: { cellWidth: 18, halign: "center" },
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 6) {
        const raw = String(data.cell.raw)
        if (raw === labels.critico) {
          data.cell.styles.textColor = COLORS.critical
          data.cell.styles.fontStyle = "bold"
        } else if (raw === labels.bajo) {
          data.cell.styles.textColor = COLORS.low
          data.cell.styles.fontStyle = "bold"
        }
      }
    },
  })

  // Page numbers
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(...COLORS.secondary)
    doc.text(`GastroMetrics | ${labels.pagina} ${i} ${labels.de} ${totalPages}`, pageWidth / 2, pageHeight - 8, {
      align: "center",
    })
  }
}

export function generateInventoryPDF(data: InventoryPDFData, options: InventoryPDFOptions = {}): jsPDF {
  // Documento operativo, nunca de cara al cliente — siempre refleja el tema del negocio
  // (ver docs/36, sección 5).
  COLORS.primary = getBusinessThemeRgb(options.businessId)
  COLORS.highlightBg = getBusinessThemeTintRgb(options.businessId)
  CHART_COLORS[0] = COLORS.primary

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
  renderInventoryPDF(doc, data, options)
  return doc
}

export function generateInventoryPDFFilename(data: InventoryPDFData): string {
  const titlePart = sanitizeText(data.title).replace(/[^a-zA-Z0-9]/g, "_")
  const date = new Date()
  const dateStr = date.toISOString().split("T")[0].replace(/-/g, "")
  return `${titlePart}_${dateStr}.pdf`
}

export function downloadInventorySnapshotPDF(snapshot: InventorySnapshot, options: InventoryPDFOptions = {}): void {
  try {
    const data = buildInventoryPDFDataFromSnapshot(snapshot)
    const doc = generateInventoryPDF(data, options)
    doc.save(generateInventoryPDFFilename(data))
  } catch (error) {
    console.error("Error generating inventory snapshot PDF:", error)
    throw new Error("No se pudo generar el PDF")
  }
}

export function downloadCurrentInventoryPDF(items: InventoryItem[], options: InventoryPDFOptions = {}): void {
  try {
    const data = buildInventoryPDFDataFromCurrent(items)
    const doc = generateInventoryPDF(data, options)
    doc.save(generateInventoryPDFFilename(data))
  } catch (error) {
    console.error("Error generating current inventory PDF:", error)
    throw new Error("No se pudo generar el PDF")
  }
}
