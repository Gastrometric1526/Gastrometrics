/**
 * Cuándo pedirle una opinión a la persona (docs/173). Puro, cubierto por pruebas.
 *
 * Plan del dueño: pedir la calificación en momentos de valor real (no solo por tiempo) y
 * hacer preguntas cortas en momentos clave, sin ser intrusivos:
 * - como mucho UNA pregunta (calificación o pregunta corta) cada 5 días;
 * - siempre con «Ahora no»;
 * - lo respondido no se vuelve a preguntar; lo cerrado sin responder se ofrece una sola
 *   vez más, después de 14 días (la calificación, después de 30).
 */

export type ValueMoment =
  | "first_priced_recipe" // primera receta con costo y precio sugerido
  | "first_pdf" // primer PDF exportado
  | "cascade_recalc" // un cambio de precio recalculó varias recetas
  | "first_ingredient"
  | "first_business"
  | "first_ocr"

export type QuestionKey = "pain" | "menu_size" | "price_source" | "blocker" | "ocr_accuracy" | "team" | "testimonial" | "improve"

export type QuestionKind = "choice" | "scale" | "text"

export interface QuestionDef {
  key: QuestionKey
  kind: QuestionKind
  /** Opciones (claves de texto) para «choice»; la última puede ser «otro» con texto libre. */
  options?: string[]
  /** Si la respuesta de texto puede mostrarse como testimonio (pide permiso). */
  askConsent?: boolean
}

/** En orden de prioridad: si dos aplican, sale la primera. */
export const QUESTIONS: QuestionDef[] = [
  { key: "improve", kind: "text" },
  { key: "blocker", kind: "choice", options: ["start", "loading", "prices", "time", "other"] },
  { key: "ocr_accuracy", kind: "scale" },
  { key: "price_source", kind: "choice", options: ["receipts", "supplier_list", "market", "other"] },
  { key: "menu_size", kind: "choice", options: ["lt10", "10_30", "31_60", "gt60"] },
  { key: "pain", kind: "choice", options: ["costs", "prices", "inventory", "waste", "suppliers", "other"] },
  { key: "team", kind: "choice", options: ["solo", "small", "team"] },
  { key: "testimonial", kind: "text", askConsent: true },
]

export const ASK_COOLDOWN_MS = 5 * 24 * 60 * 60 * 1000
export const QUESTION_RETRY_MS = 14 * 24 * 60 * 60 * 1000
export const RATING_RETRY_MS = 30 * 24 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

export interface AskRecord {
  status: "answered" | "dismissed"
  at: number
  shows: number
}

export interface AskState {
  lastAskAt?: number
  moments: Partial<Record<ValueMoment, number>>
  rating?: AskRecord
  questions: Partial<Record<QuestionKey, AskRecord>>
}

export interface AskContext {
  now: number
  accountCreatedAt?: string | null
  activeDays: number
  recipeCount: number | null
  /** El plan asignado vence en 3 días o menos. */
  planExpiringSoon: boolean
  onboardingDone: boolean
}

export function emptyAskState(): AskState {
  return { moments: {}, questions: {} }
}

function canShowAgain(rec: AskRecord | undefined, retryMs: number, now: number): boolean {
  if (!rec) return true
  if (rec.status === "answered") return false
  return rec.shows < 2 && now - rec.at >= retryMs
}

export function inCooldown(state: AskState, now: number): boolean {
  return state.lastAskAt !== undefined && now - state.lastAskAt < ASK_COOLDOWN_MS
}

/** ¿Toca pedir la calificación (0–10)? Momento de valor, o 7 días de uso, o 3 recetas. */
export function ratingDue(state: AskState, ctx: AskContext): boolean {
  if (inCooldown(state, ctx.now) || !canShowAgain(state.rating, RATING_RETRY_MS, ctx.now)) return false
  const m = state.moments
  return Boolean(m.first_priced_recipe || m.first_pdf || m.cascade_recalc) || ctx.activeDays >= 7 || (ctx.recipeCount ?? 0) >= 3
}

function accountAgeDays(ctx: AskContext): number | null {
  if (!ctx.accountCreatedAt) return null
  return (ctx.now - new Date(ctx.accountCreatedAt).getTime()) / DAY_MS
}

function questionApplies(key: QuestionKey, state: AskState, ctx: AskContext): boolean {
  const age = accountAgeDays(ctx)
  const recipes = ctx.recipeCount
  switch (key) {
    case "improve":
      return ctx.planExpiringSoon
    case "blocker":
      return age !== null && age >= 3 && recipes === 0
    case "ocr_accuracy":
      return Boolean(state.moments.first_ocr)
    case "price_source":
      return Boolean(state.moments.first_ingredient)
    case "menu_size":
      return Boolean(state.moments.first_business)
    case "pain":
      return ctx.onboardingDone && age !== null && age <= 7
    case "team":
      return (recipes ?? 0) >= 5
    case "testimonial":
      return ctx.activeDays >= 14 || (age !== null && age >= 14 && ctx.activeDays >= 5)
  }
}

/** La pregunta corta que toca ahora (o null). */
export function nextQuestion(state: AskState, ctx: AskContext): QuestionDef | null {
  if (inCooldown(state, ctx.now)) return null
  for (const q of QUESTIONS) {
    if (!canShowAgain(state.questions[q.key], QUESTION_RETRY_MS, ctx.now)) continue
    if (questionApplies(q.key, state, ctx)) return q
  }
  return null
}

/** Registra que se mostró y cómo terminó. */
export function recordAsk(state: AskState, target: "rating" | QuestionKey, status: "answered" | "dismissed", now: number): AskState {
  const prev = target === "rating" ? state.rating : state.questions[target]
  const rec: AskRecord = { status, at: now, shows: (prev?.shows ?? 0) + 1 }
  return target === "rating"
    ? { ...state, lastAskAt: now, rating: rec }
    : { ...state, lastAskAt: now, questions: { ...state.questions, [target]: rec } }
}

export function recordMoment(state: AskState, moment: ValueMoment, now: number): AskState {
  if (state.moments[moment]) return state
  return { ...state, moments: { ...state.moments, [moment]: now } }
}

/** Tono del seguimiento según la nota (0–10, escala NPS). */
export function ratingBand(score: number): "low" | "mid" | "high" {
  return score <= 6 ? "low" : score <= 8 ? "mid" : "high"
}
