/**
 * Textos para compartir por WhatsApp o correo (docs/202): la lista MEP de un menú y una orden
 * de compra. Puros (los textos de la interfaz llegan ya traducidos en `labels`), cubiertos por
 * lib/share-text.test.ts. WhatsApp muestra *texto* en negrita.
 */

import type { LanguageCode } from "@/lib/i18n/translations"
import type { PurchaseOrder } from "@/types/purchase-order"
import { unitAbbreviations } from "@/types/ingredient"
import { getPresentationLabel, getUnitLabel, getYieldUnitLabel } from "@/lib/ingredient-labels"
import type { MepEntry } from "@/lib/mep"
import { flattenDish, formatMepAmount, groupDishesByStep } from "@/lib/mep"

const SINGULAR_PORTION: Record<string, string> = { porciones: "porción", portions: "portion", portioner: "portion", porções: "porção" }

/** Cantidad con su unidad corta, en singular cuando es 1 («1 porción», no «1 porciones»). */
export function amountWithUnit(value: number, unit: string, language: LanguageCode, format: (n: number) => string): string {
  const label = shortUnit(unit, language)
  const singular = Math.abs(value - 1) < 1e-9 ? SINGULAR_PORTION[label] : undefined
  return `${format(value)} ${singular ?? label}`.trim()
}

/** Unidad corta y traducida: «gramos» → «g», «porciones» → «portions»… */
export function shortUnit(unit: string, language: LanguageCode): string {
  if (!unit) return ""
  if (unitAbbreviations[unit]) return unitAbbreviations[unit] === "un" ? getUnitLabel(unit, language) : unitAbbreviations[unit]
  const yieldLabel = getYieldUnitLabel(unit, language)
  return yieldLabel !== unit ? yieldLabel : getUnitLabel(unit, language)
}

export interface MepShareLabels {
  title: string // «MEP»
  people: string // «personas»
  preps: string // «Preparaciones base»
  dishes: string // «Platos»
  usedIn: string // «para»
  sentWith: string // «Enviado con GastroMetrics»
}

export function mepShareText(input: {
  menuName: string
  dateLabel?: string | null
  servings?: number | null
  preps: MepEntry[]
  dishes: MepEntry[]
  language: LanguageCode
  labels: MepShareLabels
  stepLabel?: (name: string) => string
  /** Por área de la cocina (docs/202): si viene, la lista sale agrupada por área. */
  areas?: { label: string; entries: MepEntry[] }[]
  prepLabel?: string
}): string {
  const { labels, language } = input
  const amount = (e: MepEntry) => amountWithUnit(e.amount, e.yieldUnit, language, formatMepAmount)
  const head = [input.dateLabel, input.servings ? `${input.servings} ${labels.people}` : null].filter(Boolean).join(" · ")
  const out: string[] = [`*${labels.title} — ${input.menuName}*${head ? `\n${head}` : ""}`]
  if (input.areas) {
    for (const area of input.areas) {
      out.push("", `*${area.label}*`)
      for (const e of area.entries) out.push(`☐ ${e.name} — ${amount(e)}${e.kind === "prep" && input.prepLabel ? ` (${input.prepLabel})` : ""}`)
    }
    out.push("", `— ${labels.sentWith}`)
    return out.join("\n")
  }
  // Por paso (docs/207): cada plato y, debajo, sus sub-recetas con la cantidad de ese plato.
  if (input.dishes.length) {
    out.push("", `*${labels.dishes}*`)
    for (const group of groupDishesByStep(input.dishes)) {
      if (group.stepName) out.push(`_${input.stepLabel ? input.stepLabel(group.stepName) : group.stepName}_`)
      for (const d of group.dishes) for (const { entry, level } of flattenDish(d)) out.push(`${"    ".repeat(level)}☐ ${entry.name} — ${amount(entry)}`)
    }
  }
  if (input.preps.length) {
    out.push("", `*${labels.preps}*`)
    for (const p of input.preps) out.push(`☐ ${p.name} — ${amount(p)}${p.usedBy.length ? ` (${labels.usedIn} ${p.usedBy.join(", ")})` : ""}`)
  }
  out.push("", `— ${labels.sentWith}`)
  return out.join("\n")
}

export interface PurchaseOrderShareLabels {
  title: string // «Orden de compra»
  delivery: string // «Entrega»
  supplier: string // «Proveedor»
  total: string // «Total estimado»
  notes: string // «Notas»
  sentWith: string
}

export function purchaseOrderShareText(input: {
  order: PurchaseOrder
  language: LanguageCode
  labels: PurchaseOrderShareLabels
  money: (n: number) => string
  dateLabel?: (iso: string) => string
}): string {
  const { order, labels, language } = input
  const items = (order.items ?? []).filter((i) => (i.quantityToBuy ?? i.totalQuantity) > 0)
  const out: string[] = [`*${labels.title} #${order.number} — ${order.name}*`]
  if (order.expectedDeliveryDate) out.push(`${labels.delivery}: ${input.dateLabel ? input.dateLabel(order.expectedDeliveryDate) : order.expectedDeliveryDate}`)
  const suppliers = Array.from(new Set(items.map((i) => (i.supplier || "").trim()).filter(Boolean)))
  const supplier = (order.supplier || "").trim() || (suppliers.length === 1 ? suppliers[0] : "")
  if (supplier) out.push(`${labels.supplier}: ${supplier}`)
  out.push("")
  for (const item of items) {
    const qty = item.quantityToBuy ?? item.totalQuantity
    const base = `${formatMepAmount(qty)} ${shortUnit(item.unit, language)}`.trim()
    const pres =
      item.presentation && item.presentationQuantity && item.presentationQuantity > 0
        ? ` (${formatMepAmount(item.presentationQuantity)} ${getPresentationLabel(item.presentation, language)})`
        : ""
    const who = !supplier && item.supplier ? ` · ${item.supplier}` : ""
    out.push(`• ${item.name} — ${base}${pres}${who}`)
  }
  if (order.total > 0) out.push("", `${labels.total}: ${input.money(order.total)}`)
  if (order.notes?.trim()) out.push("", `${labels.notes}: ${order.notes.trim()}`)
  out.push("", `— ${labels.sentWith}`)
  return out.join("\n")
}

/** Enlace de WhatsApp con el texto (la persona elige el chat). */
export function whatsappUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`
}

/** Enlace de correo: la persona elige el destinatario en su app de correo. */
export function mailtoUrl(subject: string, body: string): string {
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}
