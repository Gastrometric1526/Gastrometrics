/**
 * Estado del acceso a /admin para la pantalla de entrada y el panel (docs/282): si hay
 * sesión del panel y de quién, qué cuenta de la app está abierta en este navegador, si esa
 * cuenta puede entrar y si todavía no hay dueño (la tabla está vacía).
 */

import { getAdminIdentity, type AdminIdentity } from "@/lib/admin-auth"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import { listAdminMembers } from "@/lib/admin/members-server"
import { canManageAccess, canSignIn, type AdminRole } from "@/lib/admin/members"
import { nameForUser, namesForEmails } from "@/lib/admin/admin-names"

export type AdminSessionInfo = {
  unlocked: boolean
  /** `name`: el de su perfil o el de Google (docs/318); null si no tiene. */
  identity: { kind: "account"; email: string; name: string | null; role: AdminRole | null } | { kind: "code" } | null
  canManage: boolean
  /** Cuenta de la app abierta en este navegador (para «Entrar como …»). */
  account: { email: string; name: string | null } | null
  accountAllowed: boolean
  membersReady: boolean
  needsOwner: boolean
}

/** Cuenta de la app abierta en este navegador, con su nombre (docs/318). */
export async function getAppAccount(): Promise<{ email: string; name: string | null } | null> {
  try {
    const supabase = getSupabaseServerClient()
    const { data } = await supabase.auth.getUser()
    const user = data.user
    if (!user?.email) return null
    return { email: user.email.toLowerCase(), name: await nameForUser(user).catch(() => null) }
  } catch {
    return null
  }
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
  const [identity, account, { ready, members }] = await Promise.all([getAdminIdentity(), getAppAccount(), listAdminMembers()])
  const accountEmail = account?.email ?? null
  const member = accountEmail ? members.find((m) => m.email === accountEmail) : undefined
  // Nombre de quien tiene la sesión del panel: el de la cuenta abierta si es la misma; si no, se busca.
  let identityName: string | null = null
  if (identity?.kind === "account") {
    const email = identity.email.toLowerCase()
    identityName = email === accountEmail ? (account?.name ?? null) : ((await namesForEmails([email])).get(email) ?? null)
  }
  return {
    unlocked: identity !== null,
    identity: describe(identity, members, identityName),
    canManage: canManageAccess(identity, members),
    account,
    accountAllowed: canSignIn(member),
    membersReady: ready,
    needsOwner: ready && members.length === 0,
  }
}

function describe(identity: AdminIdentity | null, members: { email: string; role: AdminRole }[], name: string | null): AdminSessionInfo["identity"] {
  if (!identity) return null
  if (identity.kind === "code") return { kind: "code" }
  const email = identity.email.toLowerCase()
  return { kind: "account", email, name, role: members.find((m) => m.email === email)?.role ?? null }
}
