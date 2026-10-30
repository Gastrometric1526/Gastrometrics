import { jsPDF } from "jspdf"
import { safeFilePart } from "@/lib/pdf/pdf-filename"
import autoTable from "jspdf-autotable"
import { getPdfLabels, getCurrentPdfLanguage } from "@/lib/i18n/pdf-labels"
import { getBusinessThemeRgb, getBusinessThemeTintRgb } from "@/lib/theme-colors"
import { getRecipeStepLabel } from "@/lib/recipe-step-labels"
import { drawBusinessLogo } from "./pdf-logo"
import { formatDate, formatDateTime, fileDate } from "@/lib/date-format"
import { flattenDish, formatMepAmount, groupByArea, groupDishesByStep, type MepEntry } from "@/lib/mep"
import { amountWithUnit, shortUnit } from "@/lib/share-text"

// PDF de la MEP (docs/202), pedido del dueño: la primera página es toda la mise en place
// (qué producir y cuánto, con una casilla para marcar), y las siguientes, una receta por
// página con las cantidades ya escaladas, el procedimiento y las observaciones. Documento de
// cocina: sin costos. Mismo estilo que el PDF de orden de compra (lib/pdf/purchase-order-pdf-
// generator.ts) y helpers locales a propósito (docs/31, sección 2).

