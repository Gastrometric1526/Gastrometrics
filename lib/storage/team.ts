/**
 * TEAM STORAGE MODULE — migrado a Supabase real (ver docs/60 y supabase/migrations/
 * 0010_team_real.sql). Lista de personas invitadas al equipo, global a la cuenta (no
 * por negocio) — mismo patrón de caché reactiva que el resto de lib/storage/*.ts
 * (ver lib/storage/businesses.ts), con una única clave fija en vez de una por negocio.
 *
 * El otorgamiento real de acceso de LECTURA (business_members, activa las políticas
 * RLS `_member_select` que ya existían desde 0001_init.sql) pasa en dos lugares:
 * - Al invitar: en app/api/team/invite/route.ts (servidor, service role) — ahí es
 *   donde se conoce por primera vez el user_id real de la cuenta recién creada/
 *   enlazada, admin.generateLink() lo devuelve en el mismo momento de generar el link.
 * - Al quitar a alguien o cambiarle el alcance: acá mismo, desde la sesión del propio
 *   dueño — las políticas RLS de business_members (`business_members_owner_manage`)
 *   ya permiten que el dueño administre sus propias filas directo desde el cliente.
 */

import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { createBusinessScopedCache } from "./supabase-cache"
import { getAllBusinesses } from "./businesses"
import type { Database } from "@/types/database"
import type { TeamMember, TeamMemberScope, TeamMemberPdfAccess, TeamMemberActivityEntry } from "@/types/team"
import { MAX_TEAM_MEMBERS } from "@/types/team"
import type { FeatureKey } from "@/lib/plans"

type TeamMemberRow = Database["public"]["Tables"]["team_members"]["Row"]

const cache = createBusinessScopedCache<TeamMember>()
const ACCOUNT_KEY = "__team_members__"

/**
 * Resuelve a nombre de qué cuenta escribir: la propia (caso normal, el dueño en su
 * propia sesión) o la de la cuenta que delegó a este usuario la función 'team' (ver
 * docs/75 y supabase/migrations/0015_team_delegate_management.sql). getMyMemberships()
 * ya está precargada al iniciar sesión (contexts/auth-context.tsx), así que esto es
 * síncrono — sin esta resolución, un delegado invitando a alguien grabaría
 * owner_id = su propio id, creando una cuenta de equipo separada y equivocada en vez
 * de extender la de quien lo delegó.
 */
function resolveEffectiveOwnerId(callerId: string): string {
  const delegated = getMyMemberships().find((m) => m.allowedFeatures.includes("team"))
  return delegated?.ownerId || callerId
}

function rowToTeamMember(row: TeamMemberRow): TeamMember {
  return {
    id: row.id,
    ownerId: row.owner_id,
    email: row.email,
    name: row.name || undefined,
    status: row.status as TeamMember["status"],
    invitedAt: row.invited_at,
    scope: row.scope,
    allowedFeatures: (row.allowed_features as FeatureKey[]) || [],
    pdfAccess: row.pdf_access as TeamMemberPdfAccess,
    activity: (row.activity as TeamMemberActivityEntry[]) || [],
    invitedUserId: row.invited_user_id,
  }
}

/** Resuelve un alcance ("dashboard" = todos los negocios, o un businessId real) a la lista real de businessIds a otorgar/revocar. */
function resolveScopeToBusinessIds(scope: TeamMemberScope): string[] {
  if (scope === "dashboard") return getAllBusinesses().map((b) => b.id)
  return [scope]
}

/** Otorga acceso de lectura real (business_members) para un usuario ya vinculado, en el alcance dado — usa la sesión del dueño (RLS: business_members_owner_manage). */
async function grantBusinessAccess(invitedUserId: string, scope: TeamMemberScope): Promise<void> {
  const businessIds = resolveScopeToBusinessIds(scope)
  if (businessIds.length === 0) return
  const supabase = getSupabaseBrowserClient()
  const { error } = await supabase
    .from("business_members")
    .upsert(businessIds.map((business_id) => ({ business_id, user_id: invitedUserId, role: "member" })))
  if (error) console.error("[Team] Error otorgando acceso real al negocio:", error)
}

