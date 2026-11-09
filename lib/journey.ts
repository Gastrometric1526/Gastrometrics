/**
 * Tutorial guiado progresivo (pedido del dueño, docs/221): un solo recorrido por toda la app
 * que se va desbloqueando con lo que la persona hace. Ejemplo: agrega su primer ingrediente
 * (paso a paso dentro del diálogo) → con 3 ingredientes se activa «¿por qué no aplicas la
 * merma?» → la Ficha Técnica → el PAX y el sistema de costeo antes de guardar → Mis Recetas…
 * y después cada módulo a medida que se desbloquea.
 *
 * - Aplica a todas las cuentas, incluso las que ya habían visto los tutoriales anteriores.
 *   Las cuentas que ya existían pueden saltárselo entero; las nuevas solo pueden pausarlo.
 * - «Reiniciar tutorial» del menú lateral lo vuelve a empezar.
 * - Mientras está activo, los tutoriales de cada página y las pistas no se abren solos: el
 *   recorrido los usa (o los reemplaza) en su momento.
 * Lo visual vive en components/journey/guided-journey.tsx; los pasos, en
 * components/journey/chapters.tsx. Esta parte es pura y está probada en journey.test.ts.
 */

import type { FeatureKey } from "@/lib/plans"

export const JOURNEY_KEY = "gm_journey_v1"
export const JOURNEY_PAUSED_KEY = "gm_journey_paused"
export const JOURNEY_EVENT = "gm:journey"
export const JOURNEY_SIGNAL_EVENT = "gm:journey:signal"

export type JourneyState = {
  started: boolean
  /** La cuenta ya tenía datos o tutoriales vistos al empezar: puede saltárselo entero. */
  existing: boolean
  skipped: boolean
  done: string[]
  /**
   * «Reiniciar tutorial» desde un módulo (pedido del dueño): repasa solo las etapas de ese
   * módulo, en este orden, y después el recorrido sigue donde iba. Desde el Dashboard se
   * reinicia todo (`restartJourney`).
   */
  replay?: string[]
}

export const EMPTY_JOURNEY: JourneyState = { started: false, existing: false, skipped: false, done: [] }

/** Lo que el recorrido sabe de la cuenta en este momento. */
export type JourneyFacts = {
  ingredients: number // ingredientes propios (sin subrecetas)
  recipes: number // recetas propias (sin subrecetas)
  menus: number // menús del negocio principal
  mermaActive: boolean // algún ingrediente con merma activada (guardada)
  features: Partial<Record<FeatureKey, boolean>>
  /**
   * Invitado del equipo (docs/263): solo ve las etapas de lo que tiene permitido
   * (`memberFeature`) y nunca las del dueño (Equipo, Negocios y Mi Plan).
   */
  member?: boolean
}

export type ChapterKind =
  | "steps" // pasos propios del recorrido (interactivos)
  | "goal" // una meta con progreso (p. ej. 3 ingredientes); se cumple sola
  | "page-tour" // usa el tutorial ya existente de esa página

export type ChapterMeta = {
  id: string
  kind: ChapterKind
  /** Ruta donde ocurre; null = en cualquier pantalla. */
  route: string | null
  /** storageKey del tutorial de página (kind "page-tour"). */
  tourKey?: string
  /** Se salta si el plan no incluye ninguna de estas funciones. */
  features?: FeatureKey[]
  /** Condición para que se active. */
  unlocked?: (f: JourneyFacts) => boolean
  /** Meta (kind "goal"): progreso actual y objetivo. */
  goal?: (f: JourneyFacts) => { current: number; target: number }
  /** Los datos ya muestran que esto está hecho (p. ej. la merma ya activada): se da por vista. */
  alreadyDone?: (f: JourneyFacts) => boolean
  /** Para un invitado: el permiso que necesita esta etapa, o "owner" si es solo del dueño. */
  memberFeature?: FeatureKey | "owner"
}

// Cada etapa se activa solo cuando los datos que necesita existen de verdad (pedido del dueño):
// no se pasa a la siguiente por haber tocado un botón si lo guardado no está.
const atLeast = (key: "ingredients" | "recipes" | "menus", n: number) => (f: JourneyFacts) => f[key] >= n
const all = (...conds: ((f: JourneyFacts) => boolean)[]) => (f: JourneyFacts) => conds.every((c) => c(f))

