/**
 * Manda el aviso de actividad de una persona a los aparatos de /admin (docs/248, docs/295).
 * Lo usan /api/notify/activity (acciones del navegador) y las rutas del servidor que ya saben
 * quién es la persona (manual, borrar la cuenta, vaciar el contenido).
 *
 * Revisa la lista de acciones, salta al dueño del proyecto, aplica el tope por persona y
 * comprueba que el negocio sea de la persona. El nombre del negocio y el de la persona salen
 * de la base, nunca del navegador. Nunca lanza.
 */

import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { checkRateLimit } from "@/lib/rate-limit"
import { sendAdminPush } from "@/lib/services/admin-push"
import { activityPushText, isOwnerEmail, isPushActivity, pushLimit } from "@/lib/services/activity-push"
import { adminAccountUrl } from "@/lib/admin/open-account"

export type ActivityPushResult =
  | { ok: true; sent?: number; skipped?: "dueño" | "tope" }
  | { ok: false; status: 400 | 404 | 500 }

export async function sendActivityPush(input: {
  user: { id: string; email?: string | null }
  module: string
  action: string
  businessId?: string | null
  count?: number | null
  label?: string | null
  kind?: string | null
}): Promise<ActivityPushResult> {
  const { user, module: area, action } = input
  if (!isPushActivity(area, action)) return { ok: false, status: 400 }
  if (isOwnerEmail(user.email, process.env.FEEDBACK_NOTIFY_TO)) return { ok: true, skipped: "dueño" }

  // Tope por persona, módulo y acción, para que una sesión muy activa no llene el celular.
  const { max, minutes } = pushLimit(area, action)
  const limit = checkRateLimit(`activity-push:${user.id}:${area}:${action}`, {
    maxAttempts: max,
    windowMs: minutes * 60 * 1000,
    lockoutMs: minutes * 60 * 1000,
  })
  if (!limit.allowed) return { ok: true, skipped: "tope" }

  try {
    const admin = getSupabaseAdminClient()
    const businessId = input.businessId && input.businessId !== "main" ? input.businessId : null
    let businessName: string | null = null
    if (businessId) {
      const [{ data: business }, { data: member }] = await Promise.all([
        admin.from("businesses").select("name, owner_id").eq("id", businessId).maybeSingle(),
        admin.from("business_members").select("user_id").eq("business_id", businessId).eq("user_id", user.id).maybeSingle(),
      ])
      if (!business || (business.owner_id !== user.id && !member)) return { ok: false, status: 404 }
      businessName = business.name
    }
    const { data: profile } = await admin.from("profiles").select("full_name").eq("id", user.id).maybeSingle()
    const who = [profile?.full_name, user.email].filter(Boolean).join(" · ")
    const sent = await sendAdminPush({
      ...activityPushText({ module: area, action, who, businessName, count: input.count, label: input.label, kind: input.kind }),
      url: adminAccountUrl({ userId: user.id }),
    })
    return { ok: true, sent }
  } catch (error) {
    console.error("[activity-push] Error:", error)
    return { ok: false, status: 500 }
  }
}