/** Revoca acceso de lectura real para un usuario, en el alcance dado. */
async function revokeBusinessAccess(invitedUserId: string, scope: TeamMemberScope): Promise<void> {
  const businessIds = resolveScopeToBusinessIds(scope)
  if (businessIds.length === 0) return
  const supabase = getSupabaseBrowserClient()
  const { error } = await supabase
    .from("business_members")
    .delete()
    .eq("user_id", invitedUserId)
    .in("business_id", businessIds)
  if (error) console.error("[Team] Error revocando acceso real al negocio:", error)
}

async function fetchTeamMembers(): Promise<TeamMember[]> {
  const supabase = getSupabaseBrowserClient()
  const { data, error } = await supabase.from("team_members").select("*").order("invited_at", { ascending: false })
  if (error) {
    console.error("[Team] Error cargando el equipo:", error)
    return []
  }
  return (data ?? []).map(rowToTeamMember)
}

export function ensureTeamMembersLoaded(): Promise<void> {
  return cache.ensureLoaded(ACCOUNT_KEY, fetchTeamMembers)
}

/** Síncrona — lee la caché en memoria (usada también por lib/storage/team-preview.ts y lib/plan-access.ts). */
export function getTeamMembers(): TeamMember[] {
  return cache.getSnapshot(ACCOUNT_KEY)
}

export function canInviteMoreMembers(): boolean {
  return getTeamMembers().length < MAX_TEAM_MEMBERS
}

const MY_MEMBERSHIPS_KEY = "__my_team_memberships__"

async function fetchMyMemberships(): Promise<TeamMember[]> {
  const supabase = getSupabaseBrowserClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []
  // Permitido por la política team_members_self_select (invited_user_id = auth.uid()),
  // sin importar quién sea el dueño que invitó — puede haber más de una fila si a este
  // correo lo invitó más de una cuenta distinta.
  const { data, error } = await supabase.from("team_members").select("*").eq("invited_user_id", user.id)
  if (error) {
    console.error("[Team] Error cargando membresías propias:", error)
    return []
  }
  return (data ?? []).map(rowToTeamMember)
}

export function ensureMyMembershipsLoaded(): Promise<void> {
  return cache.ensureLoaded(MY_MEMBERSHIPS_KEY, fetchMyMemberships)
}

/**
 * Síncrona — filas de team_members donde YO soy el invitado, no el dueño. A
 * diferencia de getTeamMembers() (el roster de a quién invité yo), esto es "en qué
 * negocios ajenos me invitaron a mí, y con qué permisos" — lo usa lib/plan-access.ts
 * para aplicar el filtro real de allowedFeatures/pdfAccess en la sesión real de un
 * miembro invitado (no solo en la Vista previa que corre el dueño).
 */
export function getMyMemberships(): TeamMember[] {
  return cache.getSnapshot(MY_MEMBERSHIPS_KEY)
}

/**
 * Guarda la fila de equipo (roster/configuración) — el otorgamiento real de
 * business_members para esta persona ya se hizo del lado del servidor (ver cabecera
 * de este archivo); `invitedUserId` llega desde ahí, ya resuelto.
 */