export const CHAPTERS: ChapterMeta[] = [
  { id: "welcome", kind: "steps", route: null },
  // docs/273: si ya hay ingredientes (p. ej. importados) o recetas, no se vuelve a pedir el primero.
  { id: "ingredients-add", kind: "steps", memberFeature: "ingredients", route: "/ingredientes", alreadyDone: (f) => f.ingredients >= 1 },
  { id: "ingredients-three", kind: "goal", memberFeature: "ingredients", route: "/ingredientes", goal: (f) => ({ current: f.ingredients, target: 3 }) },
  { id: "merma", kind: "steps", memberFeature: "merma", route: "/ingredientes", features: ["merma"], unlocked: atLeast("ingredients", 3), alreadyDone: (f) => f.mermaActive },
  { id: "ficha-basic", kind: "steps", memberFeature: "recipes", route: "/ficha-tecnica", unlocked: atLeast("ingredients", 3), alreadyDone: (f) => f.recipes >= 1 },
  { id: "ficha-advanced", kind: "steps", memberFeature: "recipes", route: "/ficha-tecnica", unlocked: atLeast("ingredients", 3) },
  { id: "recipes", kind: "steps", memberFeature: "recipes", route: "/mis-recetas", unlocked: atLeast("recipes", 1) },
  { id: "estadisticas", kind: "page-tour", memberFeature: "stats_panorama", route: "/estadisticas", tourKey: "tour_completed_estadisticas", features: ["stats_panorama"], unlocked: atLeast("recipes", 1) },
  { id: "ventas", kind: "page-tour", memberFeature: "manual_sales", route: "/ventas", tourKey: "tour_completed_ventas", features: ["manual_sales", "stats_finance", "invoices"], unlocked: atLeast("recipes", 1) },
  { id: "recipes-three", kind: "goal", memberFeature: "recipes", route: "/ficha-tecnica", goal: (f) => ({ current: f.recipes, target: 3 }) },
  { id: "inventario", kind: "page-tour", memberFeature: "inventory", route: "/inventario", tourKey: "tour_completed_inventario", features: ["inventory"], unlocked: all(atLeast("recipes", 3), atLeast("ingredients", 3)) },
  { id: "menus", kind: "page-tour", memberFeature: "menus", route: "/menus", tourKey: "tour_completed_menus", features: ["menus"], unlocked: atLeast("recipes", 3) },
  // El MEP sale de un menú: primero hay que tener uno.
  { id: "menus-one", kind: "goal", memberFeature: "menus", route: "/menus", features: ["menus"], goal: (f) => ({ current: f.menus, target: 1 }) },
  { id: "mep", kind: "page-tour", memberFeature: "menus", route: "/mep", tourKey: "tour_completed_mep", features: ["menus"], unlocked: all(atLeast("recipes", 3), atLeast("menus", 1)) },
  { id: "ordenes", kind: "page-tour", memberFeature: "purchase_orders_manual", route: "/menu-y-compras", tourKey: "tour_completed_ordenes-compra", features: ["purchase_orders_manual", "purchase_orders_auto"], unlocked: all(atLeast("recipes", 3), atLeast("ingredients", 3)) },
  { id: "salon", kind: "page-tour", memberFeature: "pos", route: "/salon", tourKey: "tour_completed_salon", features: ["pos"], unlocked: atLeast("recipes", 3) },
  { id: "equipo", kind: "page-tour", memberFeature: "owner", route: "/equipo", tourKey: "tour_completed_equipo", features: ["team"], unlocked: atLeast("recipes", 3) },
  { id: "negocios", kind: "page-tour", memberFeature: "owner", route: "/negocios", tourKey: "tour_completed_negocios" },
  { id: "mi-plan", kind: "page-tour", memberFeature: "owner", route: "/mi-plan", tourKey: "tour_completed_mi-plan" },
  { id: "finish", kind: "steps", route: null },
]

/** ¿El plan permite esta etapa? Si no se sabe todavía (undefined), se espera. */
export function chapterApplies(chapter: ChapterMeta, facts: JourneyFacts): boolean | null {
  if (facts.member && chapter.memberFeature) {
    if (chapter.memberFeature === "owner") return false
    const allowed = facts.features[chapter.memberFeature]
    if (allowed === undefined) return null
    if (!allowed) return false
  }
  if (!chapter.features || chapter.features.length === 0) return true
  const values = chapter.features.map((f) => facts.features[f])
  if (values.some((v) => v === true)) return true
  if (values.some((v) => v === undefined)) return null
  return false
}

export function goalReached(chapter: ChapterMeta, facts: JourneyFacts): boolean {
  if (!chapter.goal) return false
  const { current, target } = chapter.goal(facts)
  return current >= target
}

export type JourneyPosition =
  | { status: "off" } // saltado o no empezado
  | { status: "finished" }
  | { status: "waiting" } // falta saber el plan
  | { status: "active"; chapter: ChapterMeta; unlocked: boolean; index: number; total: number; fromReplay?: boolean }

/**
 * Próxima etapa: la primera no hecha que el plan permite. Las metas ya cumplidas se dan por
 * hechas (las devuelve en `autoDone`). Las etapas que el plan no incluye solo se saltan, sin
 * marcarse: si la persona sube de plan, el recorrido vuelve a activarse con lo que faltaba,
 * aunque ya lo hubiera terminado (pedido del dueño, docs/221).
 */
