/**
 * Cron diario (Vercel Cron, ver vercel.json) que dispara los 3 correos de activación
 * por comportamiento pedidos en la crítica externa (docs/98, Parte 4.1 punto 7):
 *
 * 1. Recordatorio de primera receta — cuenta creada hace 3 días, todavía sin ninguna
 *    receta creada (activity_log: module="recetas", action="created").
 * 2. Chequeo de margen a los 7 días — cuenta creada hace 7 días, con al menos una
 *    receta creada (si a los 7 días no tiene ninguna receta, ya recibió el
 *    recordatorio del punto 1 — no tiene sentido "tu margen" sin ninguna receta).
 * 3. Refuerzo tras la primera venta — la primera fila de activity_log con
 *    module="estadisticas", action="imported" (ver components/manual-sales-entry-dialog.tsx)
 *    de esa cuenta ocurrió en las últimas 48 horas.
 *
 * Desde docs/133 los 4 correos de activación solo salen a cuentas con la casilla
 * «Novedades y recordatorios» activa (profiles.product_updates_opt_in, chequeado en
 * lib/services/notify-activation.ts antes de reservar el envío).
 *
 * Cada envío es idempotente por cuenta vía activation_emails_sent (unique
 * account_id+email_type, ver supabase/migrations/0020) — correr este cron más de una
 * vez el mismo día, o que Vercel reintente una ejecución, nunca duplica un correo.
 *
 * Mismo patrón de autenticación que app/api/cron/keep-alive/route.ts (CRON_SECRET,
 * validado solo si está configurada) y mismo patrón de paginación de listUsers() que
 * app/api/admin/accounts/route.ts.
 *
 * También corre acá (no en su propio cron) el recordatorio de vencimiento de plan
 * asignado a mano desde /admin (runPlanExpiryReminders(), ver
 * lib/services/notify-plan-expiry.ts) — Vercel Hobby (el plan real de este proyecto)
 * tiene un tope duro de 2 cron jobs y vercel.json ya usa las dos entradas disponibles,
 * así que ese chequeo se suma a este cron diario en vez de pedir una entrada nueva.
 *
 * 4. Encuesta de experiencia a las 4 horas de uso REAL (docs/117) —
 *    user_presence.total_active_seconds ≥ 14400 (tiempo activo real acumulado, ver
 *    supabase/migrations/0016_presence_time_tracking.sql, NO tiempo desde el
 *    registro). Misma idempotencia por activation_emails_sent que los otros 3.
 *
 * También corre acá, mismo motivo que el punto de vencimiento de plan de arriba
 * (Vercel Hobby, tope de 2 cron jobs), la purga real de cuentas que ya cumplieron los
 * 30 días de gracia tras pedir su eliminación (runAccountDeletionPurge(), ver
 * lib/services/purge-deleted-accounts.ts y docs/118).
 *
 * También corre acá (mismo motivo) el sistema de recordatorios / re-enganche de
 * docs/131 (runReengagementReminders(), ver lib/services/notify-reengagement.ts): un
 * correo según lo último que hizo cada cuenta que tenga activada la casilla de recibir
 * información. Con ?reengagementDryRun=1 no manda nada y devuelve qué se mandaría.
 *
 * docs/142: primero corre el resumen diario de cuentas nuevas al dueño
 * (sendDailySignupDigest, red de seguridad del aviso inmediato; ?digestDryRun=1 solo
 * cuenta, sin mandar). Cada paso corre aislado en su propio try: antes, un error en
 * cualquier paso cancelaba todos los siguientes (recordatorios incluidos).
 *
 * docs/144: los correos de valor (runEngagementEmails: resumen semanal, stock bajo,
 * margen, logros, invitación sin aceptar, negocio vacío, funciones sin usar) corren
 * antes de los recordatorios. ?engagementDryRun=1 muestra qué se mandaría.
 */

import { NextResponse } from "next/server"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import {
  sendFirstRecipeReminder,
  sendDay7MarginCheckin,
  sendFirstSaleReinforcement,
  sendFourHourExperienceSurvey,
} from "@/lib/services/notify-activation"
import { runPlanExpiryReminders, runExpiredPlanDowngrades } from "@/lib/services/notify-plan-expiry"
import { runAccountDeletionPurge } from "@/lib/services/purge-deleted-accounts"
import { runReengagementReminders, fetchAllPages } from "@/lib/services/notify-reengagement"
import { sendDailySignupDigest } from "@/lib/services/notify-signup"
import { runEngagementEmails } from "@/lib/services/notify-engagement"

