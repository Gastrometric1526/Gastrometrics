/**
 * Formateo compartido entre components/admin/accounts-panel.tsx y
 * components/admin/stats-panel.tsx — país (a partir de profiles.nationality, mismo
 * código de país que ya usa el selector de registro) y tiempo activo acumulado (a
 * partir de user_presence.total_active_seconds, ver
 * supabase/migrations/0016_presence_time_tracking.sql). Extraído a un archivo propio
 * en vez de duplicarlo en los dos paneles, ver docs/78.
 */

import { COUNTRIES } from "@/lib/types/user"

/** Formatea segundos acumulados a algo legible ("3h 20m", "45m", "<1 min"). */
export function formatActiveTime(totalSeconds: number, t: (key: any) => string): string {
  const totalMinutes = Math.floor(totalSeconds / 60)
  if (totalMinutes < 1) return t("admin_accounts_time_under_minute")
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours > 0) {
    return t("admin_accounts_time_format_hm").replace("{h}", String(hours)).replace("{m}", String(minutes))
  }
  return t("admin_accounts_time_format_m").replace("{m}", String(minutes))
}

/** Nombre legible de un código de país (el mismo COUNTRIES que usa el registro), o null si no hay código. */
export function countryName(code: string | null): string | null {
  if (!code) return null
  return COUNTRIES.find((c) => c.code === code)?.name || code
}
