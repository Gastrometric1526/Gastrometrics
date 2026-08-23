// "Vista previa como [miembro]" — sin backend real no existe una sesión separada para
// cada persona invitada (ver types/team.ts), así que esta es la única forma de que el
// dueño de la cuenta vea de verdad, en la propia app, exactamente lo que un invitado
// vería según los permisos que le configuró en /equipo: qué herramientas, qué PDFs, y
// si tiene acceso al dashboard principal o solo a un negocio específico. Es una
// simulación explícita (con un banner permanente mientras está activa, ver
// components/team-preview-banner.tsx) para el propio dueño, no una sesión real de esa
// persona — sigue siendo el mismo localStorage de siempre.
import { getTeamMembers } from "./team"
import type { TeamMember } from "@/types/team"

const PREVIEW_KEY = "team_preview_member_id"
export const TEAM_PREVIEW_EVENT = "gm:team-preview-changed"

export function getActivePreviewMemberId(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(PREVIEW_KEY)
}

export function getActivePreviewMember(): TeamMember | null {
  const id = getActivePreviewMemberId()
  if (!id) return null
  return getTeamMembers().find((m) => m.id === id) || null
}

export function startTeamPreview(memberId: string): void {
  if (typeof window === "undefined") return
  localStorage.setItem(PREVIEW_KEY, memberId)
  window.dispatchEvent(new CustomEvent(TEAM_PREVIEW_EVENT))
}

export function stopTeamPreview(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(PREVIEW_KEY)
  window.dispatchEvent(new CustomEvent(TEAM_PREVIEW_EVENT))
}
