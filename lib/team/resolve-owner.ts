import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Resuelve a nombre de qué cuenta debe actuar quien llama: la suya propia (caso de
 * siempre, el dueño usando su propia sesión), o la de la cuenta que lo delegó como
 * gestor de equipo (allowed_features contiene 'team' — ver docs/75 y
 * supabase/migrations/0015_team_delegate_management.sql). Debe llamarse con un
 * cliente de service role (bypassa RLS) porque necesita poder leer la fila de
 * team_members sin importar de qué cuenta sea.
 */
export async function resolveTeamOwnerId(admin: SupabaseClient, callerId: string): Promise<string> {
  const { data } = await admin
    .from("team_members")
    .select("owner_id")
    .eq("invited_user_id", callerId)
    .contains("allowed_features", ["team"])
    .limit(1)
    .maybeSingle()
  return data?.owner_id || callerId
}