const sanitizeText = (input: string | undefined | null): string =>
  (input ?? "")
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, "")
    .replace(/[\u{2600}-\u{26FF}]/gu, "")
    .replace(/[\u{2700}-\u{27BF}]/gu, "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim()

const COLORS = {
  primary: [240, 83, 36] as [number, number, number],
  tint: [255, 244, 239] as [number, number, number],
  secondary: [100, 100, 100] as [number, number, number],
  text: [40, 40, 40] as [number, number, number],
  lightGray: [245, 245, 245] as [number, number, number],
  darkGray: [60, 60, 60] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  tableHeader: [51, 51, 51] as [number, number, number],
  tableBorder: [200, 200, 200] as [number, number, number],
}

export interface MepPDFOptions {
  menuName: string
  serviceDate?: string | null
  servings?: number | null
  preps: MepEntry[]
  dishes: MepEntry[]
  businessName?: string
  businessLogo?: string
  businessId?: string
  /** Claves «Listo» ya marcadas: salen con la casilla tachada. */
  doneKeys?: Set<string>
  /** «area»: una hoja por área de la cocina (clasificación de la Ficha Técnica). */
  groupBy?: "step" | "area"
  /** Nombre traducido de cada área. */
  areaLabel?: (classification: string) => string
}

export function generateMepPDF(options: MepPDFOptions): jsPDF {
  COLORS.primary = getBusinessThemeRgb(options.businessId)
  COLORS.tint = getBusinessThemeTintRgb(options.businessId)

  const labels = getPdfLabels()
  const lang = getCurrentPdfLanguage()
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 14
  const contentWidth = pageWidth - 2 * margin
  const done = options.doneKeys ?? new Set<string>()
  const amount = (e: MepEntry) => amountWithUnit(e.amount, e.yieldUnit, lang, formatMepAmount)
  const step = (name: string | null) => (name ? getRecipeStepLabel(name, lang) : "")

  const header = (rightTitle: string, rightSub: string) => {
    doc.setFillColor(...COLORS.lightGray)
    doc.rect(0, 0, pageWidth, 24, "F")
    doc.setDrawColor(...COLORS.tableBorder)
    doc.setLineWidth(0.3)
    doc.line(0, 24, pageWidth, 24)
    if (options.businessLogo) drawBusinessLogo(doc, options.businessLogo, margin, 4, 15, 15)
    const x = margin + (options.businessLogo ? 18 : 0)
    doc.setFontSize(11)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(...COLORS.text)
    doc.text(sanitizeText(options.businessName) || "GastroMetrics", x, 11)
    doc.setFontSize(8)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(...COLORS.secondary)
    doc.text(`${labels.exportado}: ${formatDateTime(new Date())}`, x, 18)
    doc.setFontSize(15)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(...COLORS.primary)
    doc.text(rightTitle, pageWidth - margin, 11, { align: "right" })
    doc.setFontSize(9)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(...COLORS.darkGray)
    doc.text(sanitizeText(rightSub).slice(0, 60), pageWidth - margin, 18, { align: "right" })
  }

  // Casilla para marcar a mano (o ya marcada si estaba «Listo» en la app).
  const checkboxCell = {
    didDrawCell: (data: { section: string; column: { index: number }; cell: { x: number; y: number; height: number; raw: unknown } }) => {
      if (data.section !== "body" || data.column.index !== 0) return
      const size = 3.6
      const bx = data.cell.x + 2.4
      const by = data.cell.y + (data.cell.height - size) / 2
      doc.setDrawColor(...COLORS.darkGray)
      doc.setLineWidth(0.3)
      doc.rect(bx, by, size, size)
      if (data.cell.raw === "x") {
        doc.setDrawColor(...COLORS.primary)
        doc.setLineWidth(0.6)
        doc.line(bx + 0.7, by + 1.9, bx + 1.5, by + 2.8)
        doc.line(bx + 1.5, by + 2.8, bx + 3, by + 0.8)
      }
    },
  }

  const tableBase = {
    theme: "grid" as const,
    margin: { left: margin, right: margin },
    headStyles: { fillColor: COLORS.tableHeader, textColor: COLORS.white, fontSize: 8, fontStyle: "bold" as const, cellPadding: 2 },
    bodyStyles: { fontSize: 9, textColor: COLORS.text, cellPadding: 2.4, minCellHeight: 8, valign: "middle" as const },
    alternateRowStyles: { fillColor: [250, 250, 250] as [number, number, number] },
  }
  // @ts-expect-error -- lastAutoTable lo inyecta jspdf-autotable
  const lastY = () => (doc.lastAutoTable?.finalY as number) || margin

  // ===== MISE EN PLACE: por paso del menú (una lista) o por área de la cocina (una hoja por área) =====
  let y = 32
  // Encabezado con el menú, la fecha y las personas; devuelve dónde sigue la página.
  const drawInfo = (subtitle: string) => {
    header(labels.mepTitulo, subtitle)
    let y = 32
    doc.setFillColor(...COLORS.tint)
    doc.roundedRect(margin, y, contentWidth, 18, 2, 2, "F")
    const info: [string, string][] = [
      [labels.mepMenu, options.menuName],
      [labels.mepFechaServicio, options.serviceDate ? formatDate(options.serviceDate) : "-"],
      [labels.mepPersonas, options.servings ? String(options.servings) : "-"],
    ]
    info.forEach(([label, value], i) => {
      const x = margin + 4 + i * (contentWidth / 3)
      doc.setFontSize(7.5)
      doc.setFont("helvetica", "normal")
      doc.setTextColor(...COLORS.secondary)
      doc.text(label.toUpperCase(), x, y + 6.5)
      doc.setFontSize(10)
      doc.setFont("helvetica", "bold")
      doc.setTextColor(...COLORS.text)
      doc.text(sanitizeText(value).slice(0, 34) || "-", x, y + 13)
    })
    y += 26
    return y
  }

  const sectionTitle = (title: string, note?: string) => {
    if (y > pageHeight - 40) {
      doc.addPage()
      y = margin
    }
    doc.setFontSize(11)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(...COLORS.darkGray)
    doc.text(title, margin, y)
    if (note) {
      doc.setFontSize(8)
      doc.setFont("helvetica", "normal")
      doc.setTextColor(...COLORS.secondary)
      doc.text(note, pageWidth - margin, y, { align: "right" })
    }
    y += 3
  }

  const drawRecipe = (entry: MepEntry, index: number, count: number, areaTitle?: string) => {
    doc.addPage()
    header(areaTitle ? areaTitle.toUpperCase().slice(0, 40) : labels.mepRecetas, `${labels.mepReceta} ${index + 1} ${labels.de} ${count}`)
    let ry = 33
    doc.setFontSize(8)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(...COLORS.primary)
    doc.text((entry.kind === "prep" ? labels.mepPreparacionBase : step(entry.stepName) || labels.platoColumna).toUpperCase(), margin, ry)
    ry += 7
    doc.setFontSize(17)
    doc.setTextColor(...COLORS.text)
    const titleLines = doc.splitTextToSize(sanitizeText(entry.name), contentWidth) as string[]
    doc.text(titleLines, margin, ry)
    ry += titleLines.length * 7 + 1

    doc.setFillColor(...COLORS.tint)
    doc.roundedRect(margin, ry, contentWidth, 12, 2, 2, "F")
    doc.setFontSize(10)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(...COLORS.text)
    doc.text(`${labels.mepAProducir}: ${amount(entry)}`, margin + 4, ry + 7.6)
    if (Math.abs(entry.multiplier - 1) > 0.0005) {
      doc.setFont("helvetica", "normal")
      doc.setTextColor(...COLORS.secondary)
      doc.text(`×${formatMepAmount(entry.multiplier)} ${labels.mepDeLaReceta}`, pageWidth - margin - 4, ry + 7.6, { align: "right" })
    }
    ry += 18
    if (entry.kind === "prep" && entry.usedBy.length) {
      doc.setFontSize(8)
      doc.setFont("helvetica", "normal")
      doc.setTextColor(...COLORS.secondary)
      const used = doc.splitTextToSize(`${labels.mepSeUsaEn}: ${sanitizeText(entry.usedBy.join(", "))}`, contentWidth) as string[]
      doc.text(used, margin, ry)
      ry += used.length * 4 + 3
    }

    autoTable(doc, {
      ...tableBase,
      startY: ry,
      head: [[labels.ingrediente, labels.cantidad, labels.notas]],
      body: entry.lines.map((l) => [sanitizeText(l.name), `${formatMepAmount(l.quantity)} ${shortUnit(l.unit, lang)}`.trim(), sanitizeText(l.notes)]),
      columnStyles: { 0: { cellWidth: "auto" }, 1: { cellWidth: 34, halign: "right", fontStyle: "bold" }, 2: { cellWidth: 52, fontSize: 8, textColor: COLORS.secondary } },
    })
    ry = lastY() + 9

    const block = (title: string, items: string[], numbered: boolean) => {
      if (!items.length) return
      if (ry > pageHeight - 30) {
        doc.addPage()
        ry = margin
      }
      doc.setFontSize(10)
      doc.setFont("helvetica", "bold")
      doc.setTextColor(...COLORS.darkGray)
      doc.text(title, margin, ry)
      ry += 6
      doc.setFontSize(9)
      doc.setFont("helvetica", "normal")
      doc.setTextColor(...COLORS.text)
      items.forEach((item, i) => {
        const prefix = numbered ? `${i + 1}.` : "•"
        const lines = doc.splitTextToSize(sanitizeText(item), contentWidth - 8) as string[]
        if (ry + lines.length * 4.6 > pageHeight - 16) {
          doc.addPage()
          ry = margin
        }
        doc.setFont("helvetica", "bold")
        doc.text(prefix, margin, ry)
        doc.setFont("helvetica", "normal")
        doc.text(lines, margin + 7, ry)
        ry += lines.length * 4.6 + 2
      })
      ry += 4
    }
    block(labels.procedimiento, entry.procedure, true)
    block(labels.observaciones, entry.observations, false)
  }

  if (options.groupBy === "area") {
    // Pedido del dueño: imprimir la MEP de cada sección y dársela a su equipo. Cada área empieza
    // en una hoja nueva con su lista y sigue con sus recetas.
    const groups = groupByArea([...options.preps, ...options.dishes])
    groups.forEach((group, gi) => {
      const areaTitle = group.area ? (options.areaLabel ? options.areaLabel(group.area) : group.area) : labels.sinCategoria
      if (gi > 0) doc.addPage()
      y = drawInfo(areaTitle)
      sectionTitle(areaTitle.toUpperCase())
      autoTable(doc, {
        ...tableBase,
        startY: y,
        head: [["", labels.mepReceta, labels.mepAProducir]],
        body: group.entries.map((e) => [
          done.has(e.key) ? "x" : "",
          `${sanitizeText(e.name)}${e.kind === "prep" ? `
${labels.mepPreparacionBase}${e.usedBy.length ? ` · ${labels.mepSeUsaEn}: ${sanitizeText(e.usedBy.join(", "))}` : ""}` : e.stepName ? `
${step(e.stepName)}` : ""}`,
          amount(e),
        ]),
        columnStyles: { 0: { cellWidth: 9, textColor: [255, 255, 255] }, 1: { cellWidth: "auto", fontStyle: "bold" }, 2: { cellWidth: 40, halign: "right" } },
        ...checkboxCell,
      })
      group.entries.forEach((entry, i) => drawRecipe(entry, i, group.entries.length, areaTitle))
    })
  } else {
    y = drawInfo(options.menuName)
    // Por paso (docs/207): cada plato con sus sub-recetas debajo, sangradas, como checklist.
    if (options.dishes.length) {
      sectionTitle(labels.mepPlatos)
      const body: unknown[][] = []
      for (const group of groupDishesByStep(options.dishes)) {
        if (group.stepName)
          body.push([{ content: step(group.stepName).toUpperCase(), colSpan: 3, styles: { fillColor: COLORS.tint, textColor: COLORS.primary, fontStyle: "bold", fontSize: 8, minCellHeight: 6 } }])
        for (const d of group.dishes) {
          for (const { entry, level } of flattenDish(d)) {
            const shared = entry.kind === "sub" && entry.usedBy.length ? `\n${labels.mepTambienEn}: ${sanitizeText(entry.usedBy.join(", "))}` : ""
            body.push([
              done.has(entry.key) ? "x" : "",
              {
                content: `${sanitizeText(entry.name)}${shared}`,
                styles: level ? { fontStyle: "normal", fontSize: 8.5, cellPadding: { top: 1.6, bottom: 1.6, right: 2, left: 2 + level * 6 } } : { fontStyle: "bold" },
              },
              amount(entry),
            ])
          }
        }
      }
      autoTable(doc, {
        ...tableBase,
        startY: y,
        head: [["", labels.platoColumna, labels.mepAProducir]],
        body: body as never,
        columnStyles: { 0: { cellWidth: 9, textColor: [255, 255, 255] }, 1: { cellWidth: "auto" }, 2: { cellWidth: 40, halign: "right" } },
        didDrawCell: (data) => {
          // Las filas de paso (colSpan) no llevan casilla.
          if ((data.row.raw as unknown[]).length === 1) return
          checkboxCell.didDrawCell(data as never)
        },
      })
      y = lastY() + 9
    }

    // Total por sub-receta, para prepararlas una sola vez para todos los platos.
    if (options.preps.length) {
      sectionTitle(labels.mepPreparaciones, labels.mepPreparacionesNota)
      autoTable(doc, {
        ...tableBase,
        startY: y,
        head: [["", labels.mepPreparacionBase, labels.mepAProducir, labels.mepSeUsaEn]],
        body: options.preps.map((p) => [done.has(p.key) ? "x" : "", sanitizeText(p.name), amount(p), sanitizeText(p.usedBy.join(", "))]),
        columnStyles: { 0: { cellWidth: 9, textColor: [255, 255, 255] }, 1: { cellWidth: "auto", fontStyle: "bold" }, 2: { cellWidth: 32, halign: "right" }, 3: { cellWidth: 60, fontSize: 8, textColor: COLORS.secondary } },
        ...checkboxCell,
      })
      y = lastY() + 9
    }

    // Recetas: cada plato seguido de sus sub-recetas con la cantidad de ese plato.
    const all = options.dishes.flatMap((d) => flattenDish(d).map((x) => x.entry))
    all.forEach((entry, index) => drawRecipe(entry, index, all.length))
  }


  const total = doc.getNumberOfPages()
  for (let i = 1; i <= total; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(...COLORS.secondary)
    doc.text(`GastroMetrics | ${labels.pagina} ${i} ${labels.de} ${total}`, pageWidth / 2, pageHeight - 8, { align: "center" })
  }
  return doc
}

export function mepPdfFilename(menuName: string): string {
  const name = safeFilePart(sanitizeText(menuName), "menu")
  return `MEP_${name}_${fileDate(new Date())}.pdf`
}
