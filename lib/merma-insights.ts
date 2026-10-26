/**
 * Información de merma (docs/202) — pedido del dueño: no un registro diario, sino información
 * a partir de la merma que cada quien ya configuró en Ingredientes, sea la global (por
 * categoría) o la personalizada. Puro, cubierto por lib/merma-insights.test.ts.
 *
 * Para cada ingrediente con merma activa:
 * - % de merma real (contenido comprado vs. aprovechable, el mismo que usa el costeo).
 * - Cuánto se pierde de cada compra (precio de compra × %).
 * - Precio por unidad aprovechable vs. por unidad comprada (lo que la merma encarece).
 * - Costo de merma estimado al mes, con lo que se compró en los últimos 90 días (órdenes y
 *   compras de Inventario, ver lib/supplier-insights.ts) ÷ 3.
 * Además sugiere ingredientes sin merma activa cuya categoría suele tener merma alta.
 */

import type { Ingredient } from "@/types/ingredient"
import { getCategoryMermaPercentage, usableContentAfterMerma } from "@/lib/merma-categories"
import type { PriceObservation } from "@/lib/supplier-insights"

export interface MermaRow {
  ingredientId: string
  name: string
  category: string
  unit: string
  mode: "global" | "custom"
  percent: number
  purchasePrice: number
  originalContent: number
  usableContent: number
  /** Precio por unidad comprada y por unidad aprovechable. */
  pricePerBoughtUnit: number
  pricePerUsableUnit: number
  lostPerPurchase: number
  monthlyQuantity: number
  monthlyCost: number
}

export interface MermaSummary {
  rows: MermaRow[]
  withMerma: number
  averagePercent: number
  monthlyCost: number
  /** Sin merma activa, en categorías que suelen tenerla (≥ 10 %). */
  suggestions: { ingredientId: string; name: string; category: string; typicalPercent: number }[]
}

const DAY = 86_400_000

export function mermaInsights(ingredients: Ingredient[], observations: PriceObservation[], now = Date.now()): MermaSummary {
  const qty90 = new Map<string, number>()
  for (const o of observations) {
    if ((o.source !== "order" && o.source !== "purchase") || !o.ingredientId) continue
    if (new Date(o.date).getTime() < now - 90 * DAY) continue
    qty90.set(o.ingredientId, (qty90.get(o.ingredientId) || 0) + (o.quantity || 0))
  }

  const rows: MermaRow[] = []
  const suggestions: MermaSummary["suggestions"] = []
  for (const ing of ingredients) {
    if (ing.recipeId) continue // sub-recetas: su merma viene de sus ingredientes
    const usableNow = ing.pricing?.netContent || 0
    const original = ing.originalNetContent && ing.originalNetContent > 0 ? ing.originalNetContent : usableNow
    if (!ing.merma?.enabled) {
      const typical = getCategoryMermaPercentage(ing.category || "")
      if (typical >= 10) suggestions.push({ ingredientId: ing.id, name: ing.name, category: ing.category, typicalPercent: typical })
      continue
    }
    if (!(original > 0)) continue
    // El costeo ya guarda el contenido aprovechable en pricing.netContent; si no se aplicó
    // todavía, se calcula con la misma regla que la ventana de merma.
    const usable = ing.originalNetContent && usableNow > 0 && usableNow < original ? usableNow : usableContentAfterMerma(original, ing.merma, ing.category || "")
    const percent = Math.max(0, Math.min(100, (1 - usable / original) * 100))
    if (!(percent > 0)) continue
    const purchasePrice = ing.pricing?.purchasePrice || 0
    const pricePerBoughtUnit = purchasePrice / original
    const pricePerUsableUnit = usable > 0 ? purchasePrice / usable : 0
    const monthlyQuantity = (qty90.get(ing.id) || 0) / 3
    rows.push({
      ingredientId: ing.id,
      name: ing.name,
      category: ing.category,
      unit: ing.unit,
      mode: ing.merma.useGlobal || !((ing.merma.customPercentage || 0) > 0 || (ing.merma.customValue || 0) > 0) ? "global" : "custom",
      percent,
      purchasePrice,
      originalContent: original,
      usableContent: usable,
      pricePerBoughtUnit,
      pricePerUsableUnit,
      lostPerPurchase: purchasePrice * (percent / 100),
      monthlyQuantity,
      monthlyCost: monthlyQuantity * pricePerBoughtUnit * (percent / 100),
    })
  }
  rows.sort((a, b) => b.monthlyCost - a.monthlyCost || b.lostPerPurchase - a.lostPerPurchase)
  suggestions.sort((a, b) => b.typicalPercent - a.typicalPercent || a.name.localeCompare(b.name))
  return {
    rows,
    withMerma: rows.length,
    averagePercent: rows.length ? rows.reduce((s, r) => s + r.percent, 0) / rows.length : 0,
    monthlyCost: rows.reduce((s, r) => s + r.monthlyCost, 0),
    suggestions,
  }
}
