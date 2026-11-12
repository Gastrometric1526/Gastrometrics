/**
 * Borra las solicitudes de recuperación de cuenta resueltas hace más de 12 meses
 * (Política de Privacidad 1.7, sección 2, docs/286). Las abiertas nunca se borran solas.
 * Corre en la tarea diaria (app/api/cron/activation-emails).
 */

import { getSupabaseAdminClient } from "@/lib/supabase/admin"

export const RECOVERY_RETENTION_MONTHS = 12

export function recoveryPurgeCutoff(now = new Date()): string {
  const d = new Date(now)
  d.setMonth(d.getMonth() - RECOVERY_RETENTION_MONTHS)
  return d.toISOString()
}

export async function purgeResolvedRecoveryRequests(now = new Date()): Promise<{ deleted: number }> {
  const admin = getSupabaseAdminClient()
  const { data, error } = await admin
    .from("account_recovery_requests")
    .delete()
    .eq("status", "resuelto")
    .lt("resolved_at", recoveryPurgeCutoff(now))
    .select("id")
  if (error) throw new Error(error.message)
  return { deleted: data?.length ?? 0 }
}
