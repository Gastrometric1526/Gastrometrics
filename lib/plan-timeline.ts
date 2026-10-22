/**
 * Línea de tiempo del plan para /invita y /mi-plan (docs/180): cuándo vence el plan,
 * cuándo es el siguiente cobro y, si hay meses ganados por invitar, desde y hasta cuándo
 * corren. Pura (sin red) para poder probarla.
 */

const DAY = 86_400_000

export interface PlanTimelineInput {
  planSlug: string
  /** Vencimiento de un plan asignado (fundadoras, /admin, referidos). */
  expiresAt: string | null
  hasStripeSubscription: boolean
  /** Siguiente cobro de la suscripción de Stripe. */
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
  /** Pago programado para cuando vence el plan asignado (docs/165). */
  scheduled: { planSlug: string; startsAt: string } | null
  /** Días ganados por invitar, guardados detrás del plan actual. */
  bankDays: number
}

export type PlanTimeline =
  | { kind: "free" }
  /** Plan asignado sin fecha ni Stripe (testers, cortesía de /admin): sin vencimiento ni cobros. */
  | { kind: "no_end" }
  | { kind: "paid"; nextChargeAt: string | null }
  | { kind: "paid_ending"; endsAt: string | null }
  | {
      kind: "timed"
      endsAt: string
      /** Meses ganados: empiezan al vencer el plan y terminan en bankEndsAt. */
      bankEndsAt: string | null
      /** Primer cobro programado (null = no hay; la cuenta pasa a Foodie). */
      nextChargeAt: string | null
      nextChargePlanSlug: string | null
      /** A qué pasa la cuenta cuando se acaba todo lo gratis, si no hay pago programado. */
      thenFoodieAt: string
    }

export function planTimeline(input: PlanTimelineInput): PlanTimeline {
  if (input.hasStripeSubscription) {
    return input.cancelAtPeriodEnd
      ? { kind: "paid_ending", endsAt: input.currentPeriodEnd }
      : { kind: "paid", nextChargeAt: input.currentPeriodEnd }
  }
  if (input.planSlug === "foodie") return { kind: "free" }
  if (!input.expiresAt) return { kind: "no_end" }

  const end = Date.parse(input.expiresAt)
  // Con pago programado, los meses guardados se abonan en Stripe (no alargan el plan).
  const bankEndsAt =
    input.bankDays > 0 && !input.scheduled ? new Date(end + input.bankDays * DAY).toISOString() : null
  return {
    kind: "timed",
    endsAt: input.expiresAt,
    bankEndsAt,
    nextChargeAt: input.scheduled?.startsAt ?? null,
    nextChargePlanSlug: input.scheduled?.planSlug ?? null,
    thenFoodieAt: bankEndsAt ?? input.expiresAt,
  }
}
