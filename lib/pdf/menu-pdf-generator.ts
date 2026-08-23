import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import type { Menu } from "@/lib/types/menus"
import type { Recipe } from "@/types/recipe"
import { formatCurrency } from "@/lib/utils/consolidated-utils"
import { getPdfLabels } from "@/lib/i18n/pdf-labels"
import { getBusinessThemeRgb, BRAND_ORANGE_RGB } from "@/lib/theme-colors"

// PDF de Menus — dos variantes con objetivos deliberadamente opuestos, no solo dos
// temas de color sobre la misma plantilla (pedido explicito: "toma libertad creativa"):
//
// - "cliente": la carta que ve el comensal. Nada de datos internos — ni costo, ni
//   margen, ni "COPIA INTERNA". Tipografia serif, mucho espacio en blanco, sin tablas
//   ni cuadricula — el objetivo es que se sienta impresa por un restaurante, no
//   exportada por un sistema de costeo.
// - "interno": para el dueño/administrador. Ademas de la tabla de costo/precio/margen
//   por plato que ya existia, ahora suma una lectura visual (barras de margen por
//   plato, pastel de composicion del precio total) — mientras mas informacion mejor,
//   es material de trabajo, no algo que vaya a la mesa.

function sanitizeText(input: string | undefined | null): string {
  const value = input == null ? "" : input
  let result = ""
  for (const char of value) {
    const code = char.codePointAt(0) as number
    if (code >= 0x1f300 && code <= 0x1faff) continue
    if (code >= 0x2600 && code <= 0x26ff) continue
    if (code >= 0x2700 && code <= 0x27bf) continue
    if (code <= 0x1f || code === 0x7f) continue
    result += char
  }
  return result.replace(/\s+/g, " ").trim()
}

const COLORS = {
  primary: BRAND_ORANGE_RGB,
  secondary: [100, 100, 100] as [number, number, number],
  text: [40, 40, 40] as [number, number, number],
  lightGray: [245, 245, 245] as [number, number, number],
  darkGray: [60, 60, 60] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  tableHeader: [51, 51, 51] as [number, number, number],
  tableBorder: [200, 200, 200] as [number, number, number],
}

