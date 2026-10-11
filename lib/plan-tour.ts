/**
 * Tutorial de plan nuevo (docs/157) — pedido del dueño: "cuando un usuario cambia de un
 * plan a otro debe recibir una notificación y comenzar un nuevo tutorial para mostrarle
 * lo que tiene acceso, siempre respetando el sistema que va desbloqueando cosas de la
 * app a medida que va llenando".
 *
 * Aquí está la parte pura (sin React): qué módulo de la app corresponde a cada cosa que
 * se gana con el plan nuevo, y si ese módulo ya está visible o todavía espera a que la
 * persona tenga más recetas (lib/module-reveal.ts, MODULE_STAGES). El componente
 * components/plan-tour.tsx arma los pasos del tour con esto.
 */

import { MODULE_STAGES } from "@/lib/module-reveal"
import type { GainedCapabilityKey } from "@/lib/plan-capabilities"

// En el orden del menú lateral (components/sidebar.tsx), para que el tour baje por él.
export const PLAN_TOUR_MODULES: { href: string; navKey: string; capabilities: GainedCapabilityKey[] }[] = [
  { href: "/mis-recetas", navKey: "nav_mis_recetas", capabilities: ["pdf_admin"] },
  { href: "/ingredientes", navKey: "nav_ingredientes", capabilities: ["merma", "price_import"] },
  { href: "/inventario", navKey: "nav_inventario", capabilities: ["inventory"] },
  { href: "/equipo", navKey: "nav_equipo", capabilities: ["team", "users"] },
  { href: "/menus", navKey: "nav_menus", capabilities: ["menus"] },
  { href: "/menu-y-compras", navKey: "nav_ordenes_compra", capabilities: ["purchase_orders_manual", "purchase_orders_auto"] },
  { href: "/ventas", navKey: "nav_ventas", capabilities: ["invoices", "manual_sales"] },
  { href: "/estadisticas", navKey: "nav_estadisticas", capabilities: ["stats_panorama", "stats_finance"] },
  { href: "/negocios", navKey: "nav_negocios", capabilities: ["businesses"] },
]

export interface PlanTourModule {
  href: string
  navKey: string
  /** Textos (ya traducidos) de lo que se gana en este módulo. */
  labels: string[]
  /** Recetas que pide el módulo para aparecer (0 = siempre visible). */
  stage: number
  /** Todavía oculto por la revelación progresiva: el tour lo anuncia, no lo señala. */
  waiting: boolean
}

/** Agrupa lo ganado por módulo y marca cuáles siguen esperando más recetas. */
export function planTourModules(
  gained: { key: GainedCapabilityKey; label: string }[],
  recipeCount: number,
  showingAllModules: boolean,
): PlanTourModule[] {
  const result: PlanTourModule[] = []
  for (const mod of PLAN_TOUR_MODULES) {
    const labels = gained.filter((g) => mod.capabilities.includes(g.key)).map((g) => g.label)
    if (labels.length === 0) continue
    const stage = MODULE_STAGES[mod.href] ?? 0
    result.push({ href: mod.href, navKey: mod.navKey, labels, stage, waiting: !showingAllModules && recipeCount < stage })
  }
  return result
}

/** Llave única por cambio de plan, para que el tour salga una vez por cada cambio. */
export function planTourId(fromSlug: string, toSlug: string, changedAt: string | null): string {
  return `${fromSlug}>${toSlug}@${changedAt || "?"}`
}

export const PLAN_TOUR_PENDING_KEY = "gm_plan_tour_pending"
