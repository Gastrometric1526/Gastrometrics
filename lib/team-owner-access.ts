/**
 * ¿El plan del dueño todavía incluye Equipo? (docs/236). Puro, cubierto por pruebas.
 *
 * Un invitado trabaja dentro del plan de la cuenta que lo invitó. Si ese plan vence, se
 * cancela o baja a uno sin Equipo, el invitado pierde el acceso a los negocios de esa cuenta
 * (no se borra nada: ni su cuenta ni los datos). Si el dueño vuelve a un plan con Equipo,
 * recupera los mismos permisos. Misma regla que el tope de invitaciones (getTeamInviteLimit):
 * Equipo está activo si el plan vigente permite al menos un invitado, contando los asientos
 * extra que /admin haya cedido.
 */

import { getPlanBySlug, getTeamInviteLimit } from "@/lib/plans"

export interface OwnerPlanRow {
  plan_slug?: string | null
  plan_expires_at?: string | null
  extra_team_seats?: number | null
}

export interface OwnerTeamAccess {
  /** Plan vigente del dueño (un plan vencido cuenta como Foodie). */
  planSlug: string
  teamActive: boolean
}

export function ownerTeamAccess(row: OwnerPlanRow | null | undefined, now = Date.now()): OwnerTeamAccess {
  const expired = Boolean(row?.plan_expires_at) && new Date(row!.plan_expires_at as string).getTime() < now
  const plan = getPlanBySlug(expired ? "foodie" : row?.plan_slug || "foodie")
  return { planSlug: plan.slug, teamActive: getTeamInviteLimit(plan, row?.extra_team_seats || 0) > 0 }
}