const CHART_COLORS: [number, number, number][] = [
  BRAND_ORANGE_RGB,
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

function drawBarChart(
  doc: jsPDF,
  data: ChartDatum[],
  x: number,
  y: number,
  width: number,
  formatValue: (n: number) => string,
): number {
  const labelWidth = width * 0.34
  const barAreaX = x + labelWidth
  const barAreaWidth = width * 0.46
  const barHeight = 4.2
  const gap = 2.6
  const maxValue = Math.max(...data.map((d) => Math.abs(d.value)), 0.01)

  let currentY = y
  data.forEach((d) => {
    const barWidth = Math.max(0.5, (Math.abs(d.value) / maxValue) * barAreaWidth)

    doc.setFontSize(7)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(...COLORS.text)
    doc.text(d.label, x, currentY + barHeight - 1, { maxWidth: labelWidth - 2 })

    doc.setFillColor(...COLORS.lightGray)
    doc.rect(barAreaX, currentY, barAreaWidth, barHeight, "F")
    doc.setFillColor(...d.color)
    doc.rect(barAreaX, currentY, barWidth, barHeight, "F")

    doc.setFont("helvetica", "bold")
    doc.setTextColor(...COLORS.darkGray)
    doc.text(formatValue(d.value), barAreaX + barAreaWidth + 3, currentY + barHeight - 1)

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
    doc.triangle(
      cx,
      cy,
      cx + Math.cos(a1) * radius,
      cy + Math.sin(a1) * radius,
      cx + Math.cos(a2) * radius,
      cy + Math.sin(a2) * radius,
      "F",
    )
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
    const value = Math.max(0, d.value)
    const pct = (value / total) * 100
    doc.setFillColor(...d.color)
    doc.rect(legendX, legendCurrentY - 2.5, 3, 3, "F")
    doc.setFontSize(7)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(...COLORS.text)
    doc.text(`${d.label} (${pct.toFixed(1)}%)`, legendX + 5, legendCurrentY)
    doc.setFont("helvetica", "bold")
    doc.text(formatValue(value), legendX + 58, legendCurrentY)
    legendCurrentY += 4.6
  })

  return legendCurrentY
}

export type MenuPDFType = "cliente" | "interno"

export interface MenuPDFOptions {
  type: MenuPDFType
  businessName?: string
}

export function generateMenuPDF(menu: Menu, recipes: Recipe[], options: MenuPDFOptions): jsPDF {
  // La copia cliente queda siempre en naranja de marca fijo (es lo que ve el comensal,
  // ver docs/36 sección 1: "fuera de la sesión: naranja fijo"). La copia interna sí
  // refleja el tema elegido por el negocio, igual que el resto de la app en sesión.
  COLORS.primary = options.type === "interno" ? getBusinessThemeRgb(menu.businessId) : BRAND_ORANGE_RGB
  CHART_COLORS[0] = COLORS.primary

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
  const recipeById = new Map(recipes.map((r) => [r.id, r]))
  const sortedSteps = [...menu.steps].sort((a, b) => a.order - b.order)

  if (options.type === "interno") {
    generateInternalMenuPDF(doc, menu, recipeById, sortedSteps, options)
  } else {
    generateClientMenuPDF(doc, menu, recipeById, sortedSteps, options)
  }

  return doc
}

// ============== CARTA DE CLIENTE (minimalista, elegante) ==============

function generateClientMenuPDF(
  doc: jsPDF,
  menu: Menu,
  recipeById: Map<string, Recipe>,
  sortedSteps: Menu["steps"],
  options: MenuPDFOptions,
) {
  const labels = getPdfLabels()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 24
  const contentWidth = pageWidth - 2 * margin
  let yPosition = margin

  const checkNewPage = (requiredSpace: number) => {
    if (yPosition + requiredSpace > pageHeight - 22) {
      doc.addPage()
      drawClientPageFrame()
      yPosition = margin + 6
    }
  }

  // Marco fino a todo el borde de la pagina — el detalle que hace que se sienta
  // impresa como una carta, no como un reporte.
  const drawClientPageFrame = () => {
    doc.setDrawColor(190, 170, 130)
    doc.setLineWidth(0.3)
    doc.rect(8, 8, pageWidth - 16, pageHeight - 16, "S")
  }
  drawClientPageFrame()

  doc.setFont("times", "italic")
  doc.setFontSize(9)
  doc.setTextColor(...COLORS.secondary)
  doc.text(sanitizeText(options.businessName) || "GastroMetrics", pageWidth / 2, yPosition, { align: "center" })
  yPosition += 12

  doc.setFont("times", "bold")
  doc.setFontSize(26)
  doc.setTextColor(...COLORS.text)
  doc.text(sanitizeText(menu.name) || "Menu", pageWidth / 2, yPosition, { align: "center" })
  yPosition += 3

  const subtitleParts = [
    sanitizeText(menu.menuType),
    menu.serviceDate ? new Date(menu.serviceDate + "T00:00:00").toLocaleDateString(labels.locale) : "",
  ].filter(Boolean)
  if (subtitleParts.length > 0) {
    yPosition += 6
    doc.setFont("times", "italic")
    doc.setFontSize(10)
    doc.setTextColor(...COLORS.secondary)
    doc.text(subtitleParts.join("  ·  "), pageWidth / 2, yPosition, { align: "center" })
  }

  yPosition += 6
  doc.setDrawColor(190, 170, 130)
  doc.setLineWidth(0.3)
  doc.line(pageWidth / 2 - 22, yPosition, pageWidth / 2 + 22, yPosition)
  yPosition += 16

  for (const step of sortedSteps) {
    const stepItems = menu.items.filter((item) => item.stepId === step.id && item.enabled)
    if (stepItems.length === 0) continue

    checkNewPage(16 + stepItems.length * 10)

    // Encabezado de tiempo: mayusculas espaciadas entre dos lineas finas, como en una
    // carta real — nada de fondos ni cajas.
    const stepLabel = sanitizeText(step.name).toUpperCase()
    doc.setFont("times", "bold")
    doc.setFontSize(12)
    doc.setTextColor(...COLORS.text)
    const stepLabelWidth = doc.getTextWidth(stepLabel.split("").join("  "))
    doc.text(stepLabel.split("").join("  "), pageWidth / 2, yPosition, { align: "center" })
    const lineY = yPosition - 1.5
    const lineGap = stepLabelWidth / 2 + 6
    doc.setLineWidth(0.25)
    doc.line(margin, lineY, pageWidth / 2 - lineGap, lineY)
    doc.line(pageWidth / 2 + lineGap, lineY, pageWidth - margin, lineY)
    yPosition += 10

    for (const item of stepItems) {
      checkNewPage(12)
      const recipe = recipeById.get(item.recipeId)
      const price = item.priceOverride ?? recipe?.unitPrice ?? 0
      const name = sanitizeText(item.label) || sanitizeText(recipe?.name) || "-"

      doc.setFont("times", "normal")
      doc.setFontSize(12)
      doc.setTextColor(...COLORS.text)
      doc.text(name, margin, yPosition)

      const priceText = formatCurrency(price)
      doc.setFont("times", "bold")
      doc.text(priceText, pageWidth - margin, yPosition, { align: "right" })

      const nameWidth = doc.getTextWidth(name)
      const priceWidth = doc.getTextWidth(priceText)
      const dotsStartX = margin + nameWidth + 3
      const dotsEndX = pageWidth - margin - priceWidth - 3
      if (dotsEndX > dotsStartX) {
        doc.setDrawColor(...COLORS.tableBorder)
        doc.setLineDashPattern([0.4, 1.4], 0)
        doc.line(dotsStartX, yPosition - 1.2, dotsEndX, yPosition - 1.2)
        doc.setLineDashPattern([], 0)
      }

      yPosition += 10
    }
    yPosition += 6
  }

  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFont("times", "italic")
    doc.setFontSize(7.5)
    doc.setTextColor(...COLORS.secondary)
    doc.text(sanitizeText(options.businessName) || "GastroMetrics", pageWidth / 2, pageHeight - 12, { align: "center" })
  }
}

