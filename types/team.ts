import type { FeatureKey } from "@/lib/plans"

// Panel de Equipo — exclusivo del plan Chef Ejecutivo (ver lib/plans.ts, feature "team").
// Nota de alcance importante: la app no tiene backend real ni sesiones separadas por
// persona (ver docs/12-guia-backend.md) — esto guarda la CONFIGURACIÓN de a quién se
// invitó y qué debería poder ver/hacer, lista para cuando se conecte un backend real que
// pueda aplicarla de verdad en el login de cada persona invitada. Hoy es la fuente de
// verdad de la intención del dueño de la cuenta, no una restricción en vivo.

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
