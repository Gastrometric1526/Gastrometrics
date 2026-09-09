// Cede de más, por cuenta, por encima del límite base de su plan — pedido explícito
// del dueño del proyecto: poder otorgar negocios extra o cupos de equipo extra a una
// cuenta puntual desde /admin, sin tener que subirle el plan entero (p. ej. un tester
// en Chef de Partie que necesita 2 negocios sin pasar a Sous Chef). Fuente de verdad
// real: account_plans.extra_businesses / extra_team_seats (ver
// supabase/migrations/0019_account_overrides.sql) — el cliente no puede escribirla
// (misma RLS de solo lectura que plan_slug, ver 0004_account_plans.sql), solo la
// puede cambiar /admin vía app/api/admin/account-plan/route.ts con la service role.
//
// Este módulo es un archivo aparte (no vive en lib/plan-access.ts) a propósito: tanto
// plan-access.ts como lib/storage/team.ts necesitan leer estos valores, y
// plan-access.ts ya importa de storage/team.ts — meter esto directo en plan-access.ts
// hubiera creado un import circular entre los dos.

const OVERRIDES_STORAGE_KEY = "current_plan_overrides"

export interface PlanOverrides {
  extraBusinesses: number
  extraTeamSeats: number
}

const DEFAULT_OVERRIDES: PlanOverrides = { extraBusinesses: 0, extraTeamSeats: 0 }

/** Caché local (localStorage) — contexts/auth-context.tsx la sincroniza desde Supabase justo después de resolver la sesión, mismo patrón que setCurrentPlanSlug. */
export function getCurrentPlanOverrides(): PlanOverrides {
  if (typeof window === "undefined") return DEFAULT_OVERRIDES
  try {
    const raw = localStorage.getItem(OVERRIDES_STORAGE_KEY)
    if (!raw) return DEFAULT_OVERRIDES
    const parsed = JSON.parse(raw)
    return {
      extraBusinesses: Number(parsed?.extraBusinesses) || 0,
      extraTeamSeats: Number(parsed?.extraTeamSeats) || 0,
    }
  } catch {
    return DEFAULT_OVERRIDES
  }
}

export function setCurrentPlanOverrides(overrides: PlanOverrides): void {
  if (typeof window === "undefined") return
  localStorage.setItem(OVERRIDES_STORAGE_KEY, JSON.stringify(overrides))
}
