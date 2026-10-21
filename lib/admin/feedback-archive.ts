/**
 * Archivo del buzón de /admin (docs/176). Sacar un mensaje del buzón sin borrarlo: las
 * opiniones siguen en la pestaña Reseñas (y se pueden publicar), y todo se puede devolver
 * a la bandeja. Sin migración, igual que «review_published» (docs/173): la marca vive en
 * product_events (event_name «feedback_archived», business_id = id del mensaje).
 * Solo del lado del servidor (cliente admin de Supabase).
 */

import { getSupabaseAdminClient } from "@/lib/supabase/admin"

export const ARCHIVED_EVENT = "feedback_archived"

export async function getArchivedFeedbackIds(): Promise<string[]> {
  const { data, error } = await getSupabaseAdminClient().from("product_events").select("business_id").eq("event_name", ARCHIVED_EVENT)
  if (error) throw error
  const rows = (data ?? []) as unknown as { business_id: string | null }[] // product_events no está en types/database.ts
  return rows.map((r) => r.business_id).filter((id): id is string => Boolean(id))
}

/** Archiva o devuelve a la bandeja; idempotente (nunca deja marcas repetidas). */
export async function setFeedbackArchived(ids: string[], archived: boolean): Promise<void> {
  if (ids.length === 0) return
  const admin = getSupabaseAdminClient()
  const { error: delError } = await admin.from("product_events").delete().eq("event_name", ARCHIVED_EVENT).in("business_id", ids)
  if (delError) throw delError
  if (archived) {
    const { error } = await admin.from("product_events").insert(ids.map((id) => ({ event_name: ARCHIVED_EVENT, business_id: id })) as never)
    if (error) throw error
  }
}
