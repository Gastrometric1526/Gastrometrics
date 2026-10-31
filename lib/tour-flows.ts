/**
 * Conexiones de cada tutorial (pedido del dueño, docs/208): «que quede explícito de dónde
 * saca los datos cada parte, por ejemplo que la Ficha Técnica los saca de la base de datos de
 * Ingredientes», y las mini funciones (el multiplicador, la merma, el precio…) con un ejemplo.
 *
 * Por tutorial (el storageKey sin «tour_completed_») y por paso: `from` = de qué módulos salen
 * los datos, `to` = qué módulos los usan, `tip` = un ejemplo con números. Todo son claves de
 * traducción; components/page-tour.tsx las traduce y las dibuja bajo la descripción.
 */

import type { TranslationKey } from "@/lib/i18n/translations"

export interface TourFlow {
  from?: TranslationKey[]
  to?: TranslationKey[]
  tip?: TranslationKey
}

export const TOUR_FLOWS: Record<string, Record<string, TourFlow>> = {
  "ficha-tecnica": {
    "ingredientes-btn": { from: ["nav_ingredientes"], tip: "tour_tip_ficha_source" },
    "name-classification": { to: ["nav_mep", "nav_estadisticas"], tip: "tour_tip_ficha_class" },
    "paso-rendimiento": { to: ["nav_menus", "nav_mep"], tip: "tour_tip_ficha_yield" },
    pax: { to: ["nav_ordenes_compra"], tip: "tour_tip_ficha_pax" },
    "ingredients-table": { from: ["nav_ingredientes", "nav_mis_recetas"], tip: "tour_tip_ficha_table" },
    pricing: { from: ["nav_negocios"], to: ["nav_mis_recetas", "nav_menus", "nav_estadisticas"], tip: "tour_tip_ficha_price" },
    summary: { to: ["nav_dashboard", "nav_estadisticas"] },
    save: { to: ["nav_mis_recetas", "nav_menus", "nav_inventario"], tip: "tour_tip_ficha_save" },
  },
  ingredientes: {
    new: { to: ["nav_ficha_tecnica", "nav_inventario", "nav_ordenes_compra"], tip: "tour_tip_ing_new" },
    packaging: { tip: "tour_tip_ing_price" },
    "unit-switch": { to: ["nav_ficha_tecnica", "nav_inventario"], tip: "tour_tip_ing_units" },
    table: { to: ["nav_ficha_tecnica"], tip: "tour_tip_ing_cascade" },
  },
  inventario: {
    add: { from: ["nav_ingredientes"], tip: "tour_tip_inv_add" },
    register: { from: ["nav_ventas", "nav_ficha_tecnica"], to: ["nav_ordenes_compra"], tip: "tour_tip_inv_theory" },
  },
  "mis-recetas": {
    new: { to: ["nav_ficha_tecnica"] },
    stats: { from: ["nav_ficha_tecnica"] },
    trash: { tip: "tour_tip_rec_trash" },
  },
  menus: {
    new: { from: ["nav_mis_recetas"], tip: "tour_tip_menu_people" },
    mep: { to: ["nav_mep"] },
    card: { from: ["nav_inventario"], to: ["nav_ordenes_compra"], tip: "tour_tip_menu_order" },
  },
  mep: {
    menu: { from: ["nav_menus"] },
    areas: { from: ["nav_ficha_tecnica"], tip: "tour_tip_mep_areas" },
    dishes: { from: ["nav_mis_recetas"], tip: "tour_tip_mep_dishes" },
  },
  estadisticas: {
    "overview-cards": { from: ["nav_ficha_tecnica", "nav_ingredientes", "nav_inventario"] },
    suppliers: { from: ["nav_ingredientes"], tip: "tour_tip_rep_suppliers" },
    "price-history": { from: ["nav_ingredientes"] },
    merma: { from: ["nav_ingredientes"], tip: "tour_tip_rep_merma" },
    "finanzas-import": { from: ["nav_ventas"], to: ["nav_inventario"], tip: "tour_tip_rep_sales" },
  },
  "ordenes-compra": {
    new: { from: ["nav_ingredientes"] },
    "auto-suggest": { from: ["nav_menus", "nav_ficha_tecnica", "nav_inventario"], to: ["nav_inventario"], tip: "tour_tip_ord_auto" },
  },
  negocios: {
    new: { to: ["nav_ficha_tecnica"], tip: "tour_tip_neg_costs" },
  },
  equipo: {
    invite: { tip: "tour_tip_team" },
  },
  "mi-plan": {
    grid: { tip: "tour_tip_plan_grid" },
  },
  "business-detail": {
    summary: { from: ["nav_ficha_tecnica", "nav_ingredientes"] },
  },
}

/** Agrega las conexiones a los pasos de un tutorial (sin pisar las que el paso ya traiga). */
export function withTourFlows<T extends { id: string; from?: string[]; to?: string[]; tip?: string }>(
  storageKey: string,
  steps: T[],
  t: (key: TranslationKey) => string,
): T[] {
  const flows = TOUR_FLOWS[storageKey.replace(/^tour_completed_/, "")]
  if (!flows) return steps
  return steps.map((s) => {
    const f = flows[s.id]
    if (!f) return s
    return {
      ...s,
      from: s.from ?? f.from?.map((k) => t(k)),
      to: s.to ?? f.to?.map((k) => t(k)),
      tip: s.tip ?? (f.tip ? t(f.tip) : undefined),
    }
  })
}
