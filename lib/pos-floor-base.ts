/**
 * Plano base y cambios del día (pedido del dueño, docs/303): «debe haber una base y luego
 * uno puede hacer modificaciones en día a día y luego regresar a como estaba originalmente y
 * también editarlo».
 *
 * - `plan.areas`/`plan.tables` es el plano de HOY: el que usa el servicio.
 * - `plan.base` es el plano base: cómo se arma el salón normalmente.
 * - Juntar mesas, moverlas o agregar una para un grupo cambia solo el de hoy.
 * - «Volver al plano base» copia la base a hoy. Las mesas con cuenta abierta que no
 *   están en la base se quedan (nunca se pierde un pedido) y se avisa cuáles.
 * - Con `resetDaily`, la primera vez que se abre el POS cada día vuelve solo a la base.
 *
 * Las mesas conservan su id entre la base y hoy: un pedido abierto sigue en su mesa aunque
 * se mueva. Puro, probado en pos-floor-base.test.ts.
 */

import type { FloorArea, FloorPlan, FloorTable } from "@/types/pos"

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T

/** Áreas y mesas comparables (orden estable, sin fechas). */
function layoutKey(areas: FloorArea[], tables: FloorTable[]): string {
  const a = [...areas].sort((x, y) => x.id.localeCompare(y.id)).map((x) => [x.id, x.name])
  const t = [...tables]
    .sort((x, y) => x.id.localeCompare(y.id))
    .map((x) => [x.id, x.areaId, x.label, x.shape, x.seats, x.x, x.y, x.w, x.h])
  return JSON.stringify([a, t])
}

/** El plano base; si todavía no hay (planos de antes de docs/303), el de hoy hace de base. */
export function baseOf(plan: FloorPlan): { areas: FloorArea[]; tables: FloorTable[] } {
  return plan.base ? { areas: plan.base.areas, tables: plan.base.tables } : { areas: plan.areas, tables: plan.tables }
}

/** ¿Hoy el salón está distinto de la base? */
export function differsFromBase(plan: FloorPlan): boolean {
  if (!plan.base) return false
  return layoutKey(plan.areas, plan.tables) !== layoutKey(plan.base.areas, plan.base.tables)
}

/** Guarda el plano de hoy como base. */
export function saveTodayAsBase(plan: FloorPlan, now = new Date()): FloorPlan {
  const at = now.toISOString()
  return { ...plan, base: { areas: clone(plan.areas), tables: clone(plan.tables), savedAt: at }, updatedAt: at }
}

/**
 * Cambia la base. Si hoy no tenía cambios del día, el cambio también se ve hoy (si no, el
 * dueño editaría la base y no vería nada en el salón); si hoy tiene cambios, solo la base.
 */
export function editBase(plan: FloorPlan, next: { areas: FloorArea[]; tables: FloorTable[] }, now = new Date()): FloorPlan {
  const at = now.toISOString()
  const sameToday = !differsFromBase(plan)
  const base = { areas: clone(next.areas), tables: clone(next.tables), savedAt: at }
  return sameToday ? { ...plan, areas: clone(next.areas), tables: clone(next.tables), base, updatedAt: at } : { ...plan, base, updatedAt: at }
}

/**
 * Vuelve al plano base. `busyTableIds`: mesas con cuenta abierta. Las que no están en la base
 * se quedan (en su área si existe en la base; si no, en la primera) y se devuelven en `kept`.
 */
export function restoreBase(plan: FloorPlan, busyTableIds: Iterable<string>, now = new Date()): { plan: FloorPlan; kept: FloorTable[] } {
  const base = baseOf(plan)
  const inBase = new Set(base.tables.map((t) => t.id))
  const areaIds = new Set(base.areas.map((a) => a.id))
  const busy = new Set(busyTableIds)
  const kept = plan.tables
    .filter((t) => busy.has(t.id) && !inBase.has(t.id))
    .map((t) => (areaIds.has(t.areaId) || !base.areas[0] ? t : { ...t, areaId: base.areas[0].id }))
  const at = now.toISOString()
  return {
    plan: { ...plan, areas: clone(base.areas), tables: [...clone(base.tables), ...kept], base: plan.base ?? { areas: clone(base.areas), tables: clone(base.tables), savedAt: at }, updatedAt: at },
    kept,
  }
}

/**
 * Vuelta automática a la base (`resetDaily`): la primera vez que se abre el POS en el día
 * `today` (fecha local). Devuelve el plano a guardar, o null si no hay nada que hacer.
 */
export function dailyReset(plan: FloorPlan, today: string, busyTableIds: Iterable<string>, now = new Date()): FloorPlan | null {
  if (!plan.resetDaily || plan.resetOn === today) return null
  const marked = { ...plan, resetOn: today }
  if (!differsFromBase(plan)) return { ...marked, updatedAt: now.toISOString() }
  return { ...restoreBase(marked, busyTableIds, now).plan, resetOn: today }
}
