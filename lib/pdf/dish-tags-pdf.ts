/**
 * Dibuja las etiquetas de un plato en un PDF (docs/324): ícono propio, texto o los dos, en una
 * fila que salta de línea sola. Los íconos llegan ya como PNG (`dietIconPngs`, lib/diet-icons.ts)
 * en el color del negocio; si alguno falta, esa etiqueta sale con texto.
 */

import type jsPDF from "jspdf"
import type { DishLabelMode, DishTag } from "@/lib/dish-tags"
import type { DietIconKey } from "@/lib/diet-icons"

export type IconPngs = Partial<Record<DietIconKey, string>>

export interface DrawTagsOptions {
  mode: DishLabelMode
  icons: IconPngs
  font: "helvetica" | "times" | string
  fontSize?: number
  /** Texto antes de los alérgenos cuando se muestran con texto («Alérgenos:»). */
  allergensLabel?: string
  pageHeight: number
  textRgb?: [number, number, number]
}

/** Dibuja las etiquetas desde (x, y) y devuelve la y siguiente. Sin etiquetas o «none», no dibuja. */
export function drawDishTags(doc: jsPDF, tags: DishTag[], x: number, y: number, width: number, o: DrawTagsOptions): number {
  if (o.mode === "none" || tags.length === 0) return y
  const size = o.fontSize ?? 8.5
  const icon = size * 0.45 // mm
  const lineH = Math.max(icon + 1.2, size * 0.5)
  const gap = 3.2
  doc.setFontSize(size)
  doc.setFont(o.font, "normal")
  doc.setTextColor(...(o.textRgb ?? [60, 60, 60]))
  let cx = x
  if (y + lineH > o.pageHeight - 18) {
    doc.addPage()
    y = 20
  }
  const newLine = () => {
    cx = x
    y += lineH
    if (y + lineH > o.pageHeight - 18) {
      doc.addPage()
      y = 20
    }
  }
  let labelDone = false
  for (const tag of tags) {
    const png = o.mode !== "text" ? o.icons[tag.key] : undefined
    // Las trazas siempre llevan texto: el ícono solo no dice de qué.
    const showText = o.mode !== "icons" || !png || tag.kind === "trace"
    if (tag.kind === "allergen" && showText && o.allergensLabel && !labelDone) {
      labelDone = true
      doc.setFont(o.font, "bold")
      const lw = doc.getTextWidth(o.allergensLabel) + 1.5
      if (cx + lw > x + width && cx > x) newLine()
      doc.text(o.allergensLabel, cx, y)
      cx += lw
      doc.setFont(o.font, "normal")
    }
    const tw = showText ? doc.getTextWidth(tag.text) : 0
    const w = (png ? icon + (showText ? 1 : 0) : 0) + tw
    if (cx + w > x + width && cx > x) newLine()
    if (png) doc.addImage(png, "PNG", cx, y - icon + 0.7, icon, icon)
    if (showText) doc.text(tag.text, cx + (png ? icon + 1 : 0), y)
    cx += w + gap
  }
  doc.setTextColor(0, 0, 0)
  return y + lineH + 2
}

/** Leyenda de los íconos usados (al final de la carta cuando se exporta solo con íconos). */
export function drawDishLegend(doc: jsPDF, tags: DishTag[], title: string, x: number, y: number, width: number, o: DrawTagsOptions): number {
  const unique = [...new Map(tags.filter((t) => o.icons[t.key] && t.kind !== "trace").map((t) => [t.key, t])).values()]
  if (o.mode !== "icons" || unique.length === 0) return y
  doc.setFontSize(o.fontSize ?? 8.5)
  doc.setFont(o.font, "bold")
  doc.setTextColor(...(o.textRgb ?? [60, 60, 60]))
  if (y + 12 > o.pageHeight - 18) {
    doc.addPage()
    y = 20
  }
  doc.text(title, x, y)
  return drawDishTags(doc, unique, x, y + 5, width, { ...o, mode: "both", allergensLabel: undefined })
}
