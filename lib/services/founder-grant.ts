/**
 * Programa automático "100 cocinas fundadoras" (docs/158), parte con base de datos. La
 * decisión (quién, cuándo) es pura y vive en lib/founder-program.ts.
 *
 * - La posición de la cuenta sale de profiles.created_at (la fila se crea al registrarse):
 *   cuenta todas las cuentas, también las que ya existían antes del programa.
 * - "Una sola vez" se guarda en app_metadata.founder_grant del usuario (Supabase Auth),
 *   sin migración nueva. Se marca ANTES de cambiar el plan, así dos llamadas a la vez
 *   (la del Dashboard y la del cron) no mandan dos correos.
 * - El cambio de plan es el mismo que hace /admin (account_plans + correo de cambio de
 *   plan + aviso del Dashboard), así que se ve y se puede deshacer desde /admin igual.
 */

import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { FOUNDER_PROGRAM, founderDecision, type FounderDecision } from "@/lib/founder-program"
import { sendPlanChangedEmail } from "@/lib/services/notify-billing"
import { recordPlanChangeNotice } from "@/lib/services/plan-change-notice"
import { sendOwnerNotification, hondurasTime } from "@/lib/services/notify-owner"

export type FounderGrantResult = FounderDecision & { ordinal?: number; planSlug?: string }

async function accountOrdinal(createdAt: string): Promise<number | null> {
  const admin = getSupabaseAdminClient()
  const { count, error } = await admin.from("profiles").select("id", { count: "exact", head: true }).lte("created_at", createdAt)
  if (error) {
    console.error("[founder-grant] No se pudo contar las cuentas:", error)
    return null
  }
  return count ?? null
}

export async function runFounderGrant(accountId: string, now = Date.now()): Promise<FounderGrantResult> {
  const admin = getSupabaseAdminClient()
  const [{ data: authData, error: authError }, { data: profile }, { data: planRow }] = await Promise.all([
    admin.auth.admin.getUserById(accountId),
    admin.from("profiles").select("created_at, full_name").eq("id", accountId).maybeSingle(),
    admin.from("account_plans").select("plan_slug, stripe_subscription_id").eq("account_id", accountId).maybeSingle(),
  ])
  const authUser = authData?.user
  if (authError || !authUser) return { action: "skip", reason: "before_program" }
  const createdAt = profile?.created_at || authUser.created_at
  const ordinal = await accountOrdinal(createdAt)
  if (ordinal === null) return { action: "wait", waitMs: 60_000 }

  const decision = founderDecision({
    accountCreatedAt: createdAt,
    ordinal,
    now,
    alreadyGranted: Boolean((authUser.app_metadata as Record<string, unknown> | undefined)?.founder_grant),
    currentPlanSlug: planRow?.plan_slug ?? null,
    hasStripeSubscription: Boolean(planRow?.stripe_subscription_id),
  })
  if (decision.action !== "grant") return { ...decision, ordinal }

  // 1) Marca "ya se dio" primero (evita doble correo si llegan dos llamadas a la vez).
  const { error: markError } = await admin.auth.admin.updateUserById(accountId, {
    app_metadata: { ...(authUser.app_metadata || {}), founder_grant: { at: new Date(now).toISOString(), ordinal } },
  })
  if (markError) {
    console.error("[founder-grant] No se pudo marcar la cuenta:", markError)
    return { action: "wait", waitMs: 60_000, ordinal }
  }

  // 2) Plan, igual que /admin (sin tocar los negocios/cupos extra).
  const previousPlanSlug = planRow?.plan_slug || "foodie"
  const { error: planError } = await admin.from("account_plans").upsert({
    account_id: accountId,
    plan_slug: FOUNDER_PROGRAM.planSlug,
    plan_expires_at: decision.expiresAt,
    updated_at: new Date(now).toISOString(),
  })
  if (planError) {
    console.error("[founder-grant] No se pudo aplicar el plan:", planError)
    // Se desmarca para que el próximo intento lo vuelva a probar.
    await admin.auth.admin.updateUserById(accountId, { app_metadata: { ...(authUser.app_metadata || {}), founder_grant: null } })
    return { action: "wait", waitMs: 60_000, ordinal }
  }

  // 3) Avisos (best-effort: el plan ya quedó aplicado).
  const expiresAtUnixSeconds = Math.floor(new Date(decision.expiresAt).getTime() / 1000)
  try {
    await sendPlanChangedEmail({
      accountId,
      fromPlanSlug: previousPlanSlug,
      toPlanSlug: FOUNDER_PROGRAM.planSlug,
      nextChargeUnixSeconds: null,
      nextChargeAmountCents: null,
      expiresAtUnixSeconds,
      source: "admin",
    })
  } catch (error) {
    console.error("[founder-grant] Error mandando el correo de cambio de plan:", error)
  }
  await recordPlanChangeNotice({
    accountId,
    fromPlanSlug: previousPlanSlug,
    toPlanSlug: FOUNDER_PROGRAM.planSlug,
    amountCents: null,
    nextChargeUnixSeconds: null,
    expiresAtUnixSeconds,
    source: "admin",
  })
  await sendOwnerNotification({
    subject: `Cocina fundadora #${ordinal} de ${FOUNDER_PROGRAM.maxAccounts}: Chef Ejecutivo por 1 mes`,
    rows: [
      ["Cuenta", authUser.email],
      ["Nombre", profile?.full_name],
      ["Posición", `${ordinal} de ${FOUNDER_PROGRAM.maxAccounts}`],
      ["Plan", `Chef Ejecutivo (antes: ${previousPlanSlug})`],
      ["Vence", hondurasTime(decision.expiresAt)],
      ["Quedan", `${Math.max(FOUNDER_PROGRAM.maxAccounts - ordinal, 0)} lugares`],
    ],
    footnote: "Asignado automáticamente por el programa de 100 cocinas fundadoras. Se puede cambiar o quitar en Cuentas y planes.",
    label: "fundadora automática",
  })

  return { ...decision, ordinal, planSlug: FOUNDER_PROGRAM.planSlug }
}

/**
 * Respaldo del cron diario: cuentas del programa que no abrieron la app después del
 * minuto (la activación normal la dispara el Dashboard). Idempotente.
 */
export async function runPendingFounderGrants(now = Date.now()): Promise<{ checked: number; granted: number }> {
  const admin = getSupabaseAdminClient()
  const { data, error } = await admin
    .from("profiles")
    .select("id, created_at")
    .gte("created_at", new Date(FOUNDER_PROGRAM.startsAt).toISOString())
    .lte("created_at", new Date(now - FOUNDER_PROGRAM.delayMs).toISOString())
    .order("created_at", { ascending: true })
    .limit(FOUNDER_PROGRAM.maxAccounts)
  if (error) throw error
  let granted = 0
  for (const row of data ?? []) {
    const result = await runFounderGrant(row.id, now)
    if (result.action === "grant") granted++
    if (result.action === "skip" && result.reason === "over_limit") break
  }
  return { checked: data?.length ?? 0, granted }
}
