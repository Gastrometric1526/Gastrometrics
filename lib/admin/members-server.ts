/**
 * Lecturas y escrituras de `admin_members` (docs/282), siempre con la llave de servicio y
 * solo desde rutas de /admin. Si la migración 0040 todavía no se corrió, `ready` es false
 * y el panel sigue funcionando con el código de emergencia.
 */

import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { PERMANENT_ADMIN_EMAIL, type AdminMember, type AdminRole, type AdminMemberStatus } from "@/lib/admin/members"

const TABLE = "admin_members"

/**
 * La cuenta permanente (docs/290) siempre está, siempre como dueña: si alguien la borró de la
 * tabla o le cambió el rol, se vuelve a poner. Se crea «sin enviar» (como cualquier acceso
 * nuevo): el dueño manda la invitación desde Sistema → Quién entra al panel, y con ella la
 * cuenta crea su contraseña. Nunca se manda un correo sola.
 */
async function ensurePermanentOwner(members: AdminMember[]): Promise<AdminMember[]> {
  const admin = getSupabaseAdminClient()
  const current = members.find((m) => m.email === PERMANENT_ADMIN_EMAIL)
  if (current && current.role === "owner") return members
  if (current) {
    const patch = { role: "owner" as const }
    const { error } = await admin.from(TABLE).update(patch).eq("email", PERMANENT_ADMIN_EMAIL)
    if (error) console.error("[admin-members] cuenta permanente:", error.message)
    return members.map((m) => (m.email === PERMANENT_ADMIN_EMAIL ? { ...m, ...patch } : m))
  }
  const row = { email: PERMANENT_ADMIN_EMAIL, role: "owner" as const, status: "pending" as const, created_by: "sistema" }
  const { data, error } = await admin.from(TABLE).insert(row).select("*").maybeSingle()
  if (error) {
    console.error("[admin-members] cuenta permanente:", error.message)
    return members
  }
  return [...members, (data as AdminMember | null) ?? ({ ...row, invited_at: null, invited_by: null, accepted_at: null, last_login_at: null, created_at: new Date().toISOString() } as AdminMember)]
}

export async function listAdminMembers(): Promise<{ ready: boolean; members: AdminMember[] }> {
  const admin = getSupabaseAdminClient()
  const { data, error } = await admin.from(TABLE).select("*")
  if (error) {
    // 42P01 = la tabla no existe (falta correr 0040).
    if (error.code !== "42P01") console.error("[admin-members] lectura:", error.message)
    return { ready: false, members: [] }
  }
  return { ready: true, members: await ensurePermanentOwner((data ?? []) as AdminMember[]) }
}

export async function getAdminMember(email: string): Promise<{ ready: boolean; member: AdminMember | null }> {
  const admin = getSupabaseAdminClient()
  const { data, error } = await admin.from(TABLE).select("*").eq("email", email.toLowerCase()).maybeSingle()
  if (error) return { ready: false, member: null }
  if (email.toLowerCase() === PERMANENT_ADMIN_EMAIL) {
    const members = await ensurePermanentOwner(data ? [data as AdminMember] : [])
    return { ready: true, member: members.find((m) => m.email === PERMANENT_ADMIN_EMAIL) ?? null }
  }
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
  // Nunca la cuenta permanente (docs/290), aunque la ruta ya lo impide.
  if (email.toLowerCase() === PERMANENT_ADMIN_EMAIL) return false
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
