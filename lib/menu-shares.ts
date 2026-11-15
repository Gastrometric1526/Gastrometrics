/**
 * Menús con elecciones (docs/314, pedido del dueño).
 *
 * Un paso del menú puede ser:
 * - «todos» (por defecto, lo de siempre): el cliente recibe todos sus platos;
 * - «elige uno»: el cliente escoge UNO de sus platos (sopa o ensalada).
 *
 * Antes un paso con varias opciones sumaba todas: un menú «sopa o ensalada + plato» costaba
 * sopa + ensalada + plato. Ahora cada plato de un paso «elige uno» pesa 1 ÷ N (N = platos
 * activos del paso): el precio, el costo y el consumo de inventario de una venta del menú
 * son el promedio de sus opciones, el valor esperado cuando no se sabe cuál eligió cada
 * cliente. Puro: lo usan Menús, Ventas, el POS, Facturas y el inventario teórico.
 */

import type { Menu } from "@/lib/types/menus"

export interface MenuItemShare {
  itemId: string
  recipeId: string
  stepId: string
  /** Porción de este plato en UNA venta del menú: 1, o 1 ÷ N en un paso «elige uno». */
  share: number
  priceOverride?: number | null
}

export function isChoiceStep(menu: Pick<Menu, "steps">, stepId: string): boolean {
  return menu.steps?.find((s) => s.id === stepId)?.choice === "one"
}

export function menuItemShares(menu: Pick<Menu, "items" | "steps">): MenuItemShare[] {
  const enabled = (menu.items ?? []).filter((i) => i.enabled)
  const countByStep = new Map<string, number>()
  for (const item of enabled) countByStep.set(item.stepId, (countByStep.get(item.stepId) ?? 0) + 1)
  return enabled.map((item) => {
    const n = countByStep.get(item.stepId) ?? 1
    return {
      itemId: item.id,
      recipeId: item.recipeId,
      stepId: item.stepId,
      share: isChoiceStep(menu, item.stepId) && n > 0 ? 1 / n : 1,
      priceOverride: item.priceOverride,
    }
  })
}

/** Rango del costo de un menú: la elección más barata y la más cara de cada paso. */
export function menuCostRange(
  menu: Pick<Menu, "items" | "steps">,
  unitCostOf: (recipeId: string) => number,
): { min: number; max: number } {
  const byStep = new Map<string, number[]>()
  for (const s of menuItemShares(menu)) {
    const list = byStep.get(s.stepId) ?? []
    list.push(unitCostOf(s.recipeId))
    byStep.set(s.stepId, list)
  }
  let min = 0
  let max = 0
  for (const [stepId, costs] of byStep) {
    if (isChoiceStep(menu, stepId)) {
      min += Math.min(...costs)
      max += Math.max(...costs)
    } else {
      const sum = costs.reduce((a, b) => a + b, 0)
      min += sum
      max += sum
    }
  }
  return { min, max }
}