// ============== COPIA INTERNA (costo, precio, margen + graficos) ==============

function generateInternalMenuPDF(
  doc: jsPDF,
  menu: Menu,
  recipeById: Map<string, Recipe>,
  sortedSteps: Menu["steps"],
  options: MenuPDFOptions,
) {
  const labels = getPdfLabels()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 15
  const contentWidth = pageWidth - 2 * margin
  let yPosition = margin

  const checkNewPage = (requiredSpace: number) => {
    if (yPosition + requiredSpace > pageHeight - 20) {
      doc.addPage()
      yPosition = margin
    }
  }

  doc.setFillColor(...COLORS.primary)
  doc.rect(0, 0, pageWidth, 30, "F")
  doc.setFontSize(9)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(...COLORS.white)
  doc.text(sanitizeText(options.businessName) || "GastroMetrics", margin, 10)

  doc.setFillColor(185, 28, 28)
  doc.rect(pageWidth - margin - 48, 4, 48, 6, "F")
  doc.setFontSize(7)
  doc.setFont("helvetica", "bold")
  doc.text("COPIA INTERNA", pageWidth - margin - 24, 8, { align: "center" })
  doc.setTextColor(...COLORS.white)

  doc.setFontSize(20)
  doc.setFont("helvetica", "bold")
  doc.text(sanitizeText(menu.name) || "Menu", pageWidth / 2, 20, { align: "center" })

  doc.setFontSize(9)
  doc.setFont("helvetica", "normal")
  const subtitleParts = [
    sanitizeText(menu.menuType),
    menu.serviceDate ? new Date(menu.serviceDate + "T00:00:00").toLocaleDateString(labels.locale) : "",
  ].filter(Boolean)
  if (subtitleParts.length > 0) {
    doc.text(subtitleParts.join(" - "), pageWidth / 2, 26, { align: "center" })
  }

  yPosition = 40

  let totalCost = 0
  let totalPrice = 0
  let totalItems = 0
  const dishStats: { name: string; cost: number; price: number; marginPct: number }[] = []

  for (const step of sortedSteps) {
    const stepItems = menu.items.filter((item) => item.stepId === step.id && item.enabled)
    if (stepItems.length === 0) continue

    checkNewPage(20)

    doc.setFillColor(...COLORS.lightGray)
    doc.rect(margin, yPosition, contentWidth, 8, "F")
    doc.setFontSize(11)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(...COLORS.darkGray)
    doc.text(sanitizeText(step.name).toUpperCase(), margin + 3, yPosition + 5.5)
    yPosition += 12

    const rows = stepItems.map((item) => {
      const recipe = recipeById.get(item.recipeId)
      const price = item.priceOverride ?? recipe?.unitPrice ?? 0
      const cost = recipe?.costPerServing ?? 0
      const marginPct = price > 0 ? ((price - cost) / price) * 100 : 0
      const name = sanitizeText(item.label) || sanitizeText(recipe?.name) || "-"
      totalCost += cost
      totalPrice += price
      totalItems += 1
      dishStats.push({ name, cost, price, marginPct })
      return [name, formatCurrency(cost), formatCurrency(price), `${marginPct.toFixed(1)}%`]
    })

    autoTable(doc, {
      startY: yPosition,
      head: [["Plato", "Costo", "Precio", "Margen"]],
      body: rows,
      theme: "grid",
      margin: { left: margin, right: margin },
      headStyles: { fillColor: COLORS.tableHeader, textColor: COLORS.white, fontSize: 8, fontStyle: "bold" },
      bodyStyles: { fontSize: 8, textColor: COLORS.text },
      columnStyles: {
        0: { cellWidth: "auto" },
        1: { cellWidth: 25, halign: "right" },
        2: { cellWidth: 25, halign: "right" },
        3: { cellWidth: 22, halign: "right" },
      },
    })
    yPosition = (doc as any).lastAutoTable.finalY + 8
  }

  if (totalItems > 0) {
    checkNewPage(25)
    doc.setDrawColor(...COLORS.tableBorder)
    doc.setLineWidth(0.3)
    doc.line(margin, yPosition, pageWidth - margin, yPosition)
    yPosition += 6

    const overallMargin = totalPrice > 0 ? ((totalPrice - totalCost) / totalPrice) * 100 : 0

    doc.setFillColor(...COLORS.lightGray)
    doc.rect(margin, yPosition, contentWidth, 18, "F")
    doc.setFontSize(9)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(...COLORS.darkGray)
    doc.text(`Costo total del menu (${totalItems} platos)`, margin + 3, yPosition + 6)
    doc.text("Precio total del menu", margin + 3, yPosition + 12)

    doc.setFont("helvetica", "bold")
    doc.text(formatCurrency(totalCost), pageWidth - margin - 45, yPosition + 6, { align: "right" })
    doc.text(formatCurrency(totalPrice), pageWidth - margin - 45, yPosition + 12, { align: "right" })

    doc.setFontSize(11)
    doc.setTextColor(...COLORS.primary)
    doc.text(`Margen: ${overallMargin.toFixed(1)}%`, pageWidth - margin - 3, yPosition + 9, { align: "right" })

    yPosition += 26

    // ===== GRAFICOS: margen por plato (barras) + composicion del precio total (pastel) =====
    // Pedido explicito: los PDFs internos/administrativos deben llevar la mayor cantidad
    // de informacion, con estadisticas de barra y pastel.
    const chartsHeight = 60
    checkNewPage(chartsHeight + 10)

    doc.setFontSize(10)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(...COLORS.darkGray)
    doc.text("DISTRIBUCION VISUAL", margin, yPosition)
    yPosition += 6

    const chartsTop = yPosition
    const halfWidth = contentWidth / 2 - 4

    doc.setFontSize(8)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(...COLORS.secondary)
    doc.text("Margen por plato (%)", margin, chartsTop)
    const barData: ChartDatum[] = dishStats
      .slice(0, 8)
      .map((d, i) => ({ label: d.name, value: d.marginPct, color: CHART_COLORS[i % CHART_COLORS.length] }))
    const barsEndY = drawBarChart(doc, barData, margin, chartsTop + 4, halfWidth, (n) => `${n.toFixed(1)}%`)

    const pieColX = margin + halfWidth + 8
    doc.setFontSize(8)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(...COLORS.secondary)
    doc.text("Composicion del precio total por plato", pieColX, chartsTop)

    const sortedByPrice = [...dishStats].sort((a, b) => b.price - a.price)
    const topDishes = sortedByPrice.slice(0, 5)
    const otherTotal = sortedByPrice.slice(5).reduce((sum, d) => sum + d.price, 0)
    const pieData: ChartDatum[] = topDishes.map((d, i) => ({
      label: d.name,
      value: d.price,
      color: CHART_COLORS[i % CHART_COLORS.length],
    }))
    if (otherTotal > 0) {
      pieData.push({ label: "Otros", value: otherTotal, color: CHART_COLORS[CHART_COLORS.length - 1] })
    }

    const pieRadius = 15
    const pieCx = pieColX + pieRadius + 2
    const pieCy = chartsTop + 6 + pieRadius
    const pieLegendX = pieCx + pieRadius + 8
    const pieEndY =
      pieData.length > 0
        ? drawPieChart(doc, pieData, pieCx, pieCy, pieRadius, pieLegendX, chartsTop + 8, (n) => formatCurrency(n))
        : chartsTop

    yPosition = Math.max(barsEndY, pieEndY, chartsTop + chartsHeight) + 6
  }

  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(...COLORS.secondary)
    doc.text(`GastroMetrics | ${i} / ${totalPages}`, pageWidth / 2, pageHeight - 8, { align: "center" })
  }
}
