/**
 * Programa "100 cocinas fundadoras", automático (docs/158) — pedido del dueño: las
 * primeras 100 cuentas (contando las que ya existían) reciben Chef Ejecutivo gratis por
 * un mes, sin escribir FUNDADOR por mensaje. Un minuto después de crear la cuenta, el
 * sistema le cambia el plan como lo haría el panel de /admin (mismo correo y mismo aviso
 * en el Dashboard), y avisa al dueño. Se puede cambiar o quitar después desde /admin.
 *
 * Aquí está la decisión pura (cubierta por pruebas); la parte con base de datos vive en
 * lib/services/founder-grant.ts.
 */

export const FOUNDER_PROGRAM = {
  /** La cuenta número 100 es la última que lo recibe. */
  maxAccounts: 100,
  /** Solo cuentas creadas desde que existe el programa automático; las anteriores cuentan para el total, pero no lo reciben. */
  startsAt: "2026-10-11T00:00:00-06:00",
  planSlug: "chef-ejecutivo",
  durationDays: 30,
  /** Espera desde la creación de la cuenta antes de cambiar el plan. */
  delayMs: 60_000,
} as const

export type FounderDecision =
  | { action: "grant"; expiresAt: string }
  | { action: "wait"; waitMs: number }
  | { action: "skip"; reason: "already_granted" | "before_program" | "over_limit" | "has_paid_plan" }

export function founderDecision(input: {
  accountCreatedAt: string
  /** Posición de la cuenta por fecha de creación (1 = la primera cuenta de la app). */
  ordinal: number
  now: number
  alreadyGranted: boolean
  currentPlanSlug: string | null
  hasStripeSubscription: boolean
}): FounderDecision {
  if (input.alreadyGranted) return { action: "skip", reason: "already_granted" }
  const created = new Date(input.accountCreatedAt).getTime()
  if (created < new Date(FOUNDER_PROGRAM.startsAt).getTime()) return { action: "skip", reason: "before_program" }
  if (input.ordinal > FOUNDER_PROGRAM.maxAccounts) return { action: "skip", reason: "over_limit" }
  // Quien ya paga (o eligió y pagó un plan al registrarse) no se toca.
  if (input.hasStripeSubscription || (input.currentPlanSlug && input.currentPlanSlug !== "foodie")) {
    return { action: "skip", reason: "has_paid_plan" }
  }
  const elapsed = input.now - created
  if (elapsed < FOUNDER_PROGRAM.delayMs) return { action: "wait", waitMs: FOUNDER_PROGRAM.delayMs - elapsed }
  return { action: "grant", expiresAt: new Date(input.now + FOUNDER_PROGRAM.durationDays * 86_400_000).toISOString() }
}
