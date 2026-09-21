import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import type { Recipe, PDFExportType, PDFExportOptions } from "@/types/recipe"
import { formatCurrency } from "@/lib/utils/consolidated-utils"
import { getPdfLabels, getCurrentPdfLanguage } from "@/lib/i18n/pdf-labels"
import { drawBusinessLogo } from "./pdf-logo"
import { getBusinessThemeRgb, getBusinessThemeTintRgb } from "@/lib/theme-colors"
import { getYieldUnitLabel } from "@/lib/ingredient-labels"

// ============== HELPERS ==============

/**
 * Sanitize text to remove emojis and control characters that cause issues in jsPDF
 */
const sanitizeText = (input: string | undefined | null): string =>
  (input ?? "")
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, "")
    .replace(/[\u{2600}-\u{26FF}]/gu, "")
    .replace(/[\u{2700}-\u{27BF}]/gu, "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim()

// Rendimiento traducido al idioma del PDF (ver types/recipe.ts#yieldUnits) — antes se
// imprimía recipe.yieldUnit crudo; fallback a "g" para recetas guardadas antes de que
// este selector existiera (el default histórico, ver docs/115).
const yieldUnitLabel = (recipe: Recipe): string =>
  sanitizeText(getYieldUnitLabel(recipe.yieldUnit || "g", getCurrentPdfLanguage()))

/**
 * NOTA (ver documento de continuidad): existía aquí una copia local de formatCurrency
 * fijada a "HNL" que ignoraba la moneda elegida en Configuración. Se elimina — todas
 * las llamadas usan ahora el formatCurrency importado arriba, que sí respeta la moneda.
 */
const formatCurrency2 = formatCurrency
/**
 * Format percentage
 */
const formatPercent = (value: number): string => `${(value || 0).toFixed(2)}%`

/**
 * BUG CORREGIDO (hallazgo de uso real): las celdas de la fila de resumen de costos y
 * la caja de "Ganancia Neta" imprimen el valor con un tamano de fuente fijo sin
 * chequear si cabe en el ancho disponible — con datos de entrada fuera de rango (o
 * simplemente un negocio con montos altos) el numero se sale de su celda y queda
 * montado sobre la celda vecina. En vez de truncar el numero (perderia un digito sin
 * avisar), se reduce el tamano de fuente hasta que quepa, con un piso legible.
 * Devuelve el tamano usado y deja el fontSize del doc en ese valor.
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

// ============== COLORS ==============
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

// Paleta categórica para gráficos (barras/pastel) de la copia administrativa — distinta
// de COLORS (que es para la interfaz fija del documento), pensada para que 6-8 series
// se distingan bien una de otra incluso impresas en blanco y negro (varía tono, no solo
// saturación).
const CHART_COLORS: [number, number, number][] = [
  [41, 98, 255], // azul
  [220, 38, 38], // rojo
  [21, 128, 61], // verde
  [217, 119, 6], // ambar
  [124, 58, 237], // morado
  [8, 145, 178], // cian
  [190, 24, 93], // magenta
  [107, 114, 128], // gris (para "Otros")
]

// ============== GRAFICOS (barra horizontal y pastel) ==============
// jsPDF no trae charting — se dibujan a mano con sus primitivas: rect() para las barras
// y un abanico de triangle() para cada porcion del pastel (mas confiable que construir un
// path de arco con lines(), que exige llevar la cuenta exacta de deltas relativos).

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
    // BUG CORREGIDO (hallazgo de uso real): la opcion `maxWidth` de jsPDF no trunca,
    // envuelve el texto en varias lineas — con una etiqueta que no cabe (un rubro con
    // nombre largo, o traducido a un idioma mas largo que el espanol) la segunda linea
    // se dibujaba fuera del alto reservado para esta fila (barHeight + gap) y quedaba
    // montada sobre la barra de la fila siguiente. Se trunca con "…" en una sola linea
    // en su lugar.
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
  const steps = Math.max(1, Math.ceil(sliceAngle / (Math.PI / 18))) // ~10 grados por triangulo
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

  // BUG CORREGIDO (hallazgo de uso real): el valor se dibujaba siempre a
  // legendX + 58, un offset fijo pensado para una columna mas ancha de la que en
  // realidad queda disponible junto al pastel — con un nombre de ingrediente largo
  // (o un porcentaje de 2 digitos) la etiqueta invadia esa posicion y el texto del
  // monto quedaba montado literalmente encima de la etiqueta. Ahora el monto se
  // ancla al borde derecho real de la leyenda (legendX + legendWidth) y la etiqueta
  // se trunca con "…" para dejarle siempre el espacio que necesita.
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

// ============== MAIN GENERATOR ==============

export function generateRecipePDF(recipe: Recipe, options: PDFExportOptions): jsPDF {
  // El color de acento del PDF sale del tema del negocio, no de una constante fija (ver
  // docs/36, sección 5) — se aplica sobre el mismo objeto COLORS/CHART_COLORS que ya
  // usa el resto del archivo, así que no hace falta tocar cada punto donde se dibuja.
  COLORS.primary = getBusinessThemeRgb(recipe.businessId)
  COLORS.highlightBg = getBusinessThemeTintRgb(recipe.businessId)
  CHART_COLORS[0] = COLORS.primary

  const labels = getPdfLabels()
  const isLandscape = options.type === "administrative"

  const doc = new jsPDF({
    orientation: isLandscape ? "landscape" : "portrait",
    unit: "mm",
    format: "a4",
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 12
  const contentWidth = pageWidth - 2 * margin
  let yPosition = margin

  // ============== HELPER FUNCTIONS ==============

  const addPageNumber = (pageNum: number, totalPages: number) => {
    doc.setFontSize(8)
    doc.setTextColor(...COLORS.secondary)
    doc.text(`GastroMetrics | ${labels.pagina} ${pageNum} ${labels.de} ${totalPages}`, pageWidth / 2, pageHeight - 8, { align: "center" })
  }

  const checkNewPage = (requiredSpace: number): boolean => {
    if (yPosition + requiredSpace > pageHeight - 20) {
      doc.addPage()
      yPosition = margin
      return true
    }
    return false
  }

  const drawLine = (y: number, color: [number, number, number] = COLORS.tableBorder) => {
    doc.setDrawColor(...color)
    doc.setLineWidth(0.3)
    doc.line(margin, y, pageWidth - margin, y)
  }

  // ============== GENERATE BY TYPE ==============

  if (options.type === "administrative") {
    generateAdministrativePDF(doc, recipe, options, {
      pageWidth,
      pageHeight,
      margin,
      contentWidth,
      yPosition,
      checkNewPage,
      drawLine,
    })
  } else if (options.type === "employee") {
    generateEmployeePDF(doc, recipe, options, {
      pageWidth,
      pageHeight,
      margin,
      contentWidth,
      yPosition,
      checkNewPage,
      drawLine,
    })
  } else {
    generateNormalPDF(doc, recipe, options, {
      pageWidth,
      pageHeight,
      margin,
      contentWidth,
      yPosition,
      checkNewPage,
      drawLine,
    })
  }

  // Add page numbers to all pages
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    addPageNumber(i, totalPages)
  }

  return doc
}

// ============== ADMINISTRATIVE PDF (LANDSCAPE - EXCEL STYLE) ==============

function generateAdministrativePDF(
  doc: jsPDF,
  recipe: Recipe,
  options: PDFExportOptions,
  ctx: {
    pageWidth: number
    pageHeight: number
    margin: number
    contentWidth: number
    yPosition: number
    checkNewPage: (space: number) => boolean
    drawLine: (y: number, color?: [number, number, number]) => void
  }
) {
  const labels = getPdfLabels()
  const { pageWidth, pageHeight, margin, contentWidth } = ctx
  let yPosition = ctx.yPosition

  // ===== HEADER (Thin, professional) =====
  // Alto subido de 18 a 20 junto con el corrimiento de las fechas de abajo (ver nota
  // en "Right: Dates") para que la segunda linea de fecha (y=17) no quede pegada al
  // borde inferior del encabezado.
  doc.setFillColor(...COLORS.lightGray)
  doc.rect(0, 0, pageWidth, 20, "F")
  drawLine(20, COLORS.tableBorder)

  // Left: Business name & logo
  if (options.businessLogo) {
    drawBusinessLogo(doc, options.businessLogo, margin, 3, 12, 12)
  }

  doc.setFontSize(10)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(...COLORS.text)
  doc.text(sanitizeText(options.businessName) || "GastroMetrics", margin + (options.businessLogo ? 15 : 0), 10)

  // Franja de identificación: distingue de un vistazo esta copia (con costos y
  // márgenes) de la copia de cocina, que no lleva esta información financiera.
  doc.setFillColor(185, 28, 28) // rojo, ya que contiene información financiera sensible
  doc.rect(pageWidth - margin - 62, 3, 62, 6, "F")
  doc.setFontSize(7)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(255, 255, 255)
  doc.text(labels.copiaAdministrativa, pageWidth - margin - 31, 7, { align: "center" })
  doc.setTextColor(...COLORS.text)

  // Una línea explicativa además del badge — pedido explícito: que el tipo de copia
  // "se explique solo" sin que quien lo recibe tenga que deducirlo del color.
  doc.setFontSize(7)
  doc.setFont("helvetica", "italic")
  doc.setTextColor(...COLORS.secondary)
  doc.text(labels.copiaAdministrativaSubtitle, margin + (options.businessLogo ? 15 : 0), 20)
  doc.setTextColor(...COLORS.text)

  // Center: Title
  // BUG CORREGIDO (hallazgo de uso real: el titulo decia literalmente "Ficha Tecnica
  // - Plato"/"Ficha Tecnica - Subreceta", la misma palabra generica para cualquier
  // receta, en vez del nombre real). Ahora usa el nombre de la receta, truncado igual
  // que el nombre en el bloque de metadata de abajo para que un nombre largo no se
  // salga de la franja central.
  const isSubRecipe = recipe.classification?.includes("Sub Receta") || recipe.isSubRecipe
  const titlePrefix = `${labels.fichaTecnicaTitulo} - `
  const titleRecipeName = sanitizeText(recipe.name)
  const shortTitleRecipeName =
    titleRecipeName.length > 40 ? titleRecipeName.substring(0, 40) + "..." : titleRecipeName
  const titleText = `${titlePrefix}${shortTitleRecipeName}`
  doc.setFontSize(12)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(...COLORS.darkGray)
  doc.text(titleText, pageWidth / 2, 10, { align: "center" })

  // Right: Dates
  // BUG CORREGIDO (hallazgo de uso real: estas dos lineas se dibujaban en y=7 y y=12,
  // ambas ancladas al mismo borde derecho que la franja roja "COPIA ADMINISTRATIVA"
  // (que ocupa y=3 a y=9) — la primera linea quedaba literalmente encima de esa franja,
  // texto sobre texto. Se bajan ambas por debajo de la franja, sin tocarla.
  doc.setFontSize(8)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(...COLORS.secondary)
  const updatedAt = recipe.metadata?.updatedAt
    ? new Date(recipe.metadata.updatedAt).toLocaleDateString(labels.locale)
    : "N/A"
  const exportedAt = new Date().toLocaleDateString(labels.locale)
  doc.text(`${labels.ultimaRevision}: ${updatedAt}`, pageWidth - margin, 13, { align: "right" })
  doc.text(`${labels.exportado}: ${exportedAt}`, pageWidth - margin, 17, { align: "right" })

  yPosition = 26

  // ===== METADATA BLOCK (Grid style) =====
  doc.setFillColor(...COLORS.highlightBg)
  doc.rect(margin, yPosition, contentWidth, 22, "F")
  doc.setDrawColor(...COLORS.tableBorder)
  doc.rect(margin, yPosition, contentWidth, 22, "S")

  const metaY = yPosition + 5
  const col1X = margin + 3
  const col2X = margin + contentWidth * 0.35
  const col3X = margin + contentWidth * 0.65

  doc.setFontSize(9)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(...COLORS.darkGray)

  // Column 1
  doc.text(labels.nombre, col1X, metaY)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(...COLORS.text)
  // Se trunca igual que la clasificacion abajo: un nombre largo sin limite invadia
  // el texto de la columna 2 (Etapa/Estacion), quedando un texto sobre el otro.
  const nameText = sanitizeText(recipe.name)
  const shortName = nameText.length > 32 ? nameText.substring(0, 32) + "..." : nameText
  doc.text(shortName, col1X + 18, metaY)

  doc.setFont("helvetica", "bold")
  doc.setTextColor(...COLORS.darkGray)
  doc.text(labels.clasificacion, col1X, metaY + 6)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(...COLORS.text)
  const classText = sanitizeText(recipe.classification)
  const shortClass = classText.length > 35 ? classText.substring(0, 35) + "..." : classText
  doc.text(shortClass, col1X + 24, metaY + 6)

  // BUG CORREGIDO (hallazgo de auditoria externa, ver docs/98/99): estas dos celdas
  // imprimian "N/A" cuando la receta no tenia plato/etapa cargados — el PDF quedaba
  // ensuciado con campos vacios etiquetados. Ahora, si no hay dato, no se imprime ni
  // la etiqueta ni el valor (la celda del grid queda en blanco en vez de "Plato: N/A").
  const platoText = sanitizeText(recipe.plate)
  if (platoText) {
    doc.setFont("helvetica", "bold")
    doc.setTextColor(...COLORS.darkGray)
    doc.text(labels.plato, col1X, metaY + 12)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(...COLORS.text)
    doc.text(platoText, col1X + 13, metaY + 12)
  }

  // Column 2
  const stepText = sanitizeText(recipe.step)
  if (stepText) {
    doc.setFont("helvetica", "bold")
    doc.setTextColor(...COLORS.darkGray)
    doc.text(labels.etapaEstacion, col2X, metaY)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(...COLORS.text)
    doc.text(stepText, col2X + 28, metaY)
  }

  doc.setFont("helvetica", "bold")
  doc.setTextColor(...COLORS.darkGray)
  doc.text(labels.porciones, col2X, metaY + 6)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(...COLORS.text)
  doc.text(String(recipe.servings || 1), col2X + 21, metaY + 6)

  // Column 3
  doc.setFont("helvetica", "bold")
  doc.setTextColor(...COLORS.darkGray)
  doc.text(labels.rendimiento, col3X, metaY)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(...COLORS.text)
  doc.text(`${recipe.yieldAmount} ${yieldUnitLabel(recipe)}`, col3X + 24, metaY)

  // Calculate yield by weight if applicable
  const yieldByWeight =
    recipe.yieldByWeight ||
    recipe.ingredients?.reduce((sum, ing) => {
      const unit = ing.unit?.toLowerCase() || ""
      if (unit.includes("g") || unit.includes("ml") || unit.includes("kg") || unit.includes("l")) {
        return sum + (ing.quantity || 0)
      }
      return sum
    }, 0)

  if (yieldByWeight && yieldByWeight > 0) {
    doc.setFont("helvetica", "bold")
    doc.setTextColor(...COLORS.darkGray)
    doc.text(labels.rendPesoEstimado, col3X, metaY + 6)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(...COLORS.text)
    const weightDisplay = yieldByWeight >= 1000 ? `${(yieldByWeight / 1000).toFixed(2)} kg` : `${yieldByWeight.toFixed(0)} g`
    doc.text(weightDisplay, col3X + 35, metaY + 6)
  }

  yPosition += 28

  // ===== COST SUMMARY ROW (Excel style horizontal) =====
  const costSummaryHeight = 14
  doc.setFillColor(...COLORS.tableHeader)
  doc.rect(margin, yPosition, contentWidth, costSummaryHeight, "F")

  const yieldAmount = recipe.yieldAmount || 1
  const totalCost = recipe.totalCost || 0
  const costPerUnit = totalCost / yieldAmount
  const unitProfit = recipe.customUnitProfit || (recipe.unitPrice ? recipe.unitPrice - costPerUnit : 0)
  const unitPrice = recipe.unitPrice || 0
  const totalSales = unitPrice * yieldAmount
  const netProfitTotal = recipe.netProfit || totalSales - totalCost

  // Una sub-receta nunca se vende directo a un cliente — es un componente interno que
  // se usa DENTRO de otras fichas. Mostrarle "Precio Unit.", "Venta Total" y una caja
  // verde de "Ganancia Neta" es engañoso (esos numeros no significan nada para algo que
  // no se vende solo). En su lugar se muestra unicamente el costo de produccion, el
  // rendimiento y el costo unitario — que es exactamente el "costo de uso" que se
  // arrastra cuando esta sub-receta se agrega como ingrediente en otra ficha
  // (hallazgo de auditoria externa, ver docs/98, seccion 2.6).
  const summaryData = isSubRecipe
    ? [
        { label: labels.costoProduccion, value: formatCurrency2(totalCost) },
        { label: labels.rendimiento.replace(":", ""), value: `${yieldAmount} ${yieldUnitLabel(recipe)}` },
        { label: labels.costoDeUso, value: formatCurrency2(costPerUnit) },
      ]
    : [
        { label: labels.costoProduccion, value: formatCurrency2(totalCost) },
        { label: labels.rendimiento.replace(":", ""), value: `${yieldAmount} ${yieldUnitLabel(recipe)}` },
        { label: labels.costoUnitario, value: formatCurrency2(costPerUnit) },
        { label: labels.gananciaUnitaria, value: formatCurrency2(unitProfit) },
        { label: labels.precioUnitario, value: formatCurrency2(unitPrice) },
        { label: labels.ventaTotal, value: formatCurrency2(totalSales) },
      ]

  const cellWidth = (contentWidth - (isSubRecipe ? 4 : 50)) / summaryData.length
  const cellInnerWidth = cellWidth - 3 // pequeno margen para que no toque la celda vecina
  doc.setFontSize(7)

  summaryData.forEach((item, i) => {
    const x = margin + 2 + i * cellWidth
    doc.setFont("helvetica", "normal")
    doc.setTextColor(...COLORS.white)
    fitFontSize(doc, item.label, cellInnerWidth, 7)
    doc.text(item.label, x, yPosition + 5)
    doc.setFont("helvetica", "bold")
    fitFontSize(doc, item.value, cellInnerWidth, 7)
    doc.text(item.value, x, yPosition + 10)
  })

  if (!isSubRecipe) {
    // Net Profit box
    const netProfitBoxX = pageWidth - margin - 48
    doc.setFillColor(46, 125, 50) // Green
    doc.rect(netProfitBoxX, yPosition, 46, costSummaryHeight, "F")
    doc.setFontSize(7)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(...COLORS.white)
    doc.text(`${labels.gananciaNeta} ${labels.total}`, netProfitBoxX + 2, yPosition + 5)
    doc.setFont("helvetica", "bold")
    const netProfitText = formatCurrency2(netProfitTotal)
    fitFontSize(doc, netProfitText, 46 - 4, 9)
    doc.text(netProfitText, netProfitBoxX + 2, yPosition + 11)
  }

  yPosition += costSummaryHeight + 6

  // ===== ADVERTENCIAS DE DATOS (hallazgo de uso real, ver feedback externo) =====
  // Con datos de entrada muy fuera de rango (p.ej. 150 unidades de un ingrediente
  // caro) la ficha imprime costos/precios de seis cifras sin ningun aviso, restando
  // credibilidad al documento ("COPIA ADMINISTRATIVA - CONFIDENCIAL" con numeros
  // imposibles). Dos señales objetivas y sin umbrales de moneda fijos (la app es
  // multi-moneda):
  {
    const warnings: string[] = []
    if (!isSubRecipe && totalSales > 0 && totalCost > totalSales) {
      warnings.push(labels.advertenciaCostoSuperaVenta)
    }
    // Misma regla que components/technical-sheet/index.tsx (calculations.yieldSanityWarning,
    // hallazgo de auditoria externa, docs/98 seccion 2.6: ej. "rendimiento 1 g con 200
    // huevos") duplicada aqui a proposito — no depende de conversion de unidades
    // (compara solo contra ingredientes medidos en "unidad", piezas contables), asi
    // que un solo ingrediente ya es suficiente para detectarla, sin necesitar otros
    // ingredientes de referencia. Es el caso real que las senales anteriores (costo
    // vs precio) no cubrian: el precio de venta tambien se calcula a partir del mismo
    // costo inflado, asi que nunca queda por debajo de el.
    if (recipe.yieldAmount > 0) {
      const maxUnitIngredient = recipe.ingredients.reduce(
        (max, ing) => (ing.unit === "unidad" && ing.quantity > max.quantity ? { name: ing.name, quantity: ing.quantity } : max),
        { name: "", quantity: 0 },
      )
      if (maxUnitIngredient.quantity >= recipe.yieldAmount * 20) {
        warnings.push(
          labels.advertenciaRendimientoBajo
            .replace("{rendimiento}", `${recipe.yieldAmount} ${yieldUnitLabel(recipe)}`)
            .replace("{ingrediente}", sanitizeText(maxUnitIngredient.name))
            .replace("{cantidad}", `${maxUnitIngredient.quantity} unidad`),
        )
      }
    }

    if (warnings.length > 0) {
      const warnLineHeight = 4.2
      const warnHeight = 5 + warnings.length * warnLineHeight
      doc.setFillColor(255, 243, 205)
      doc.rect(margin, yPosition, contentWidth, warnHeight, "F")
      doc.setDrawColor(217, 119, 6)
      doc.setLineWidth(0.4)
      doc.rect(margin, yPosition, contentWidth, warnHeight, "S")
      doc.setFontSize(7.5)
      doc.setFont("helvetica", "bold")
      doc.setTextColor(146, 64, 14)
      doc.text(`${labels.advertenciaTitulo}:`, margin + 3, yPosition + 4.5)
      doc.setFont("helvetica", "normal")
      warnings.forEach((w, i) => {
        doc.text(w, margin + 3, yPosition + 4.5 + (i + 1) * warnLineHeight, { maxWidth: contentWidth - 6 })
      })
      yPosition += warnHeight + 5
    }
  }

  // ===== TWO COLUMN LAYOUT: Ingredients (left) + Cost Breakdown (right) =====
  // Una sub-receta no tiene rubros de venta (marketing, ganancia neta, etc. — esos
  // porcentajes son parte de COMO se fija el precio al cliente final, y una
  // sub-receta no se vende sola) asi que ese panel no se dibuja para ella; la tabla
  // de ingredientes usa entonces todo el ancho de contenido en vez de ceder una
  // columna a un panel que no aplica (hallazgo de uso real: el desglose de 6 rubros
  // seguia apareciendo en sub-recetas aun despues de que el resumen superior ya
  // mostrara solo "costo de uso").
  const leftColWidth = isSubRecipe ? contentWidth : contentWidth * 0.68
  const rightColWidth = contentWidth * 0.30
  const colGap = contentWidth * 0.02

  // Left: Ingredients Table
  doc.setFontSize(10)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(...COLORS.darkGray)
  doc.text(labels.ingredientes.toUpperCase(), margin, yPosition)

  // Se guarda el numero de pagina antes de la tabla de ingredientes: si esa tabla
  // se extiende sola a una pagina nueva, la tabla de Desglose de Costos (dibujada
  // aparte, a la derecha) ya no puede quedar "al lado" en la misma pagina, se
  // apilaria debajo en vez de superponerse con contenido de otra pagina.
  const pageBeforeIngredientsTable = doc.getNumberOfPages()

  const ingredientColumns = ["#", labels.categoria, labels.ingrediente, labels.cant, labels.medida, labels.costo, labels.extension]
  const ingredientRows = recipe.ingredients.map((ing, index) => [
    String(index + 1),
    sanitizeText(ing.category) || labels.general,
    sanitizeText(ing.name),
    ing.quantity.toFixed(2),
    sanitizeText(ing.unit),
    formatCurrency2(ing.unitCost || 0),
    formatCurrency2(ing.extension || ing.quantity * (ing.unitCost || 0)),
  ])

  // Add total row
  const totalExtension = recipe.ingredients.reduce(
    (sum, ing) => sum + (ing.extension || ing.quantity * (ing.unitCost || 0)),
    0
  )
  ingredientRows.push(["", "", labels.total, "", "", "", formatCurrency2(totalExtension)])

  autoTable(doc, {
    startY: yPosition + 3,
    head: [ingredientColumns],
    body: ingredientRows,
    theme: "grid",
    tableWidth: leftColWidth,
    margin: { left: margin },
    headStyles: {
      fillColor: COLORS.tableHeader,
      textColor: COLORS.white,
      fontSize: 7,
      fontStyle: "bold",
      halign: "center",
      cellPadding: 1.5,
    },
    bodyStyles: {
      fontSize: 7,
      textColor: COLORS.text,
      cellPadding: 1.5,
    },
    columnStyles: {
      0: { cellWidth: 8, halign: "center" },
      1: { cellWidth: 28 },
      2: { cellWidth: "auto" },
      3: { cellWidth: 14, halign: "right" },
      4: { cellWidth: 16, halign: "center" },
      5: { cellWidth: 22, halign: "right" },
      6: { cellWidth: 22, halign: "right" },
    },
    didParseCell: (data) => {
      // Style total row
      if (data.row.index === ingredientRows.length - 1) {
        data.cell.styles.fontStyle = "bold"
        data.cell.styles.fillColor = COLORS.lightGray
      }
    },
  })

  const ingredientsEndY = (doc as any).lastAutoTable.finalY
  const ingredientsTablePaginated = doc.getNumberOfPages() > pageBeforeIngredientsTable

  // Una sub-receta no se vende sola, asi que los rubros de venta (marketing, costos
  // operativos, ganancia neta, etc.) no aplican — ese panel completo se omite para
  // ella en vez de mostrar un desglose que no significa nada para algo que no tiene
  // precio de venta propio (misma logica ya aplicada arriba al resumen superior).
  let costBreakdown: { label: string; percent: number; amount: number }[] = []
  if (!isSubRecipe) {
    // Si la tabla de ingredientes se paso a una pagina nueva, Desglose de Costos ya
    // no puede dibujarse "al lado" de ella (quedaria calculado sobre una pagina que
    // ya no es la actual), se apila debajo en la pagina donde termino en su lugar.
    const rightColX = margin + leftColWidth + colGap
    const breakdownX = ingredientsTablePaginated ? margin : rightColX
    const breakdownWidth = ingredientsTablePaginated ? contentWidth : rightColWidth
    const breakdownHeadingY = ingredientsTablePaginated ? ingredientsEndY + 8 : yPosition

    doc.setFontSize(10)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(...COLORS.darkGray)
    doc.text(labels.desgloseDeCostos, breakdownX, breakdownHeadingY)

    const pricingConfig = recipe.pricingConfig || {
      publicServices: 10,
      marketing: 10,
      operationalCosts: 30,
      laborCosts: 35,
      netProfit: 25,
      isv: 0,
    }

    costBreakdown = [
      {
        label: labels.serviciosPublicos,
        percent: pricingConfig.publicServices,
        amount: totalCost * (pricingConfig.publicServices / 100),
      },
      { label: labels.marketing, percent: pricingConfig.marketing, amount: totalCost * (pricingConfig.marketing / 100) },
      {
        label: labels.costosOperativos,
        percent: pricingConfig.operationalCosts,
        amount: totalCost * (pricingConfig.operationalCosts / 100),
      },
      {
        label: labels.costosLaborales,
        percent: pricingConfig.laborCosts,
        amount: totalCost * (pricingConfig.laborCosts / 100),
      },
      { label: "ISV", percent: pricingConfig.isv, amount: totalCost * (pricingConfig.isv / 100) },
      { label: labels.gananciaNeta, percent: pricingConfig.netProfit, amount: totalCost * (pricingConfig.netProfit / 100) },
    ]

    const totalPercent = costBreakdown.reduce((sum, item) => sum + item.percent, 0)
    const totalAmount = costBreakdown.reduce((sum, item) => sum + item.amount, 0)

    const breakdownRows = costBreakdown.map((item) => [item.label, formatPercent(item.percent), formatCurrency2(item.amount)])
    breakdownRows.push([labels.total, formatPercent(totalPercent), formatCurrency2(totalAmount)])

    autoTable(doc, {
      startY: breakdownHeadingY + 3,
      head: [[labels.concepto, "%", labels.monto]],
      body: breakdownRows,
      theme: "grid",
      tableWidth: breakdownWidth,
      margin: { left: breakdownX },
      headStyles: {
        fillColor: COLORS.tableHeader,
        textColor: COLORS.white,
        fontSize: 7,
        fontStyle: "bold",
        halign: "center",
        cellPadding: 1.5,
      },
      bodyStyles: {
        fontSize: 7,
        textColor: COLORS.text,
        cellPadding: 1.5,
      },
      columnStyles: {
        0: { cellWidth: "auto" },
        1: { cellWidth: 15, halign: "right" },
        2: { cellWidth: 25, halign: "right" },
      },
      didParseCell: (data) => {
        if (data.row.index === breakdownRows.length - 1) {
          data.cell.styles.fontStyle = "bold"
          data.cell.styles.fillColor = COLORS.lightGray
        }
      },
    })
  }

  // Ambas tablas ya quedaron en la misma pagina final (o siempre estuvieron juntas
  // si no hubo paginacion), asi que comparar sus Y aqui es seguro. Para sub-recetas
  // no hubo segunda tabla que dibujar, asi que se usa directo el fin de ingredientes.
  yPosition = isSubRecipe
    ? ingredientsEndY + 8
    : Math.max(ingredientsEndY, (doc as any).lastAutoTable.finalY) + 8

  // ===== GRAFICOS: desglose de costos (barras) + composicion por ingrediente (pastel) =====
  // Pedido explicito: los PDFs administrativos/internos deben llevar la mayor cantidad de
  // informacion, con estadisticas de barra y pastel — la tabla de arriba ya da los numeros
  // exactos, esto da la lectura visual rapida encima.
  // Para una sub-receta sin barras (no tiene rubros de venta) y con un solo
  // ingrediente con costo (el pastel tampoco aplicaria, ver mas abajo), no queda
  // nada que graficar — se omite la seccion entera en vez de imprimir un
  // encabezado "DISTRIBUCION VISUAL" seguido de espacio en blanco.
  const chartableIngredientCount = recipe.ingredients.filter(
    (ing) => (ing.extension || ing.quantity * (ing.unitCost || 0)) > 0,
  ).length
  if (!isSubRecipe || chartableIngredientCount > 1) {
    const chartsHeight = 58
    if (yPosition + chartsHeight > pageHeight - 20) {
      doc.addPage()
      yPosition = margin
    }

    doc.setFontSize(10)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(...COLORS.darkGray)
    doc.text(labels.distribucionVisual, margin, yPosition)
    yPosition += 6

    const chartsTop = yPosition
    const halfWidth = contentWidth / 2 - 4

    // Barras: los 6 rubros de costeo (mismos datos que la tabla de Desglose de Costos).
    // No aplican a una sub-receta (no tiene esos rubros de venta, ver arriba), asi
    // que se omiten y el pastel de ingredientes usa el ancho completo en su lugar.
    let barsEndY = chartsTop
    if (!isSubRecipe) {
      doc.setFontSize(8)
      doc.setFont("helvetica", "bold")
      doc.setTextColor(...COLORS.secondary)
      doc.text(labels.rubrosDeCosteo, margin, chartsTop)
      const barData: ChartDatum[] = costBreakdown
        .filter((item) => item.amount > 0)
        .map((item, i) => ({ label: item.label, value: item.amount, color: CHART_COLORS[i % CHART_COLORS.length] }))
      barsEndY = drawBarChart(doc, barData, margin, chartsTop + 4, halfWidth, (n) => formatCurrency2(n))
    }

    // Pastel: composicion del costo de produccion por ingrediente (los que mas pesan,
    // agrupando el resto en "Otros") — util para saber donde se va el dinero, no solo
    // cuanto cuesta la receta en total. Con un solo ingrediente con costo el "pastel"
    // es un circulo completo de un solo color — no compara nada, asi que se omite del
    // todo en vez de imprimir un grafico sin informacion (hallazgo de auditoria
    // externa, ver docs/98, seccion 2.6).
    const ingredientCosts = recipe.ingredients
      .map((ing) => ({
        label: sanitizeText(ing.name) || labels.general,
        value: ing.extension || ing.quantity * (ing.unitCost || 0),
      }))
      .filter((i) => i.value > 0)
      .sort((a, b) => b.value - a.value)

    let pieEndY = chartsTop
    if (ingredientCosts.length > 1) {
      const pieColX = isSubRecipe ? margin : margin + halfWidth + 8
      doc.setFontSize(8)
      doc.setFont("helvetica", "bold")
      doc.setTextColor(...COLORS.secondary)
      doc.text(labels.composicionCostoPorIngrediente, pieColX, chartsTop)

      const topIngredients = ingredientCosts.slice(0, 5)
      const otherIngredientsTotal = ingredientCosts.slice(5).reduce((sum, i) => sum + i.value, 0)
      const pieData: ChartDatum[] = topIngredients.map((item, i) => ({
        ...item,
        color: CHART_COLORS[i % CHART_COLORS.length],
      }))
      if (otherIngredientsTotal > 0) {
        pieData.push({ label: labels.otros, value: otherIngredientsTotal, color: CHART_COLORS[CHART_COLORS.length - 1] })
      }

      const pieRadius = 15
      const pieCx = pieColX + pieRadius + 2
      const pieCy = chartsTop + 6 + pieRadius
      const pieLegendX = pieCx + pieRadius + 8
      // Ancho real disponible para la leyenda: desde donde empieza hasta el borde
      // derecho del area de contenido (antes se asumia un ancho fijo mas generoso
      // del que realmente queda en esta columna, ver nota dentro de drawPieChart).
      const pieLegendWidth = margin + contentWidth - pieLegendX
      pieEndY = drawPieChart(doc, pieData, pieCx, pieCy, pieRadius, pieLegendX, chartsTop + 8, pieLegendWidth, (n) =>
        formatCurrency2(n),
      )
    }

    yPosition = Math.max(barsEndY, pieEndY, chartsTop + chartsHeight) + 6
  }

  // ===== STATISTICS (Food cost %, margen, metodo de precio) =====
  // BUG CORREGIDO: el PDF administrativo no mostraba ninguna estadistica de
  // rentabilidad, solo el desglose de costos por rubro. Se agrega este bloque con
  // datos ya guardados en la receta (sin recalcular la formula de precio aqui, para
  // no duplicar esa logica — ver components/technical-sheet/index.tsx).
  // Igual que el desglose de costos, estas estadisticas parten del precio de venta
  // (food cost %, margen de contribucion, metodo de precio) — sin precio de venta
  // propio, una sub-receta las mostraria como 0%/0% de forma constante y enganosa,
  // asi que se omiten para ella.
  if (!isSubRecipe) {
    if (yPosition > pageHeight - 45) {
      doc.addPage()
      yPosition = margin
    }
    const statsFoodCostPct = totalSales > 0 ? (totalCost / totalSales) * 100 : 0
    const statsMarginPct = totalSales > 0 ? 100 - statsFoodCostPct : 0
    const methodLabel =
      recipe.pricingMethod === "food_cost"
        ? `Food Cost % (${labels.metaObjetivo} ${recipe.targetFoodCostPercent ?? 30}%)`
        : labels.metodoSeisRubros
    const priceOrigin =
      recipe.customUnitPrice !== undefined && recipe.customUnitPrice !== null
        ? labels.editadoManualmente
        : labels.calculadoAutomaticamente

    doc.setFontSize(10)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(...COLORS.darkGray)
    doc.text(labels.estadisticas.toUpperCase(), margin, yPosition)
    yPosition += 3

    const statsRows = [
      [labels.costoPorcentaje, `${statsFoodCostPct.toFixed(2)}%`],
      [labels.margenContribucion, `${statsMarginPct.toFixed(2)}%`],
      [labels.metodoPrecio, methodLabel],
      [labels.origenPrecio, priceOrigin],
    ]

    autoTable(doc, {
      startY: yPosition,
      body: statsRows,
      theme: "grid",
      tableWidth: contentWidth,
      margin: { left: margin },
      bodyStyles: {
        fontSize: 8,
        textColor: COLORS.text,
        cellPadding: 1.5,
      },
      columnStyles: {
        0: { cellWidth: 55, fontStyle: "bold", fillColor: COLORS.lightGray },
        1: { cellWidth: "auto" },
      },
    })

    yPosition = (doc as any).lastAutoTable.finalY + 8
  }

  // ===== PROCEDIMIENTO Y OBSERVACIONES (una sola lista numerada) =====
  // recipe.procedure ya es el campo único desde que se fusionó con observations en
  // components/technical-sheet/index.tsx — recipe.observations solo puede traer datos
  // en recetas exportadas antes de esa migración (nunca se reabrieron en la app desde
  // entonces), así que se sigue anexando aquí para no perder ese texto en el PDF.
  const allProcedureLines = [...(recipe.procedure || []), ...(recipe.observations || [])].filter((s) =>
    sanitizeText(s),
  )

  if (allProcedureLines.length > 0) {
    if (yPosition > pageHeight - 30) {
      doc.addPage()
      yPosition = margin
    }

    doc.setFontSize(10)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(...COLORS.darkGray)
    doc.text(`${labels.procedimiento} ${labels.y} ${labels.observaciones}`.toUpperCase(), margin, yPosition)
    yPosition += 6

    allProcedureLines.forEach((step, index) => {
      const stepText = sanitizeText(step)
      if (yPosition > pageHeight - 25) {
        doc.addPage()
        yPosition = margin
      }

      doc.setFontSize(8)
      doc.setFont("helvetica", "bold")
      doc.setTextColor(...COLORS.primary)
      doc.text(`${index + 1}.`, margin, yPosition)

      doc.setFont("helvetica", "normal")
      doc.setTextColor(...COLORS.text)
      const lines = doc.splitTextToSize(stepText, contentWidth - 10)
      doc.text(lines, margin + 6, yPosition)
      yPosition += lines.length * 4 + 3
    })
  }

  // ===== NOTES =====
  if (recipe.notes) {
    if (yPosition > pageHeight - 25) {
      doc.addPage()
      yPosition = margin
    }
    yPosition += 5
    doc.setFontSize(9)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(...COLORS.darkGray)
    doc.text(`${labels.notas.toUpperCase()}:`, margin, yPosition)
    yPosition += 4
    doc.setFont("helvetica", "normal")
    doc.setFontSize(8)
    doc.setTextColor(...COLORS.text)
    const notesLines = doc.splitTextToSize(sanitizeText(recipe.notes), contentWidth)
    doc.text(notesLines, margin, yPosition)
  }

  function drawLine(y: number, color: [number, number, number]) {
    doc.setDrawColor(...color)
    doc.setLineWidth(0.3)
    doc.line(margin, y, pageWidth - margin, y)
  }
}

// ============== EMPLOYEE PDF (PORTRAIT - OPERATIONAL) ==============

function generateEmployeePDF(
  doc: jsPDF,
  recipe: Recipe,
  options: PDFExportOptions,
  ctx: {
    pageWidth: number
    pageHeight: number
    margin: number
    contentWidth: number
    yPosition: number
    checkNewPage: (space: number) => boolean
    drawLine: (y: number, color?: [number, number, number]) => void
  }
) {
  const labels = getPdfLabels()
  const { pageWidth, margin, contentWidth } = ctx
  let yPosition = ctx.yPosition

  // Paleta cálida "libro de cocina" — deliberadamente distinta de la fría/corporativa
  // de la copia administrativa, para que se sienta como una tarjeta de receta y no como
  // una hoja de cálculo. Pedido explícito: "algo así como lo verías en un libro de cocina".
  const COOKBOOK = {
    cream: [250, 244, 231] as [number, number, number],
    amber: [180, 83, 9] as [number, number, number],
    amberLight: [253, 230, 195] as [number, number, number],
    brown: [69, 46, 24] as [number, number, number],
  }

  // ===== HEADER (calido) =====
  doc.setFillColor(...COOKBOOK.cream)
  doc.rect(0, 0, pageWidth, 32, "F")
  doc.setDrawColor(...COOKBOOK.amber)
  doc.setLineWidth(0.8)
  doc.line(0, 32, pageWidth, 32)

  if (options.businessLogo) {
    drawBusinessLogo(doc, options.businessLogo, margin, margin, 14, 14)
  }

  doc.setFontSize(11)
  doc.setTextColor(...COOKBOOK.brown)
  doc.setFont("times", "bold")
  doc.text(sanitizeText(options.businessName) || "GastroMetrics", margin + (options.businessLogo ? 18 : 0), margin + 5)

  doc.setFontSize(8)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(...COLORS.secondary)
  doc.text(`${labels.fecha}: ${new Date().toLocaleDateString(labels.locale)}`, margin + (options.businessLogo ? 18 : 0), margin + 11)

  // Franja de identificación: distingue de un vistazo esta copia (sin costos) de la
  // administrativa — verde, en vez de la roja "financiera" de esa otra copia.
  doc.setFillColor(21, 128, 61)
  doc.roundedRect(pageWidth - margin - 42, margin, 42, 6, 1, 1, "F")
  doc.setFontSize(7)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(255, 255, 255)
  doc.text(labels.copiaCocina, pageWidth - margin - 21, margin + 4, { align: "center" })

  // Misma idea que la copia administrativa: una línea que explica el tipo de copia,
  // no solo el color del badge.
  doc.setFontSize(7)
  doc.setFont("helvetica", "italic")
  doc.setTextColor(...COLORS.secondary)
  doc.text(labels.copiaCocinaSubtitle, margin + (options.businessLogo ? 18 : 0), margin + 16)

  yPosition = 42

  // ===== RECIPE NAME (Centered, tipografia serif para sensacion de receta impresa) =====
  doc.setFontSize(22)
  doc.setFont("times", "bold")
  doc.setTextColor(...COOKBOOK.brown)
  const recipeName = sanitizeText(recipe.name)
  doc.text(recipeName, pageWidth / 2, yPosition, { align: "center" })
  yPosition += 7

  doc.setDrawColor(...COOKBOOK.amber)
  doc.setLineWidth(0.4)
  doc.line(pageWidth / 2 - 18, yPosition - 3, pageWidth / 2 + 18, yPosition - 3)

  doc.setFontSize(10)
  doc.setFont("times", "italic")
  doc.setTextColor(...COLORS.secondary)
  doc.text(sanitizeText(recipe.classification), pageWidth / 2, yPosition, { align: "center" })
  yPosition += 8

  // ===== YIELD/SERVINGS (badge, no tabla) =====
  const yieldServingsText = `${labels.rendimiento} ${recipe.yieldAmount} ${yieldUnitLabel(recipe)}   •   ${labels.porciones} ${recipe.servings}`
  doc.setFontSize(10)
  doc.setFont("helvetica", "normal")
  const badgeWidth = doc.getTextWidth(yieldServingsText) + 10
  doc.setFillColor(...COOKBOOK.amberLight)
  doc.roundedRect((pageWidth - badgeWidth) / 2, yPosition - 4.5, badgeWidth, 7, 2, 2, "F")
  doc.setTextColor(...COOKBOOK.brown)
  doc.text(yieldServingsText, pageWidth / 2, yPosition, { align: "center" })
  yPosition += 10

  // ===== IMAGE (Limited size) =====
  if (recipe.image && options.includeImage) {
    try {
      const maxImgWidth = 100
      const maxImgHeight = 60 // Limit height to ~60mm
      const imgX = (pageWidth - maxImgWidth) / 2
      doc.addImage(recipe.image, "JPEG", imgX, yPosition, maxImgWidth, maxImgHeight)
      yPosition += maxImgHeight + 8
    } catch (e) {
      // Skip image
    }
  }

  // ===== INGREDIENTS TABLE (Simple, no costs) =====
  doc.setFontSize(13)
  doc.setFont("times", "bold")
  doc.setTextColor(...COOKBOOK.brown)
  doc.text(labels.ingredientes, pageWidth / 2, yPosition, { align: "center" })
  yPosition += 5

  const ingredientRows = recipe.ingredients.map((ing) => [
    sanitizeText(ing.name),
    ing.quantity.toFixed(2),
    sanitizeText(ing.unit),
  ])

  autoTable(doc, {
    startY: yPosition,
    head: [[labels.ingrediente, labels.cantidad, labels.unidad]],
    body: ingredientRows,
    theme: "plain",
    headStyles: {
      fillColor: COOKBOOK.amberLight,
      textColor: COOKBOOK.brown,
      fontSize: 10,
      fontStyle: "bold",
      halign: "left",
    },
    bodyStyles: {
      fontSize: 10,
      textColor: COLORS.text,
    },
    alternateRowStyles: { fillColor: COOKBOOK.cream },
    margin: { left: margin, right: margin },
  })

  yPosition = (doc as any).lastAutoTable.finalY + 10

  // ===== PROCEDIMIENTO Y OBSERVACIONES (lista numerada con medallones) =====
  // recipe.procedure ya es el campo único (ver generateAdministrativePDF arriba para
  // la nota completa sobre la fusión con observations). No son solo notas de costo
  // (esas van solo en la copia administrativa) — también llevan notas de preparación
  // útiles para cocina, como sustituciones o tiempos de reposo.
  {
    const allProcedureLines = [...(recipe.procedure || []), ...(recipe.observations || [])].filter((s) =>
      sanitizeText(s),
    )

    if (allProcedureLines.length > 0) {
      if (yPosition > ctx.pageHeight - 40) {
        doc.addPage()
        yPosition = margin
      }

      doc.setFontSize(13)
      doc.setFont("times", "bold")
      doc.setTextColor(...COOKBOOK.brown)
      doc.text(`${labels.procedimiento} ${labels.y} ${labels.observaciones}`, pageWidth / 2, yPosition, {
        align: "center",
      })
      yPosition += 9

      allProcedureLines.forEach((step, index) => {
        const stepText = sanitizeText(step)
        const lines = doc.splitTextToSize(stepText, contentWidth - 14)
        const stepHeight = Math.max(lines.length * 5, 7) + 3
        if (yPosition + stepHeight > ctx.pageHeight - 20) {
          doc.addPage()
          yPosition = margin
        }

        // Medallón numerado en vez de un simple "1." — refuerzo del look de tarjeta de
        // receta impresa en vez de documento de oficina.
        doc.setFillColor(...COOKBOOK.amber)
        doc.circle(margin + 3, yPosition - 1.3, 3.2, "F")
        doc.setFontSize(8)
        doc.setFont("helvetica", "bold")
        doc.setTextColor(...COLORS.white)
        doc.text(String(index + 1), margin + 3, yPosition, { align: "center" })

        doc.setFontSize(10.5)
        doc.setFont("helvetica", "normal")
        doc.setTextColor(...COLORS.text)
        doc.text(lines, margin + 10, yPosition)
        yPosition += stepHeight
      })
    }
  }
}

// ============== NORMAL PDF (PORTRAIT - PRESENTABLE) ==============

function generateNormalPDF(
  doc: jsPDF,
  recipe: Recipe,
  options: PDFExportOptions,
  ctx: {
    pageWidth: number
    pageHeight: number
    margin: number
    contentWidth: number
    yPosition: number
    checkNewPage: (space: number) => boolean
    drawLine: (y: number, color?: [number, number, number]) => void
  }
) {
  const labels = getPdfLabels()
  const { pageWidth, margin, contentWidth } = ctx
  let yPosition = ctx.yPosition

  // ===== HEADER =====
  doc.setFillColor(...COLORS.primary)
  doc.rect(0, 0, pageWidth, 30, "F")

  if (options.businessLogo) {
    drawBusinessLogo(doc, options.businessLogo, margin, 6, 18, 18)
  }

  doc.setFontSize(14)
  doc.setTextColor(...COLORS.white)
  doc.setFont("helvetica", "bold")
  doc.text(sanitizeText(options.businessName) || "GastroMetrics", margin + (options.businessLogo ? 22 : 0), 14)

  doc.setFontSize(8)
  doc.setFont("helvetica", "normal")
  doc.text(
    `${labels.creado}: ${new Date(recipe.metadata?.createdAt || Date.now()).toLocaleDateString(labels.locale)}`,
    margin + (options.businessLogo ? 22 : 0),
    20
  )
  doc.text(`${labels.exportado}: ${new Date().toLocaleDateString(labels.locale)}`, margin + (options.businessLogo ? 22 : 0), 25)

  // Badge blanco (en vez del color sólido de las otras dos copias, que ya iría sobre un
  // fondo del mismo color primario acá) — mismo criterio de "identificarse de un
  // vistazo" que las copias administrativa/cocina, más una línea explicativa.
  doc.setFontSize(8)
  doc.setFont("helvetica", "bold")
  const clientBadgeWidth = doc.getTextWidth(labels.pdfGeneral) + 8
  doc.setFillColor(...COLORS.white)
  doc.roundedRect(pageWidth - margin - clientBadgeWidth, 5, clientBadgeWidth, 6, 1, 1, "F")
  doc.setTextColor(...COLORS.primary)
  doc.text(labels.pdfGeneral, pageWidth - margin - clientBadgeWidth / 2, 9, { align: "center" })

  doc.setFontSize(7)
  doc.setFont("helvetica", "italic")
  doc.setTextColor(...COLORS.white)
  doc.text(labels.copiaClienteSubtitle, pageWidth - margin, 15, { align: "right" })

  yPosition = 38

  // ===== RECIPE NAME =====
  doc.setFontSize(18)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(...COLORS.primary)
  doc.text(sanitizeText(recipe.name), margin, yPosition)
  yPosition += 7

  doc.setFontSize(11)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(...COLORS.secondary)
  doc.text(`${sanitizeText(recipe.classification)}${recipe.step ? ` | ${sanitizeText(recipe.step)}` : ""}`, margin, yPosition)
  yPosition += 7

  // ===== YIELD/SERVINGS (Plain text) =====
  doc.setFontSize(10)
  doc.setTextColor(...COLORS.text)
  doc.text(`Rendimiento: ${recipe.yieldAmount} ${yieldUnitLabel(recipe)} | Porciones: ${recipe.servings}`, margin, yPosition)
  yPosition += 10

  // ===== IMAGE (Controlled size) =====
  if (recipe.image && options.includeImage) {
    try {
      doc.addImage(recipe.image, "JPEG", margin, yPosition, 80, 55)
      yPosition += 60
    } catch (e) {
      // Skip image
    }
  }

  // ===== INGREDIENTS TABLE =====
  doc.setFontSize(14)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(...COLORS.darkGray)
  doc.text(labels.ingredientes, margin, yPosition)
  yPosition += 5

  const ingredientRows = recipe.ingredients.map((ing) => [
    sanitizeText(ing.name),
    ing.quantity.toFixed(2),
    sanitizeText(ing.unit),
    sanitizeText(ing.notes) || "",
  ])

  autoTable(doc, {
    startY: yPosition,
    head: [[labels.ingrediente, labels.cantidad, labels.unidad, labels.notas]],
    body: ingredientRows,
    theme: "striped",
    headStyles: {
      fillColor: COLORS.darkGray,
      textColor: COLORS.white,
      fontSize: 9,
      fontStyle: "bold",
      halign: "center",
    },
    bodyStyles: {
      fontSize: 8,
      textColor: COLORS.text,
    },
    margin: { left: margin, right: margin },
  })

  yPosition = (doc as any).lastAutoTable.finalY + 10

  // ===== PROCEDIMIENTO Y OBSERVACIONES (una sola lista numerada) =====
  {
    const allProcedureLines = [...(recipe.procedure || []), ...(recipe.observations || [])].filter((s) =>
      sanitizeText(s),
    )

    if (allProcedureLines.length > 0) {
      if (yPosition > ctx.pageHeight - 40) {
        doc.addPage()
        yPosition = margin
      }

      doc.setFontSize(14)
      doc.setFont("helvetica", "bold")
      doc.setTextColor(...COLORS.darkGray)
      doc.text(`${labels.procedimiento} ${labels.y} ${labels.observaciones}`, margin, yPosition)
      yPosition += 8

      allProcedureLines.forEach((step, index) => {
        const stepText = sanitizeText(step)
        if (yPosition > ctx.pageHeight - 25) {
          doc.addPage()
          yPosition = margin
        }

        doc.setFontSize(9)
        doc.setFont("helvetica", "bold")
        doc.setTextColor(...COLORS.secondary)
        doc.text(`${index + 1}.`, margin, yPosition)

        doc.setFont("helvetica", "normal")
        doc.setTextColor(...COLORS.text)
        const lines = doc.splitTextToSize(stepText, contentWidth - 10)
        doc.text(lines, margin + 15, yPosition)
        yPosition += lines.length * 4.5 + 3
      })
    }
  }

  // Sin precio de venta ni costos: este PDF se redefinio como "Ficha Rapida", pensada
  // para compartir hacia afuera (un proveedor, un socio) sin exponer informacion
  // financiera del negocio — antes mostraba el precio de venta (ver docs/98/99, ya
  // se habia quitado para sub-recetas; ahora se quita para cualquier receta, no solo
  // esas, porque ese es el nuevo proposito del tipo, no una excepcion puntual).

  // ===== NOTES =====
  if (recipe.notes && options.includeNotes) {
    yPosition += 10
    if (yPosition > ctx.pageHeight - 25) {
      doc.addPage()
      yPosition = margin
    }

    doc.setFontSize(11)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(...COLORS.darkGray)
    doc.text(labels.notasAdicionales, margin, yPosition)
    yPosition += 5

    doc.setFont("helvetica", "normal")
    doc.setFontSize(9)
    doc.setTextColor(...COLORS.text)
    const notesLines = doc.splitTextToSize(sanitizeText(recipe.notes), contentWidth)
    doc.text(notesLines, margin, yPosition)
  }
}

// ============== FILENAME & DOWNLOAD ==============

export function generatePDFFilename(recipe: Recipe, type: PDFExportType): string {
  const typePrefix = type === "administrative" ? "ADM" : type === "employee" ? "EMP" : "GEN"
  const recipeName = sanitizeText(recipe.name).replace(/[^a-zA-Z0-9]/g, "_")
  const version = recipe.metadata?.version || 1
  const date = new Date()
  const dateStr = date.toISOString().split("T")[0].replace(/-/g, "")
  const timeStr = date.toTimeString().slice(0, 5).replace(":", "")

  return `${typePrefix}_${recipeName}_v${version}_${dateStr}_${timeStr}.pdf`
}

export function downloadRecipePDF(recipe: Recipe, options: PDFExportOptions): void {
  try {
    const doc = generateRecipePDF(recipe, options)
    const filename = generatePDFFilename(recipe, options.type)
    doc.save(filename)
  } catch (error) {
    console.error("Error generating PDF:", error)
    throw new Error("No se pudo generar el PDF")
  }
}
