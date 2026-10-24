/**
 * Registro de cada ejecución de las tareas programadas (docs/195), para que /admin → Sistema
 * diga cuándo corrió cada una por última vez y si falló algún paso. Sin migración: una fila
 * en product_events con event_name «cron:<tarea>:ok» o «cron:<tarea>:fail:<pasos>».
 * Nunca rompe la tarea si el registro falla.
 */
import { getSupabaseAdminClient } from "@/lib/supabase/admin"

export const CRON_EVENT_PREFIX = "cron:"

/** Eventos internos de product_events que no son del embudo de producto. */
export function isInternalProductEvent(name: string): boolean {
  return name.startsWith(CRON_EVENT_PREFIX) || name === "review_published" || name === "feedback_archived" || name === "business_created_notified"
}

export async function recordCronRun(job: string, failedSteps: string[] = []): Promise<void> {
  try {
    const status = failedSteps.length === 0 ? "ok" : `fail:${failedSteps.join(",")}`
    await getSupabaseAdminClient().from("product_events").insert({ event_name: `${CRON_EVENT_PREFIX}${job}:${status}` } as never) // product_events no está en types/database.ts
  } catch (error) {
    console.error("[cron-runs] No se pudo registrar la ejecución:", error)
  }
}

export interface CronRunInfo {
  job: string
  lastRunAt: string | null
  ok: boolean | null
  failedSteps: string[]
}

/** Interpreta las filas «cron:…» (la más nueva primero) en la última ejecución por tarea. */
export function latestCronRuns(rows: { event_name: string; created_at: string }[], jobs: string[]): CronRunInfo[] {
  return jobs.map((job) => {
    const row = rows.find((r) => r.event_name.startsWith(`${CRON_EVENT_PREFIX}${job}:`))
    if (!row) return { job, lastRunAt: null, ok: null, failedSteps: [] }
    const status = row.event_name.slice(`${CRON_EVENT_PREFIX}${job}:`.length)
    return {
      job,
      lastRunAt: row.created_at,
      ok: status === "ok",
      failedSteps: status.startsWith("fail:") ? status.slice(5).split(",").filter(Boolean) : [],
    }
  })
}