export async function inviteTeamMember(input: {
  email: string
  name?: string
  scope?: TeamMemberScope
  allowedFeatures?: FeatureKey[]
  pdfAccess?: TeamMemberPdfAccess
  invitedUserId?: string | null
}): Promise<TeamMember> {
  const all = getTeamMembers()
  if (all.length >= MAX_TEAM_MEMBERS) {
    throw new Error(`Ya invitaste al máximo de ${MAX_TEAM_MEMBERS} personas.`)
  }
  const normalizedEmail = input.email.trim().toLowerCase()
  if (all.some((m) => m.email.toLowerCase() === normalizedEmail)) {
    throw new Error("Ya invitaste a esta persona.")
  }

  const supabase = getSupabaseBrowserClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Debes iniciar sesión para invitar a alguien.")
  const ownerAccountId = resolveEffectiveOwnerId(user.id)

  const member: TeamMember = {
    id: `team-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ownerId: ownerAccountId,
    email: input.email.trim(),
    name: input.name?.trim() || undefined,
    status: "invitado",
    invitedAt: new Date().toISOString(),
    scope: input.scope || "dashboard",
    allowedFeatures: input.allowedFeatures || [],
    pdfAccess: input.pdfAccess || "ninguno",
    activity: [],
    invitedUserId: input.invitedUserId || null,
  }

  cache.mutateSnapshot(ACCOUNT_KEY, (list) => [member, ...list])

  const { error } = await supabase.from("team_members").insert({
    id: member.id,
    owner_id: ownerAccountId,
    email: member.email,
    name: member.name || null,
    status: member.status,
    scope: member.scope,
    allowed_features: member.allowedFeatures,
    pdf_access: member.pdfAccess,
    invited_user_id: member.invitedUserId || null,
    invited_at: member.invitedAt,
  })
  if (error) {
    // Revierte la caché optimista si el guardado real falló, para no dejar a la
    // persona "invitada" en la UI sin que de verdad haya quedado guardada.
    cache.mutateSnapshot(ACCOUNT_KEY, (list) => list.filter((m) => m.id !== member.id))
    throw error
  }

  return member
}

export async function updateTeamMember(
  id: string,
  updates: Partial<Omit<TeamMember, "id" | "invitedAt" | "activity" | "invitedUserId">>,
): Promise<void> {
  const previous = getTeamMembers().find((m) => m.id === id)
  cache.mutateSnapshot(ACCOUNT_KEY, (list) => list.map((m) => (m.id === id ? { ...m, ...updates } : m)))

  const supabase = getSupabaseBrowserClient()
  const dbUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (updates.name !== undefined) dbUpdates.name = updates.name || null
  if (updates.status !== undefined) dbUpdates.status = updates.status
  if (updates.scope !== undefined) dbUpdates.scope = updates.scope
  if (updates.allowedFeatures !== undefined) dbUpdates.allowed_features = updates.allowedFeatures
  if (updates.pdfAccess !== undefined) dbUpdates.pdf_access = updates.pdfAccess

  const { error } = await supabase
    .from("team_members")
    .update(dbUpdates as Database["public"]["Tables"]["team_members"]["Update"])
    .eq("id", id)
  if (error) console.error("[Team] Error actualizando miembro:", error)

  // Si cambió el alcance, el acceso real (business_members) tiene que moverse con él —
  // revoca el alcance viejo y otorga el nuevo, solo si esta persona ya tiene cuenta
  // vinculada (invitedUserId).
  if (previous?.invitedUserId && updates.scope !== undefined && updates.scope !== previous.scope) {
    await revokeBusinessAccess(previous.invitedUserId, previous.scope)
    await grantBusinessAccess(previous.invitedUserId, updates.scope)
  }
}

export async function removeTeamMember(id: string): Promise<void> {
  const member = getTeamMembers().find((m) => m.id === id)
  cache.mutateSnapshot(ACCOUNT_KEY, (list) => list.filter((m) => m.id !== id))

  const supabase = getSupabaseBrowserClient()
  const { error } = await supabase.from("team_members").delete().eq("id", id)
  if (error) console.error("[Team] Error eliminando miembro:", error)

  // Revoca el acceso real, no solo la fila del roster — si no, la persona removida
  // seguiría pudiendo leer el negocio vía su propia sesión aunque ya no aparezca en /equipo.
  if (member?.invitedUserId) {
    await revokeBusinessAccess(member.invitedUserId, member.scope)
  }
}
