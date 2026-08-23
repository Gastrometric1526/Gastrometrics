/**
 * TEAM STORAGE MODULE
 * Lista de personas invitadas al equipo — global a la cuenta (no por negocio), como
 * feedback.ts: quien invita lo hace desde la cuenta, no desde un negocio en particular,
 * y el acceso que se le da a cada persona puede incluir varios negocios a la vez.
 */

import type { TeamMember, TeamMemberScope, TeamMemberPdfAccess } from "@/types/team"
import { MAX_TEAM_MEMBERS } from "@/types/team"
import type { FeatureKey } from "@/lib/plans"
import { getFromStorage, saveToStorage, STORAGE_KEYS } from "./core"

export function getTeamMembers(): TeamMember[] {
  return getFromStorage<TeamMember[]>(STORAGE_KEYS.TEAM_MEMBERS) || []
}

export function canInviteMoreMembers(): boolean {
  return getTeamMembers().length < MAX_TEAM_MEMBERS
}

export function inviteTeamMember(input: {
  email: string
  name?: string
  scope?: TeamMemberScope
  allowedFeatures?: FeatureKey[]
  pdfAccess?: TeamMemberPdfAccess
}): TeamMember {
  const all = getTeamMembers()
  if (all.length >= MAX_TEAM_MEMBERS) {
    throw new Error(`Ya invitaste al máximo de ${MAX_TEAM_MEMBERS} personas.`)
  }
  const normalizedEmail = input.email.trim().toLowerCase()
  if (all.some((m) => m.email.toLowerCase() === normalizedEmail)) {
    throw new Error("Ya invitaste a esta persona.")
  }

  const member: TeamMember = {
    id: `team-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    email: input.email.trim(),
    name: input.name?.trim() || undefined,
    status: "invitado",
    invitedAt: new Date().toISOString(),
    scope: input.scope || "dashboard",
    allowedFeatures: input.allowedFeatures || [],
    pdfAccess: input.pdfAccess || "ninguno",
    activity: [],
  }

  saveToStorage(STORAGE_KEYS.TEAM_MEMBERS, [member, ...all])
  return member
}

export function updateTeamMember(id: string, updates: Partial<Omit<TeamMember, "id" | "invitedAt" | "activity">>): void {
  const all = getTeamMembers()
  const updated = all.map((m) => (m.id === id ? { ...m, ...updates } : m))
  saveToStorage(STORAGE_KEYS.TEAM_MEMBERS, updated)
}

export function removeTeamMember(id: string): void {
  const all = getTeamMembers()
  saveToStorage(
    STORAGE_KEYS.TEAM_MEMBERS,
    all.filter((m) => m.id !== id),
  )
}
