/**
 * Cuenta regresiva del vencimiento de un plan asignado (docs/165). Pura, cubierta por
 * pruebas: la usan el indicador del menú lateral y la ventana de vencimiento.
 */

/** Stripe exige que la prueba de una suscripción termine al menos 48 h después. Margen de 1 h. */
export const MIN_SCHEDULE_MS = 49 * 60 * 60 * 1000
/** La ventana sale sola desde 3 días antes. */
export const REMINDER_DAYS = 3

export type ExpiryUrgency = "calm" | "soon" | "urgent" | "today" | "expired"

export interface ExpiryInfo {
  msLeft: number
  /** Días de calendario hasta el vencimiento (0 = vence hoy). */
  daysLeft: number
  urgency: ExpiryUrgency
  /** Si ya no da tiempo de programar el pago (menos de 49 h), se paga de inmediato. */
  canSchedule: boolean
  /** Etapa del recordatorio automático, para mostrarlo una vez por etapa. */
  reminderStage: "3d" | "today" | null
}

function startOfDay(ms: number): number {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function expiryInfo(expiresAtIso: string, now = Date.now()): ExpiryInfo {
  const expiresAt = new Date(expiresAtIso).getTime()
  const msLeft = expiresAt - now
  const daysLeft = Math.round((startOfDay(expiresAt) - startOfDay(now)) / 86_400_000)
  const urgency: ExpiryUrgency =
    msLeft <= 0 ? "expired" : daysLeft <= 0 ? "today" : daysLeft <= REMINDER_DAYS ? "urgent" : daysLeft <= 7 ? "soon" : "calm"
  const reminderStage = urgency === "today" ? "today" : urgency === "urgent" ? "3d" : null
  return { msLeft, daysLeft: Math.max(daysLeft, 0), urgency, canSchedule: msLeft > MIN_SCHEDULE_MS, reminderStage }
}
