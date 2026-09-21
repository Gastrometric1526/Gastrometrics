/**
 * Purga real de cuentas que pidieron eliminarse (ver app/api/account/delete/route.ts)
 * y ya cumplieron los 30 días de gracia prometidos en los nuevos Términos de Uso §5 /
 * Política de Privacidad §6 (ver docs/118).
 *
 * runAccountDeletionPurge() se llama desde app/api/cron/activation-emails/route.ts, NO
 * desde su propio cron — mismo motivo que runPlanExpiryReminders() en
 * notify-plan-expiry.ts: Vercel Hobby tiene un tope duro de 2 cron jobs y vercel.json ya
 * usa las dos entradas disponibles.
 *
 * Reactivar dentro de los 30 días es manual, desde /admin → Cuentas (limpiar
 * profiles.deletion_requested_at) — no hay endpoint de autoservicio para eso, tal como
 * describe el texto legal ("contactando al soporte").
 */

import { getSupabaseAdminClient } from "@/lib/supabase/admin"

const DAY_MS = 24 * 60 * 60 * 1000
const GRACE_PERIOD_DAYS = 30

export async function runAccountDeletionPurge(): Promise<{ candidates: number; purged: number }> {
  const admin = getSupabaseAdminClient()
  const cutoff = new Date(Date.now() - GRACE_PERIOD_DAYS * DAY_MS)

  const { data: candidates, error } = await admin
    .from("profiles")
    .select("id")
    .not("deletion_requested_at", "is", null)
    .lte("deletion_requested_at", cutoff.toISOString())
  if (error) throw error

  let purged = 0
  for (const row of candidates ?? []) {
    // Único FK hacia auth.users sin "on delete cascade" (ver docs/71) — hay que
    // limpiarlo antes de deleteUser() o la llamada falla.
    const { error: teamCleanupError } = await admin.from("team_members").delete().eq("invited_user_id", row.id)
    if (teamCleanupError) {
      console.error("[purge-deleted-accounts] Error limpiando team_members.invited_user_id:", teamCleanupError)
      continue
    }

    const { error: deleteError } = await admin.auth.admin.deleteUser(row.id)
    if (deleteError) {
      console.error("[purge-deleted-accounts] Error purgando la cuenta:", deleteError)
      continue
    }
    purged++
  }

  return { candidates: candidates?.length ?? 0, purged }
}
