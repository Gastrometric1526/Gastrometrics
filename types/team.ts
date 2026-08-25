import type { FeatureKey } from "@/lib/plans"

// Panel de Equipo — exclusivo del plan Chef Ejecutivo (ver lib/plans.ts, feature "team").
// Nota de alcance importante: desde docs/54, invitar acá SÍ manda un correo real y crea
// una cuenta real de Supabase Auth para la persona invitada (ver app/api/team/invite/
// route.ts) — pero todavía no existe la tabla de membresías (business_members, Fase 4)
// que conecte esa cuenta con el negocio/alcance específico. Este módulo (TEAM_MEMBERS en
// localStorage) sigue siendo la fuente de verdad de la INTENCIÓN del dueño de la cuenta
// (a quién invitó, qué debería poder ver/hacer) — todavía no una restricción en vivo
// aplicada del lado del servidor al login de esa persona.

export type TeamMemberStatus = "invitado" | "activo"

/** "dashboard" = ve todos los negocios (el dashboard principal); cualquier otro valor es el id de un negocio específico. */
export type TeamMemberScope = "dashboard" | string

export type TeamMemberPdfAccess = "ninguno" | "cliente" | "administrativo"

export interface TeamMemberActivityEntry {
  id: string
  description: string
  timestamp: string
}

export interface TeamMember {
  id: string
  email: string
  name?: string
  status: TeamMemberStatus
  invitedAt: string
  scope: TeamMemberScope
  allowedFeatures: FeatureKey[]
  pdfAccess: TeamMemberPdfAccess
  activity: TeamMemberActivityEntry[]
}

export const MAX_TEAM_MEMBERS = 3
