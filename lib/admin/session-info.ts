/**
 * Estado del acceso a /admin para la pantalla de entrada y el panel (docs/282): si hay
 * sesión del panel y de quién, qué cuenta de la app está abierta en este navegador, si esa
 * cuenta puede entrar y si todavía no hay dueño (la tabla está vacía).
 */

import { getAdminIdentity, type AdminIdentity } from "@/lib/admin-auth"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import { listAdminMembers } from "@/lib/admin/members-server"
import { canManageAccess, canSignIn, type AdminRole } from "@/lib/admin/members"

export type AdminSessionInfo = {
  unlocked: boolean
  identity: { kind: "account"; email: string; role: AdminRole | null } | { kind: "code" } | null
  canManage: boolean
  /** Cuenta de la app abierta en este navegador (para «Entrar como …»). */
  account: { email: string } | null
  accountAllowed: boolean
  membersReady: boolean
  needsOwner: boolean
}

export async function getAppAccountEmail(): Promise<string | null> {
  try {
    const supabase = getSupabaseServerClient()
    const { data } = await supabase.auth.getUser()
    return data.user?.email?.toLowerCase() ?? null
  } catch {
    return null
  }
}

export async function getAdminSessionInfo(): Promise<AdminSessionInfo> {
  const [identity, accountEmail, { ready, members }] = await Promise.all([getAdminIdentity(), getAppAccountEmail(), listAdminMembers()])
  const member = accountEmail ? members.find((m) => m.email === accountEmail) : undefined
  return {
    unlocked: identity !== null,
    identity: describe(identity, members),
    canManage: canManageAccess(identity, members),
    account: accountEmail ? { email: accountEmail } : null,
    accountAllowed: canSignIn(member),
    membersReady: ready,
    needsOwner: ready && members.length === 0,
  }
}

function describe(identity: AdminIdentity | null, members: { email: string; role: AdminRole }[]): AdminSessionInfo["identity"] {
  if (!identity) return null
  if (identity.kind === "code") return { kind: "code" }
  const email = identity.email.toLowerCase()
  return { kind: "account", email, role: members.find((m) => m.email === email)?.role ?? null }
}
