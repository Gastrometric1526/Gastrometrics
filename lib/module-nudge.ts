/**
 * Invitación a volver a un módulo (pedido del dueño, docs/269): «si un usuario tiene mucho
 * tiempo sin usar un módulo (solo aplica a los que usan la app semanalmente) debería haber
 * un pop up invitándolos a probar los otros módulos, siempre siguiendo la lógica y línea de
 * uso del sistema».
 *
 * Reglas (puras, probadas en module-nudge.test.ts):
 * - Solo a quien usa la app cada semana: entró en cada una de las últimas 2 semanas y en al
 *   menos 3 días distintos de las últimas 3 (`isWeeklyUser`).
 * - Módulo candidato: está en su menú (plan, permisos y revelación progresiva ya aplicados),
 *   y nunca lo usó. Si alguna vez lo usó, solo cuando pasaron meses (`NUDGE_IDLE_DAYS`, 90
 *   días) sin tocarlo (pedido del dueño, docs/297: «si en algún momento utilizó el módulo, no
 *   lo dice; si tal vez han pasado meses, ahí sí les recuerda»). «Usar» es cualquier acción
 *   del registro en ese módulo (entrar, crear, editar…) en todo su historial, no solo los
 *   últimos 60 días: `lastUse` lo trae la ventana con una consulta por módulo.
 * - Se elige siguiendo la línea de uso del sistema (`NUDGE_ORDER`): primero lo que alimenta
 *   a lo demás (ingredientes → fichas → inventario → menús → compras → ventas → salón →
 *   reportes → equipo).
 * - Como mucho una invitación cada 7 días, y el mismo módulo no se repite en 30.
 */

/** Ruta del menú → módulo del registro de actividad (lib/services/activity-log.ts). */
export const NUDGE_ORDER: { href: string; module: string; slug: string }[] = [
  { href: "/ingredientes", module: "ingredientes", slug: "ingredientes" },
  { href: "/ficha-tecnica", module: "ficha_tecnica", slug: "ficha" },
  { href: "/mis-recetas", module: "recetas", slug: "recetas" },
  { href: "/inventario", module: "inventario", slug: "inventario" },
  { href: "/menus", module: "menus", slug: "menus" },
  { href: "/mep", module: "mep", slug: "mep" },
  { href: "/menu-y-compras", module: "ordenes_compra", slug: "ordenes" },
  { href: "/ventas", module: "ventas", slug: "ventas" },
  { href: "/salon", module: "salon", slug: "salon" },
  { href: "/estadisticas", module: "estadisticas", slug: "reportes" },
  { href: "/equipo", module: "equipo", slug: "equipo" },
]

/** Días sin usar un módulo que ya usó antes para volver a invitarlo (docs/297; antes 21). */
export const NUDGE_IDLE_DAYS = 90
export const NUDGE_EVERY_DAYS = 7
export const NUDGE_REPEAT_DAYS = 30
export const NUDGE_STATE_KEY = "gm_module_nudge"

const DAY = 86_400_000

export interface NudgeState {
  lastShownAt: string | null
  /** href → última vez que se invitó a ese módulo. */
  shown: Record<string, string>
}

export const EMPTY_NUDGE_STATE: NudgeState = { lastShownAt: null, shown: {} }

export function parseNudgeState(raw: string | null): NudgeState {
  if (!raw) return EMPTY_NUDGE_STATE
  try {
    const v = JSON.parse(raw)
    return {
      lastShownAt: typeof v?.lastShownAt === "string" ? v.lastShownAt : null,
      shown: v?.shown && typeof v.shown === "object" ? (v.shown as Record<string, string>) : {},
    }
  } catch {
    return EMPTY_NUDGE_STATE
  }
}

/** Día local «AAAA-MM-DD» de una fecha ISO. */
function localDay(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

/** ¿Usa la app cada semana? Entró en cada una de las 2 últimas semanas y en 3+ días de las últimas 3. */
export function isWeeklyUser(visitDates: string[], now = new Date()): boolean {
  const t = now.getTime()
  const times = visitDates.map((d) => Date.parse(d)).filter((x) => Number.isFinite(x) && x <= t)
  const inRange = (from: number, to: number) => times.some((x) => x > t - to * DAY && x <= t - from * DAY)
  if (!inRange(0, 7) || !inRange(7, 14)) return false
  const days = new Set(visitDates.filter((d) => Date.parse(d) > t - 21 * DAY && Date.parse(d) <= t).map(localDay))
  return days.size >= 3
}

/** Última visita a cada módulo (por nombre de módulo). */
export function lastVisitByModule(visits: { module: string; at: string }[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const v of visits) if (!out[v.module] || v.at > out[v.module]) out[v.module] = v.at
  return out
}

export interface NudgePick {
  href: string
  slug: string
  /** null = nunca lo abrió. */
  idleDays: number | null
}

/** El módulo al que conviene invitar hoy, o null. */
export function pickNudge(params: {
  visits: { module: string; at: string }[]
  /** Rutas del menú que la persona puede usar (sin candado y ya reveladas). */
  available: string[]
  state: NudgeState
  /** Último uso de cada módulo en todo el historial (cualquier acción), por nombre de módulo. */
  lastUse?: Record<string, string>
  now?: Date
}): NudgePick | null {
  const now = params.now ?? new Date()
  const t = now.getTime()
  if (!isWeeklyUser(params.visits.map((v) => v.at), now)) return null
  if (params.state.lastShownAt && t - Date.parse(params.state.lastShownAt) < NUDGE_EVERY_DAYS * DAY) return null
  const last = lastVisitByModule(params.visits)
  for (const [module, at] of Object.entries(params.lastUse ?? {})) if (!last[module] || at > last[module]) last[module] = at
  const available = new Set(params.available)
  for (const m of NUDGE_ORDER) {
    if (!available.has(m.href)) continue
    const shownAt = params.state.shown[m.href]
    if (shownAt && t - Date.parse(shownAt) < NUDGE_REPEAT_DAYS * DAY) continue
    const lastAt = last[m.module]
    const idle = lastAt ? Math.floor((t - Date.parse(lastAt)) / DAY) : null
    if (idle === null || idle > NUDGE_IDLE_DAYS) return { href: m.href, slug: m.slug, idleDays: idle }
  }
  return null
}

/** Estado tras mostrar una invitación. */
export function markNudgeShown(state: NudgeState, href: string, now = new Date()): NudgeState {
  const at = now.toISOString()
  return { lastShownAt: at, shown: { ...state.shown, [href]: at } }
}

/**
 * Módulos del menú sin visita reciente, cuyo historial completo hay que mirar antes de
 * invitar (docs/297): uno que se usó hace 70 días no está en las visitas de 60 días, pero ya
 * se usó y no toca invitarlo todavía.
 */
export function modulesToLookUp(visits: { module: string; at: string }[], available: string[]): string[] {
  const recent = lastVisitByModule(visits)
  const avail = new Set(available)
  return NUDGE_ORDER.filter((m) => avail.has(m.href) && !recent[m.module]).map((m) => m.module)
}
