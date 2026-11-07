/**
 * Ping silencioso a Supabase — pedido explícito del dueño del proyecto: el proyecto
 * está en el plan Free de Supabase, que pausa automáticamente cualquier proyecto sin
 * ninguna petición a su API durante 7 días seguidos (ver
 * docs/referencia-manual-de-operaciones.md sección 2.3 y 7.11). Con Stripe ya en modo
 * Live cobrando dinero real, una pausa silenciosa de la base de datos significaría que
 * nadie puede iniciar sesión ni que el webhook de pagos pueda aplicar ningún plan. Este
 * endpoint no hace nada más que una lectura mínima y sin costo (cuenta de filas de
 * account_plans, sin traer ningún dato) — solo existe para que Supabase vea actividad
 * real cada pocos días. Programado en vercel.json (Vercel Cron, gratis en cualquier
 * plan de Vercel).
 *
 * Seguridad: si CRON_SECRET está configurada en Vercel, Vercel la manda sola como
 * header Authorization en cada invocación programada (comportamiento nativo de Vercel
 * Cron) y se valida aquí. Si todavía no está configurada, el endpoint sigue funcionando
 * igual — no bloquea el primer despliegue — protegido de todas formas por el mismo
 * límite de intentos que el resto de rutas públicas del proyecto (lib/rate-limit.ts),
 * ya que no expone ni modifica ningún dato real.
 */

import { recordCronRun } from "@/lib/services/cron-runs"
import { NextResponse } from "next/server"
import { isAuthorizedCronRequest } from "@/lib/cron-auth"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { checkRateLimit, getClientIp } from "@/lib/rate-limit"
import { pruneAllSnapshots, runDailySnapshots } from "@/lib/services/account-snapshots"

export const maxDuration = 60

export async function GET(request: Request) {
  if (!(await isAuthorizedCronRequest(request))) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 })
  }

  const rateLimit = checkRateLimit(`cron-keep-alive:${getClientIp(request)}`, {
    maxAttempts: 10,
    windowMs: 60 * 60 * 1000,
    lockoutMs: 60 * 60 * 1000,
  })
  if (!rateLimit.allowed) {
    return NextResponse.json({ ok: false }, { status: 429 })
  }

  try {
    const admin = getSupabaseAdminClient()
    const { error } = await admin
      .from("account_plans")
      .select("account_id", { head: true, count: "exact" })
      .limit(1)
    if (error) throw error
    // Respaldos diarios de las cuentas activas (docs/229). Va en este mismo cron para no
    // sumar otra tarea programada; si falla, el ping igual cuenta como hecho.
    let backups: Awaited<ReturnType<typeof runDailySnapshots>> | null = null
    try {
      backups = await runDailySnapshots()
    } catch (backupError) {
      console.error("[api/cron/keep-alive] Error en los respaldos diarios:", backupError)
    }
    // Retención de 3 a 6 meses, también para las cuentas eliminadas (docs/252).
    let pruned: Awaited<ReturnType<typeof pruneAllSnapshots>> | null = null
    try {
      pruned = await pruneAllSnapshots()
    } catch (backupError) {
      console.error("[api/cron/keep-alive] Error en los respaldos diarios:", backupError)
    }
    await recordCronRun("keep-alive", backups && backups.failed === 0 ? [] : ["backups"])
    return NextResponse.json({ ok: true, pingedAt: new Date().toISOString(), backups, pruned })
  } catch (error) {
    console.error("[api/cron/keep-alive] Error haciendo ping a Supabase:", error)
    await recordCronRun("keep-alive", ["ping"])
    return NextResponse.json({ ok: false, error: "Error al conectar con Supabase." }, { status: 500 })
  }
}
