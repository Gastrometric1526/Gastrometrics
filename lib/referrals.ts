/**
 * Programa de referidos «Regala un mes, gana un mes» (docs/179) — decisiones del dueño:
 * - Quien entra por el enlace de alguien recibe 30 días de Chef Ejecutivo, sin tarjeta
 *   y sin pedir nada. Al terminar vuelve solo a Foodie (cancelación gratuita), salvo que
 *   decida pagar.
 * - Quien invitó gana un mes cuando el invitado se ACTIVA (1 receta con costo, o paga un
 *   plan) dentro de sus 30 días. Si no se activa, la invitación vence sin premio.
 * - El premio es Chef Ejecutivo (el plan más alto, docs/182): con Foodie empieza hoy; con un
 *   plan por tiempo (cocinas fundadoras, /admin) se suman 30 días al final, subiendo a
 *   Chef Ejecutivo si era menor; si ya paga con Stripe, recibe un mes de su plan como saldo
 *   a favor. El «banco» de meses guardados queda solo por si algún día hay un plan mayor.
 * - Tope: 12 meses ganados por año.
 * Distinto de Equipo: aquí cada quien tiene su propia cuenta y su propio negocio.
 *
 * Aquí está la parte pura (cubierta por pruebas); la parte con base de datos vive en
 * lib/services/referrals.ts.
 */

import { getPlanBySlug, plans } from "@/lib/plans"

export const REFERRAL = {
  // Chef Ejecutivo para los dos lados (decisión del dueño, docs/182; antes Chef de Partie).
  giftPlanSlug: "chef-ejecutivo",
  giftDays: 30,
  /** Días que tiene el invitado para activarse (= su mes gratis). */
  activationWindowDays: 30,
  maxRewardsPerYear: 12,
  cookieName: "gm_ref",
  cookieDays: 30,
  /** Días desde el registro del invitado en que se le recuerda a quien invitó si aún no empieza. */
  nudgeDays: [3, 14] as const,
} as const

const DAY_MS = 86_400_000

// ─── Códigos ───

/** Código de invitación: los primeros 8 caracteres del id de la cuenta, en mayúsculas. No hay que guardarlo. */
export function referralCodeFor(userId: string): string {
  return userId.replace(/-/g, "").slice(0, 8).toUpperCase()
}

export function normalizeReferralCode(raw: string | null | undefined): string | null {
  const code = (raw || "").trim().toUpperCase()
  return /^[0-9A-F]{8}$/.test(code) ? code : null
}

/** Rango de ids (uuid) que empiezan con el código, para buscar la cuenta sin guardar nada. */
export function uuidRangeForCode(code: string): { from: string; to: string } | null {
  const c = normalizeReferralCode(code)
  if (!c) return null
  const hex = c.toLowerCase()
  return { from: `${hex}-0000-0000-0000-000000000000`, to: `${hex}-ffff-ffff-ffff-ffffffffffff` }
}

export function referralLink(siteUrl: string, code: string): string {
  return `${siteUrl.replace(/\/+$/, "")}/r/${code}`
}

// ─── Premios ───

export interface PlanState {
  planSlug: string
  /** Vencimiento de un plan gratis por tiempo (fundadoras, /admin, referidos); null si no vence. */
  expiresAt: string | null
  hasStripeSubscription: boolean
}

export type RewardAction =
  | { kind: "grant"; planSlug: string; expiresAt: string }
  | { kind: "extend"; planSlug: string; expiresAt: string }
  | { kind: "bank"; days: number }
  | { kind: "stripe_credit"; amountCents: number; planSlug: string }
  | { kind: "none"; reason: "permanent_plan" | "free_paid_plan" }

const rank = (slug: string) => plans.findIndex((p) => p.slug === getPlanBySlug(slug).slug)

/**
 * Qué recibe una cuenta al ganar un mes (el invitado al registrarse, o quien invitó al
 * activarse su invitado). Nunca baja de plan ni pisa uno mejor.
 */
