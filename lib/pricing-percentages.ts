/**
 * Porcentajes del método GastroMetrics (los seis rubros sobre el costo de producción) y
 * sus valores predeterminados por negocio (docs/226).
 *
 * Antes, cada receta nueva empezaba con 10/10/30/25/0/30 fijos en el código: un negocio
 * con ISV del 15 % tenía que corregirlo receta por receta. Ahora la pantalla
 * «Configuración de porcentajes» puede guardar los valores como predeterminados del
 * negocio; las recetas guardadas no cambian (cada una conserva los suyos).
 */

import { getBusinessById, getEffectivePricingDefaults, setEffectivePricingDefaults } from "@/lib/storage/businesses"
import { fixedCostPerPlateOf } from "@/types/business"

export const PRICING_PERCENTAGE_KEYS = [
  "publicServices",
  "marketing",
  "operationalCosts",
  "laborCosts",
  "isv",
  "contributionMargin",
] as const

export type PricingPercentageKey = (typeof PRICING_PERCENTAGE_KEYS)[number]
export type PricingPercentages = Record<PricingPercentageKey, number>

// Valores de fábrica (los de siempre de la Ficha Técnica).
export const DEFAULT_PRICING_PERCENTAGES: PricingPercentages = {
  publicServices: 10,
  marketing: 10,
  operationalCosts: 30,
  laborCosts: 25,
  isv: 0,
  contributionMargin: 30,
}

const clampPercent = (value: unknown): number | undefined => {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN
  if (!Number.isFinite(n)) return undefined
  return Math.min(Math.max(Math.round(n * 100) / 100, 0), 100)
}

/** Completa con los valores de fábrica y limita cada rubro a 0–100. */
export function normalizePricingPercentages(partial?: Partial<Record<PricingPercentageKey, unknown>> | null): PricingPercentages {
  const out = { ...DEFAULT_PRICING_PERCENTAGES }
  if (!partial) return out
  for (const key of PRICING_PERCENTAGE_KEYS) {
    const v = clampPercent(partial[key])
    if (v !== undefined) out[key] = v
  }
  return out
}

/** Suma de los rubros que se cobran como gasto (sin impuesto ni ganancia). */
export function expensesPercent(p: PricingPercentages): number {
  return p.publicServices + p.marketing + p.operationalCosts + p.laborCosts
}

/** Suma de los seis rubros: cuánto se agrega sobre el costo de producción. */
export function totalMarkupPercent(p: PricingPercentages): number {
  return expensesPercent(p) + p.isv + p.contributionMargin
}

export function samePricingPercentages(a: PricingPercentages, b: PricingPercentages): boolean {
  return PRICING_PERCENTAGE_KEYS.every((key) => Math.abs(a[key] - b[key]) < 0.005)
}

/** Rubros que son gastos del negocio (sin ISV ni ganancia). */
export const EXPENSE_RUBROS = ["publicServices", "marketing", "operationalCosts", "laborCosts"] as const

/**
 * Predeterminados de un negocio (puro). Con gastos reales cargados (costo fijo por plato > 0),
 * los gastos ya entran en el precio como costo fijo: los cuatro rubros de gasto empiezan en 0
 * para no cobrarlos dos veces (decisión del dueño, docs/341). Lo guardado a mano manda.
 */
export function businessDefaultPercentages(saved: Partial<Record<PricingPercentageKey, unknown>> | null | undefined, fixedCostPerPlate: number): PricingPercentages {
  if (saved) return normalizePricingPercentages(saved)
  const out = { ...DEFAULT_PRICING_PERCENTAGES }
  if (fixedCostPerPlate > 0) for (const key of EXPENSE_RUBROS) out[key] = 0
  return out
}

/** Predeterminados del negocio: los guardados; si no, los de fábrica (con gastos reales, sin los rubros de gasto). */
export function getDefaultPricingPercentages(businessId: string): PricingPercentages {
  return businessDefaultPercentages(getEffectivePricingDefaults(businessId).pricingPercentages, fixedCostPerPlateOf(getBusinessById(businessId)))
}

export function hasSavedPricingPercentages(businessId: string): boolean {
  return Boolean(getEffectivePricingDefaults(businessId).pricingPercentages)
}

export async function saveDefaultPricingPercentages(businessId: string, p: PricingPercentages): Promise<void> {
  await setEffectivePricingDefaults(businessId, { pricingPercentages: normalizePricingPercentages(p) })
}
