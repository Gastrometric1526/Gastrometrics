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
  source: "stripe" | "admin"
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
}