// Muchos correos en serie con pausa entre envíos (lib/services/send-email.ts): se pide
// el máximo de Vercel Hobby para que la ejecución no se corte a la mitad.
export const maxDuration = 60

const FOUR_HOURS_IN_SECONDS = 4 * 60 * 60

const DAY_MS = 24 * 60 * 60 * 1000

function isWithinWindow(dateIso: string, minDaysAgo: number, maxDaysAgo: number): boolean {
  const ageMs = Date.now() - new Date(dateIso).getTime()
  return ageMs >= minDaysAgo * DAY_MS && ageMs < maxDaysAgo * DAY_MS
}

/** Corre un paso del cron sin dejar que su error cancele los demás. */
async function step<T>(name: string, fn: () => Promise<T>): Promise<T | { error: string }> {
  try {
    return await fn()
  } catch (error) {
    console.error(`[api/cron/activation-emails] Error en "${name}":`, error)
    return { error: `Error en ${name}.` }
  }
}

/** Un envío por cuenta: el error de una cuenta no corta el lote. */
async function sendEach(ids: string[], send: (id: string) => Promise<unknown>, name: string): Promise<number> {
  let count = 0
  for (const id of ids) {
    try {
      await send(id)
      count++
    } catch (error) {
      console.error(`[api/cron/activation-emails] Error en "${name}" para ${id}:`, error)
    }
  }
  return count
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = request.headers.get("authorization")
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 })
    }
  }
  const params = new URL(request.url).searchParams

  // Modo de prueba: solo calcula a quién le tocaría qué recordatorio, sin mandar nada
  // ni correr el resto del cron. Protegido por el mismo CRON_SECRET de arriba.
  if (params.get("reengagementDryRun") === "1") {
    try {
      return NextResponse.json({ ok: true, reengagement: await runReengagementReminders({ dryRun: true }) })
    } catch (error) {
      console.error("[api/cron/activation-emails] Error en dry run de recordatorios:", error)
      return NextResponse.json({ ok: false, error: "Error calculando recordatorios." }, { status: 500 })
    }
  }
  // Modo de prueba de los correos de valor (docs/144): qué recibiría cada cuenta, sin mandar.
  if (params.get("engagementDryRun") === "1") {
    return NextResponse.json({ ok: true, engagement: await step("correos de valor", () => runEngagementEmails({ dryRun: true })) })
  }
  // Modo de prueba del resumen diario: cuenta las cuentas nuevas de 24 h sin mandar nada.
  if (params.get("digestDryRun") === "1") {
    return NextResponse.json({ ok: true, signupDigest: await step("resumen de cuentas nuevas", () => sendDailySignupDigest({ dryRun: true })) })
  }

  // 1. Lo más importante para el dueño, primero y aislado.
  const signupDigest = await step("resumen de cuentas nuevas", () => sendDailySignupDigest())

  const activation = await step("correos de activación", async () => {
    const admin = getSupabaseAdminClient()

    let allUsers: { id: string; createdAt: string }[] = []
    let listPage = 1
    while (true) {
      const { data, error } = await admin.auth.admin.listUsers({ page: listPage, perPage: 200 })
      if (error) throw error
      allUsers = allUsers.concat(data.users.map((u) => ({ id: u.id, createdAt: u.created_at })))
      if (data.users.length < 200) break
      listPage += 1
    }

    const reminderCandidates = allUsers.filter((u) => isWithinWindow(u.createdAt, 3, 4))
    const day7Candidates = allUsers.filter((u) => isWithinWindow(u.createdAt, 7, 8))

    const { data: recipeCreatedRows, error: recipeError } = await admin
      .from("activity_log")
      .select("user_id")
      .eq("module", "recetas")
      .eq("action", "created")
    if (recipeError) throw recipeError
    const accountsWithRecipe = new Set((recipeCreatedRows ?? []).map((r) => r.user_id))

    const { data: saleRows, error: saleError } = await admin
      .from("activity_log")
      .select("user_id, created_at")
      .eq("module", "estadisticas")
      .eq("action", "imported")
      .order("created_at", { ascending: true })
    if (saleError) throw saleError
    const firstSaleAtByUser = new Map<string, string>()
    for (const row of saleRows ?? []) {
      if (!firstSaleAtByUser.has(row.user_id)) firstSaleAtByUser.set(row.user_id, row.created_at)
    }

    const reminderSent = await sendEach(
      reminderCandidates.filter((u) => !accountsWithRecipe.has(u.id)).map((u) => u.id),
      sendFirstRecipeReminder,
      "recordatorio de primera receta",
    )
    const day7Sent = await sendEach(
      day7Candidates.filter((u) => accountsWithRecipe.has(u.id)).map((u) => u.id),
      sendDay7MarginCheckin,
      "margen a los 7 días",
    )
    const firstSaleSent = await sendEach(
      [...firstSaleAtByUser.entries()].filter(([, at]) => isWithinWindow(at, 0, 2)).map(([id]) => id),
      sendFirstSaleReinforcement,
      "primera venta",
    )
    return {
      reminderCandidates: reminderCandidates.length,
      reminderSent,
      day7Candidates: day7Candidates.length,
      day7Sent,
      firstSaleSent,
    }
  })

  const planExpiry = await step("aviso de vencimiento de plan", () => runPlanExpiryReminders())
  // Planes asignados que ya vencieron: pasan a Foodie con correo y aviso (docs/139).
  const expiredDowngrades = await step("planes vencidos a Foodie", () => runExpiredPlanDowngrades())

  // Encuesta de experiencia (docs/145): antes solo a las 4 h de uso real, y el 75 % de las
  // cuentas no llega a 2 h — nadie la recibía. Ahora también con 3 recetas propias o 3
  // días distintos de uso, lo que pase primero. Sigue saliendo una sola vez por cuenta.
  const experienceSurvey = await step("encuesta de experiencia", async () => {
    const admin = getSupabaseAdminClient()
    // Paginado: recetas y actividad pasan de 1000 filas y PostgREST cortaría en silencio.
    const [presenceRows, recipeRows, dayRows] = await Promise.all([
      fetchAllPages<{ user_id: string }>((from, to) =>
        admin.from("user_presence").select("user_id").gte("total_active_seconds", FOUR_HOURS_IN_SECONDS).order("user_id").range(from, to),
      ),
      fetchAllPages<{ owner_id: string }>((from, to) =>
        admin.from("recipes").select("owner_id").eq("is_sub_recipe", false).order("id").range(from, to),
      ),
      fetchAllPages<{ user_id: string; created_at: string }>((from, to) =>
        admin.from("activity_log").select("user_id, created_at").order("created_at").range(from, to),
      ),
    ])
    const candidates = new Set(presenceRows.map((r) => r.user_id))
    const recipeCount = new Map<string, number>()
    for (const r of recipeRows) recipeCount.set(r.owner_id, (recipeCount.get(r.owner_id) ?? 0) + 1)
    for (const [id, n] of recipeCount) if (n >= 3) candidates.add(id)
    const days = new Map<string, Set<string>>()
    for (const r of dayRows) {
      const set = days.get(r.user_id) ?? new Set<string>()
      set.add(r.created_at.slice(0, 10))
      days.set(r.user_id, set)
    }
    for (const [id, set] of days) if (set.size >= 3) candidates.add(id)
    const ids = [...candidates]
    return { candidates: ids.length, sent: await sendEach(ids, sendFourHourExperienceSurvey, "encuesta de experiencia") }
  })

  const deletionPurge = await step("purga de cuentas eliminadas", () => runAccountDeletionPurge())
  // Correos de valor antes que los recordatorios: comparten la pausa global y, si a una
  // cuenta le toca uno útil (stock bajo, resumen, margen…), ese gana.
  const engagement = await step("correos de valor", () => runEngagementEmails())
  const reengagement = await step("recordatorios", () => runReengagementReminders())

  const steps = { signupDigest, activation, planExpiry, expiredDowngrades, experienceSurvey, deletionPurge, engagement, reengagement }
  const failed = Object.entries(steps)
    .filter(([, v]) => v && typeof v === "object" && "error" in v)
    .map(([k]) => k)
  return NextResponse.json({ ok: failed.length === 0, checkedAt: new Date().toISOString(), failed, ...steps })
}
