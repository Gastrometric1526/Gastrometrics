/**
 * Nombre de las personas del panel (docs/318, pedido del dueño: «la pantalla de ingreso
 * tal vez debería tener el nombre de la persona, no el correo»). El nombre sale de su perfil
 * (`profiles.full_name`) o, si está vacío, del que trajo Google (`full_name`/`name`). Sin
 * nombre se usa el correo. Solo en el servidor, con la llave de servicio.
 */

import { getSupabaseAdminClient } from "@/lib/supabase/admin"

type UserLike = { id: string; email?: string | null; user_metadata?: Record<string, unknown> | null }

/** Nombre que trae la cuenta de Auth (Google o el registro). Puro. */
export function nameFromMetadata(user: { user_metadata?: Record<string, unknown> | null } | null | undefined): string | null {
  const meta = user?.user_metadata ?? {}
  for (const key of ["full_name", "name"]) {
    const value = meta[key]
    if (typeof value === "string" && value.trim()) return value.trim()
  }
  return null
}

/** Primer nombre que no esté vacío. Puro. */
export function pickName(...candidates: (string | null | undefined)[]): string | null {
  for (const c of candidates) if (typeof c === "string" && c.trim()) return c.trim()
  return null
}

async function profileNames(ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  if (!ids.length) return out
  const { data } = await getSupabaseAdminClient().from("profiles").select("id, full_name").in("id", ids)
  for (const row of (data ?? []) as { id: string; full_name: string | null }[]) if (row.full_name?.trim()) out.set(row.id, row.full_name.trim())
  return out
}

/** Nombre de una cuenta ya leída (la de la sesión de la app). */
export async function nameForUser(user: UserLike): Promise<string | null> {
  const profiles = await profileNames([user.id]).catch(() => new Map<string, string>())
  return pickName(profiles.get(user.id), nameFromMetadata(user))
}

/** Nombres por correo (en minúsculas). Los correos sin cuenta no aparecen. */
export async function namesForEmails(emails: string[]): Promise<Map<string, string>> {
  const wanted = new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))
  const out = new Map<string, string>()
  if (!wanted.size) return out
  try {
    const admin = getSupabaseAdminClient()
    const found: UserLike[] = []
    for (let page = 1; page <= 25 && found.length < wanted.size; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
      if (error || !data) break
      for (const u of data.users as UserLike[]) if (u.email && wanted.has(u.email.toLowerCase())) found.push(u)
      if (data.users.length < 200) break
    }
    const profiles = await profileNames(found.map((u) => u.id))
    for (const u of found) {
      const name = pickName(profiles.get(u.id), nameFromMetadata(u))
      if (name) out.set((u.email as string).toLowerCase(), name)
    }
  } catch (error) {
    console.error("[admin-names]", error)
  }
  return out
}