export function journeyPosition(state: JourneyState, facts: JourneyFacts): JourneyPosition & { autoDone: string[] } {
  const autoDone: string[] = []
  const total = CHAPTERS.length
  // Repaso de un módulo: va primero, aunque el recorrido estuviera terminado o saltado. Se
  // saltan las etapas que el plan no incluye o que todavía no tienen los datos que necesitan.
  for (const id of state.replay ?? []) {
    const index = CHAPTERS.findIndex((c) => c.id === id)
    if (index < 0) continue
    const chapter = CHAPTERS[index]
    const applies = chapterApplies(chapter, facts)
    if (applies === null) return { status: "waiting", autoDone }
    if (!applies || chapter.kind === "goal") continue
    if (chapter.unlocked && !chapter.unlocked(facts)) continue
    return { status: "active", chapter, unlocked: true, index, total, autoDone, fromReplay: true }
  }
  if (!state.started || state.skipped) return { status: "off", autoDone }
  for (let index = 0; index < CHAPTERS.length; index++) {
    const chapter = CHAPTERS[index]
    if (state.done.includes(chapter.id)) continue
    const applies = chapterApplies(chapter, facts)
    if (applies === null) return { status: "waiting", autoDone }
    if (applies === false) continue
    if ((chapter.kind === "goal" && goalReached(chapter, facts)) || chapter.alreadyDone?.(facts)) {
      autoDone.push(chapter.id)
      continue
    }
    const unlocked = chapter.kind === "goal" ? false : chapter.unlocked ? chapter.unlocked(facts) : true
    return { status: "active", chapter, unlocked, index, total, autoDone }
  }
  return { status: "finished", autoDone }
}

/** ¿La ruta actual es la de la etapa? Órdenes vive en /business/{id}/ordenes-compra. */
export function onChapterRoute(chapter: ChapterMeta, pathname: string): boolean {
  if (chapter.route === null) return true
  if (pathname === chapter.route || pathname.startsWith(chapter.route + "/")) return true
  if (chapter.route === "/menu-y-compras") return /^\/business\/[^/]+\/ordenes-compra/.test(pathname)
  return false
}

export function markDone(state: JourneyState, ids: string[]): JourneyState {
  const done = Array.from(new Set([...state.done, ...ids]))
  const replay = state.replay?.filter((id) => !ids.includes(id))
  if (done.length === state.done.length && (replay?.length ?? 0) === (state.replay?.length ?? 0)) return state
  return { ...state, done, ...(state.replay ? { replay } : {}) }
}

/** Etapas que se repasan al reiniciar el tutorial desde una pantalla (sin las metas). */
export function chaptersForRoute(pathname: string): string[] {
  return CHAPTERS.filter((c) => c.route !== null && c.kind !== "goal" && onChapterRoute(c, pathname)).map((c) => c.id)
}

/** «Reiniciar tutorial» desde un módulo: solo sus etapas; el resto del recorrido no cambia. */
export function replayModule(state: JourneyState, ids: string[]): JourneyState {
  return { ...state, replay: ids }
}

export function endReplay(state: JourneyState): JourneyState {
  return { ...state, replay: [] }
}

export function startJourney(existing: boolean): JourneyState {
  return { started: true, existing, skipped: false, done: [] }
}

/** «Reiniciar tutorial»: desde el principio, con la opción de saltar si ya la tenía. */
export function restartJourney(state: JourneyState): JourneyState {
  return { started: true, existing: state.existing, skipped: false, done: [] }
}

export function skipJourney(state: JourneyState): JourneyState {
  return { ...state, started: true, skipped: true, replay: [] }
}

/** Mientras el recorrido está activo, los tutoriales de página y las pistas no se abren solos. */
export function journeyControlsTours(state: JourneyState | null): boolean {
  if (!state) return true // todavía no se inició: el recorrido decide primero
  if (state.replay && state.replay.length > 0) return true
  return state.started && !state.skipped && !state.done.includes("finish")
}

export function parseJourney(raw: string | null): JourneyState | null {
  if (!raw) return null
  try {
    const v = JSON.parse(raw)
    if (!v || typeof v !== "object") return null
    return {
      started: v.started === true,
      existing: v.existing === true,
      skipped: v.skipped === true,
      done: Array.isArray(v.done) ? v.done.filter((d: unknown) => typeof d === "string") : [],
      ...(Array.isArray(v.replay) ? { replay: v.replay.filter((d: unknown) => typeof d === "string") } : {}),
    }
  } catch {
    return null
  }
}

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage
  } catch {
    return null
  }
}

export function readJourney(): JourneyState | null {
  return parseJourney(storage()?.getItem(JOURNEY_KEY) ?? null)
}

export function writeJourney(state: JourneyState): void {
  storage()?.setItem(JOURNEY_KEY, JSON.stringify(state))
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(JOURNEY_EVENT))
}

/** Señales de las pantallas al recorrido (p. ej. la Ficha avisa cuántas líneas tienen costo). */
export function signalJourney(name: string, data?: Record<string, unknown>): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent(JOURNEY_SIGNAL_EVENT, { detail: { name, data } }))
}

/** Rutas de la app donde corre el recorrido (no en la web pública, el login ni /admin). */
export const JOURNEY_ROUTES = [
  "/dashboard",
  "/ingredientes",
  "/ficha-tecnica",
  "/mis-recetas",
  "/estadisticas",
  "/ventas",
  "/salon",
  "/inventario",
  "/menus",
  "/mep",
  "/menu-y-compras",
  "/business",
  "/equipo",
  "/negocios",
  "/mi-plan",
]

export function isJourneyRoute(pathname: string): boolean {
  return JOURNEY_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"))
}
