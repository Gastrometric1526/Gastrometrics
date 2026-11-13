/**
 * Aviso de cambio de plan pendiente de mostrar como popup en el dashboard (docs/89).
 * Se llama servidor-a-servidor desde los 3 lugares donde el plan de una cuenta puede
 * cambiar: el webhook de Stripe (app/api/webhooks/stripe/route.ts, dos ramas) y el
 * panel de admin (app/api/admin/account-plan/route.ts). Un solo "casillero" por
 * cuenta (account_plans.last_change_*, ver supabase/migrations/0018_plan_change_
 * notice.sql) — no un historial: cada llamada sobreescribe el aviso anterior y lo
 * marca sin confirmar; el popup lo apaga en cuanto el usuario lo cierra
 * (app/api/plan/change-notice/route.ts).
 */

import { getSupabaseAdminClient } from "@/lib/supabase/admin"

export async function recordPlanChangeNotice(input: {
  accountId: string
  fromPlanSlug: string
  toPlanSlug: string
  amountCents: number | null
  nextChargeUnixSeconds: number | null
  expiresAtUnixSeconds: number | null
  source: "stripe" | "admin" | "expired"
  /**
   * De dónde vino el cambio, para el historial de /admin (docs/301): «admin», «founder»,
   * «referral», «scheduled», «stripe», «expired»… `source` sigue siendo lo que lee el
   * popup y el correo; esto es solo para saber qué pasó.
   */
  origin?: PlanOrigin
  /** Quién lo hizo desde /admin (correo), si se sabe. */
  by?: string | null
}): Promise<void> {
  if (input.fromPlanSlug === input.toPlanSlug) return // sin cambio real, nada que avisar

  const admin = getSupabaseAdminClient()
  const { error } = await admin
    .from("account_plans")
    .update({
      last_change_from_plan: input.fromPlanSlug,
      last_change_to_plan: input.toPlanSlug,
      last_change_amount_cents: input.amountCents,
      last_change_next_charge_at: input.nextChargeUnixSeconds
        ? new Date(input.nextChargeUnixSeconds * 1000).toISOString()
        : null,
      last_change_expires_at: input.expiresAtUnixSeconds
        ? new Date(input.expiresAtUnixSeconds * 1000).toISOString()
        : null,
      last_change_source: input.source,
      last_change_at: new Date().toISOString(),
      last_change_acknowledged: false,
    })
    .eq("account_id", input.accountId)

  // Tolera que supabase/migrations/0018_plan_change_notice.sql todavía no se haya
  // corrido (columnas nuevas) — el plan real ya quedó aplicado por el caller antes de
  // esta llamada en los 3 casos, así que un error acá nunca debe impedir eso; el
  // popup simplemente no tendrá nada que mostrar hasta que se corra la migración.
  if (error) console.error("[plan-change-notice] Error guardando el aviso de cambio de plan:", error)

  // También queda en "Notificaciones" del Dashboard (docs/157), aunque la persona todavía
  // no haya abierto la app: el popup se ve una vez y se cierra, esto queda en la lista.
  // business_id null = evento de cuenta (getActivityLog lo trae con includeGlobalForUserId).
  const { error: logError } = await admin.from("activity_log").insert({
    business_id: null,
    user_id: input.accountId,
    user_name: "Gastrometrics",
    module: "plan",
    action: "plan_changed",
    entity_label: input.toPlanSlug,
    metadata: {
      from: input.fromPlanSlug,
      to: input.toPlanSlug,
      source: input.source,
      origin: input.origin ?? input.source,
      by: input.by ?? null,
      amount_cents: input.amountCents,
      expires_at: input.expiresAtUnixSeconds ? new Date(input.expiresAtUnixSeconds * 1000).toISOString() : null,
    },
    is_notification: true,
  })
  if (logError) console.error("[plan-change-notice] Error guardando la notificación de cambio de plan:", logError)
}

export type PlanOrigin = "admin" | "founder" | "referral" | "scheduled" | "stripe" | "stripe_cancel" | "expired" | "self" | "tester"

/**
 * Historial de plan para /admin (pedido del dueño, docs/301: «debo poder ver todos los cambios
 * de planes de cada usuario»). Para lo que `recordPlanChangeNotice` no registra porque no avisa
 * a la persona: cancelaciones de Stripe, pasar a Foodie uno mismo, testers, cancelación
 * programada o quitada y extensiones del vencimiento. Misma tabla y misma acción
 * (`activity_log`, «plan_changed»), sin notificación. Nunca lanza.
 */
export async function logPlanHistory(input: {
  accountId: string
  from: string | null
  to: string | null
  origin: PlanOrigin
  /** «changed» (por defecto), «cancel_scheduled», «cancel_undone» o «extended». */
  kind?: "changed" | "cancel_scheduled" | "cancel_undone" | "extended"
  /** Fecha relevante: fin del período pagado o nuevo vencimiento. */
  until?: string | null
  by?: string | null
}): Promise<void> {
  const kind = input.kind ?? "changed"
  if (kind === "changed" && input.from === input.to) return
  try {
    const { error } = await getSupabaseAdminClient().from("activity_log").insert({
      business_id: null,
      user_id: input.accountId,
      user_name: "Gastrometrics",
      module: "plan",
      action: "plan_changed",
      entity_label: input.to,
      metadata: { from: input.from, to: input.to, source: input.origin, origin: input.origin, kind, until: input.until ?? null, by: input.by ?? null },
      is_notification: false,
    })
    if (error) console.error("[plan-history] No se pudo guardar:", error)
  } catch (error) {
    console.error("[plan-history] No se pudo guardar:", error)
  }
}