export function rewardAction(state: PlanState, now: number, days: number = REFERRAL.giftDays): RewardAction {
  const gift = REFERRAL.giftPlanSlug
  if (state.hasStripeSubscription) {
    const cents = getPlanBySlug(state.planSlug).priceUsdCents
    return cents > 0 ? { kind: "stripe_credit", amountCents: Math.round((cents * days) / 30), planSlug: getPlanBySlug(state.planSlug).slug } : { kind: "none", reason: "free_paid_plan" }
  }
  const expiresAt = state.expiresAt ? new Date(state.expiresAt).getTime() : null
  const onFoodie = getPlanBySlug(state.planSlug).slug === "foodie"
  const expired = expiresAt !== null && expiresAt <= now
  if (onFoodie || expired) return { kind: "grant", planSlug: gift, expiresAt: new Date(now + days * DAY_MS).toISOString() }
  // Plan sin vencimiento y sin Stripe (asignado para siempre desde /admin o tester): no hay cómo usar un mes más.
  if (expiresAt === null) return { kind: "none", reason: "permanent_plan" }
  if (rank(state.planSlug) > rank(gift)) return { kind: "bank", days }
  // Mismo plan, o uno menor por tiempo: el plan del premio hasta el vencimiento actual + los días ganados.
  return { kind: state.planSlug === gift ? "extend" : "grant", planSlug: gift, expiresAt: new Date(expiresAt + days * DAY_MS).toISOString() }
}

/**
 * Meses guardados: se usan cuando la cuenta queda en Foodie (su plan gratis venció) y no
 * paga. Devuelve el plan a aplicar, o null si todavía no toca.
 */
export function bankApplication(state: PlanState, bankDays: number, now: number): { planSlug: string; expiresAt: string } | null {
  if (!(bankDays > 0) || state.hasStripeSubscription) return null
  const expiresAt = state.expiresAt ? new Date(state.expiresAt).getTime() : null
  const onFoodie = getPlanBySlug(state.planSlug).slug === "foodie"
  if (!onFoodie && !(expiresAt !== null && expiresAt <= now)) return null
  return { planSlug: REFERRAL.giftPlanSlug, expiresAt: new Date(now + bankDays * DAY_MS).toISOString() }
}

// ─── Estado de una invitación ───

export type ReferralStatus = "registered" | "active" | "rewarded" | "expired"

export interface InviteeReferral {
  /** Cuenta que invitó. */
  by: string
  code: string
  /** Fecha de registro del invitado. */
  at: string
  status: ReferralStatus
  giftAt?: string
  activatedAt?: string
  rewardedAt?: string
  /** Avisos a quien invitó ya enviados (días). */
  nudges?: number[]
}

/** Día de la ventana del invitado (1 = el día del registro). */
export function windowDay(registeredAt: string, now: number): number {
  return Math.floor((now - new Date(registeredAt).getTime()) / DAY_MS) + 1
}

export type ActivationStep =
  | { action: "reward" }
  | { action: "activate_capped" }
  | { action: "expire" }
  | { action: "nudge"; day: number }
  | { action: "wait" }

/** Qué hacer hoy con una invitación todavía «registrada». */
export function activationStep(input: { referral: InviteeReferral; isActive: boolean; rewardsLastYear: number; now: number }): ActivationStep {
  const { referral, now } = input
  if (referral.status !== "registered") return { action: "wait" }
  const inWindow = now - new Date(referral.at).getTime() <= REFERRAL.activationWindowDays * DAY_MS
  if (input.isActive && inWindow) return input.rewardsLastYear >= REFERRAL.maxRewardsPerYear ? { action: "activate_capped" } : { action: "reward" }
  if (!inWindow) return { action: "expire" }
  const day = windowDay(referral.at, now)
  const due = [...REFERRAL.nudgeDays].reverse().find((d) => day >= d + 1 && !(referral.nudges || []).includes(d))
  return due ? { action: "nudge", day: due } : { action: "wait" }
}

export interface RewardRecord {
  invitee: string
  at: string
  kind: RewardAction["kind"]
}

export function rewardsInLastYear(rewards: RewardRecord[] | undefined, now: number): number {
  return (rewards || []).filter((r) => r.kind !== "none" && now - new Date(r.at).getTime() < 365 * DAY_MS).length
}
