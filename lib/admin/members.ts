/**
 * Personas con acceso a /admin (pedido del dueño, docs/282). Parte pura: quién puede
 * entrar, quién puede dar o quitar acceso y qué pasa con el estado al entrar.
 *
 * - «owner»: el dueño. Da y quita acceso. La primera cuenta que entra con el código de
 *   emergencia (con la tabla vacía) queda como dueña.
 * - «admin»: usa todo el panel, pero no da ni quita acceso.
 * - Estados: «pending» (guardado, sin enviar: todavía NO puede entrar), «invited» (se le
 *   mandó el correo: ya puede entrar) y «active» (ya entró al menos una vez).
 * El código de emergencia cuenta como dueño.
 */

import type { AdminIdentity } from "@/lib/admin-auth"
import { CONTACT_EMAIL } from "@/lib/site-links"

/**
 * Cuenta dueña permanente de /admin (pedido del dueño, docs/290): la del negocio, la misma
 * dirección pública de contacto (ya visible en el sitio). Siempre es dueña, siempre puede
 * entrar y nunca se puede quitar ni bajar de rol; si falta en la tabla, se vuelve a crear
 * (`ensurePermanentOwner`, lib/admin/members-server.ts).
 */
export const PERMANENT_ADMIN_EMAIL = CONTACT_EMAIL.toLowerCase()

export function isPermanentAdmin(email: string | null | undefined): boolean {
  return !!email && email.trim().toLowerCase() === PERMANENT_ADMIN_EMAIL
}

export type AdminRole = "owner" | "admin"
export type AdminMemberStatus = "pending" | "invited" | "active"

export type AdminMember = {
  email: string
  role: AdminRole
  status: AdminMemberStatus
  invited_at: string | null
  invited_by: string | null
  accepted_at: string | null
  last_login_at: string | null
  created_at: string
  created_by: string | null
}

export function normalizeAdminEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  const email = raw.trim().toLowerCase()
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null
  return email
}

/** ¿Puede entrar al panel con su cuenta? Un acceso guardado sin enviar todavía no. */
export function canSignIn(member: Pick<AdminMember, "status"> | null | undefined): boolean {
  return !!member && (member.status === "invited" || member.status === "active")
}

/** ¿Esta sesión puede dar o quitar acceso? El dueño o el código de emergencia. */
export function canManageAccess(identity: AdminIdentity | null, members: Pick<AdminMember, "email" | "role">[]): boolean {
  if (!identity) return false
  if (identity.kind === "code") return true
  if (isPermanentAdmin(identity.email)) return true
  return members.some((m) => m.email === identity.email.toLowerCase() && m.role === "owner")
}

/** ¿Se puede quitar este acceso? Nunca la cuenta permanente, ni el propio, ni el último dueño. */
export function canRemove(
  target: string,
  identity: AdminIdentity | null,
  members: Pick<AdminMember, "email" | "role">[],
): { ok: true } | { ok: false; reason: "permanent" | "self" | "last_owner" | "missing" } {
  if (isPermanentAdmin(target)) return { ok: false, reason: "permanent" }
  const member = members.find((m) => m.email === target)
  if (!member) return { ok: false, reason: "missing" }
  if (identity?.kind === "account" && identity.email.toLowerCase() === target) return { ok: false, reason: "self" }
  if (member.role === "owner" && members.filter((m) => m.role === "owner").length <= 1) return { ok: false, reason: "last_owner" }
  return { ok: true }
}

/** Orden de la lista: dueños primero, luego con acceso, invitados y sin enviar. */
export function sortMembers<T extends Pick<AdminMember, "email" | "role" | "status">>(members: T[]): T[] {
  const statusRank: Record<AdminMemberStatus, number> = { active: 0, invited: 1, pending: 2 }
  return [...members].sort((a, b) => Number(isPermanentAdmin(b.email)) - Number(isPermanentAdmin(a.email)) || (a.role === b.role ? 0 : a.role === "owner" ? -1 : 1) || statusRank[a.status] - statusRank[b.status] || a.email.localeCompare(b.email))
}
