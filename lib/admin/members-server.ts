/**
 * Lecturas y escrituras de `admin_members` (docs/282), siempre con la llave de servicio y
 * solo desde rutas de /admin. Si la migración 0040 todavía no se corrió, `ready` es false
 * y el panel sigue funcionando con el código de emergencia.
 */

import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import type { AdminMember, AdminRole, AdminMemberStatus } from "@/lib/admin/members"

const TABLE = "admin_members"

export async function listAdminMembers(): Promise<{ ready: boolean; members: AdminMember[] }> {
  const admin = getSupabaseAdminClient()
  const { data, error } = await admin.from(TABLE).select("*")
  if (error) {
    // 42P01 = la tabla no existe (falta correr 0040).
    if (error.code !== "42P01") console.error("[admin-members] lectura:", error.message)
    return { ready: false, members: [] }
  }
  return { ready: true, members: (data ?? []) as AdminMember[] }
}

export async function getAdminMember(email: string): Promise<{ ready: boolean; member: AdminMember | null }> {
  const admin = getSupabaseAdminClient()
  const { data, error } = await admin.from(TABLE).select("*").eq("email", email.toLowerCase()).maybeSingle()
  if (error) return { ready: false, member: null }
  return { ready: true, member: (data as AdminMember | null) ?? null }
}

export async function insertAdminMember(input: { email: string; role: AdminRole; status: AdminMemberStatus; createdBy: string | null }): Promise<boolean> {
  const admin = getSupabaseAdminClient()
  const now = new Date().toISOString()
  const { error } = await admin.from(TABLE).insert({
    email: input.email,
    role: input.role,
    status: input.status,
    created_by: input.createdBy,
    ...(input.status === "active" ? { accepted_at: now, last_login_at: now } : {}),
  })
  if (error) console.error("[admin-members] alta:", error.message)
  return !error
}

export async function updateAdminMember(email: string, patch: Partial<Omit<AdminMember, "email" | "created_at">>): Promise<boolean> {
  const admin = getSupabaseAdminClient()
  const { error } = await admin.from(TABLE).update(patch).eq("email", email)
  if (error) console.error("[admin-members] cambio:", error.message)
  return !error
}

export async function deleteAdminMember(email: string): Promise<boolean> {
  const admin = getSupabaseAdminClient()
  const { error } = await admin.from(TABLE).delete().eq("email", email)
  if (error) console.error("[admin-members] baja:", error.message)
  return !error
}

/** Registra la entrada: «invited» pasa a «active» la primera vez. */
export async function recordAdminLogin(member: AdminMember): Promise<void> {
  const now = new Date().toISOString()
  await updateAdminMember(member.email, {
    last_login_at: now,
    ...(member.status !== "active" ? { status: "active" as const, accepted_at: member.accepted_at ?? now } : {}),
  })
}
