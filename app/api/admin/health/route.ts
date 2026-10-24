/**
 * Salud del sistema para /admin → Sistema (docs/195), SOLO LEYENDO:
 *  - configuración: qué variables están puestas (sí/no, nunca su valor) y si Stripe es real o de prueba;
 *  - base de datos: responde y en cuánto tiempo;
 *  - webhook de Stripe: dirección y eventos (lib/services/stripe-webhook-health.ts, docs/176);
 *  - tareas programadas: última ejecución de cada una y pasos fallidos (lib/services/cron-runs.ts);
 *  - correos: estado de los últimos enviados según Resend (entregado, rebotado, fallido…) y los
 *    que la app registró en los últimos 7 días.
 * Respuesta guardada 2 minutos por instancia; ?fresh=1 la vuelve a pedir.
 */

import { NextResponse } from "next/server"
import { Resend } from "resend"
import { hasAdminSession } from "@/lib/admin-auth"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { checkStripeWebhook, type WebhookHealthResult } from "@/lib/services/stripe-webhook-health"
import { CRON_EVENT_PREFIX, latestCronRuns } from "@/lib/services/cron-runs"
import { selectAll } from "@/lib/admin/select-all"

export const dynamic = "force-dynamic"

const TWO_MINUTES = 2 * 60 * 1000
const HOUR = 60 * 60 * 1000
// Tareas de vercel.json: ambas diarias; «atrasada» si pasaron más de 26 h.
const JOBS = [
  { job: "activation-emails", schedule: "14:00 UTC", maxGapHours: 26 },
  { job: "keep-alive", schedule: "08:00 UTC", maxGapHours: 26 },
]
const PROBLEM_EVENTS = new Set(["bounced", "failed", "complained", "suppressed", "delivery_delayed"])

let cache: { at: number; data: unknown } | null = null
let webhookCache: { at: number; result: WebhookHealthResult } | null = null

export async function GET(request: Request) {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 })
  }
  const fresh = new URL(request.url).searchParams.get("fresh") === "1"
  if (!fresh && cache && Date.now() - cache.at < TWO_MINUTES) return NextResponse.json(cache.data)

  const admin = getSupabaseAdminClient()
  const now = Date.now()

  const config = {
    stripeMode: (process.env.STRIPE_SECRET_KEY || "").startsWith("sk_live") ? "live" : process.env.STRIPE_SECRET_KEY ? "test" : "missing",
    items: [
      { key: "STRIPE_SECRET_KEY", set: Boolean(process.env.STRIPE_SECRET_KEY) },
      { key: "STRIPE_WEBHOOK_SECRET", set: Boolean(process.env.STRIPE_WEBHOOK_SECRET) },
      { key: "RESEND_API_KEY", set: Boolean(process.env.RESEND_API_KEY) },
      { key: "FEEDBACK_NOTIFY_TO", set: Boolean(process.env.FEEDBACK_NOTIFY_TO) },
      { key: "CRON_SECRET", set: Boolean(process.env.CRON_SECRET) },
      { key: "SUPABASE_SERVICE_ROLE_KEY", set: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY) },
      { key: "UNSUBSCRIBE_SECRET", set: Boolean(process.env.UNSUBSCRIBE_SECRET) },
      { key: "NEXT_PUBLIC_SITE_URL", set: Boolean(process.env.NEXT_PUBLIC_SITE_URL) },
    ],
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL || null,
  }

  // Base de datos
  let database: { ok: boolean; ms: number | null } = { ok: false, ms: null }
  try {
    const t0 = Date.now()
    const { error } = await admin.from("account_plans").select("account_id", { head: true, count: "exact" }).limit(1)
    database = { ok: !error, ms: Date.now() - t0 }
  } catch {
    database = { ok: false, ms: null }
  }

  // Webhook de Stripe (como mucho una consulta cada 10 minutos)
  let webhook: (WebhookHealthResult & { checkedAt: string }) | { error: string } = { error: "" }
  try {
    if (!webhookCache || now - webhookCache.at > 10 * 60 * 1000 || fresh) webhookCache = { at: now, result: await checkStripeWebhook() }
    webhook = { ...webhookCache.result, checkedAt: new Date(webhookCache.at).toISOString() }
  } catch (error) {
    console.error("[api/admin/health] webhook:", error)
    webhook = { error: "No se pudo revisar el webhook." }
  }

  // Tareas programadas
  let crons: { job: string; schedule: string; lastRunAt: string | null; ok: boolean | null; failedSteps: string[]; late: boolean }[] = []
  try {
    const { data } = await admin
      .from("product_events")
      .select("event_name, created_at")
      .like("event_name", `${CRON_EVENT_PREFIX}%`)
      .order("created_at", { ascending: false })
      .limit(100)
    const latest = latestCronRuns((data ?? []) as { event_name: string; created_at: string }[], JOBS.map((j) => j.job))
    crons = latest.map((r) => {
      const def = JOBS.find((j) => j.job === r.job)!
      return { ...r, schedule: def.schedule, late: r.lastRunAt ? now - new Date(r.lastRunAt).getTime() > def.maxGapHours * HOUR : false }
    })
  } catch (error) {
    console.error("[api/admin/health] crons:", error)
  }

  // Correos que registró la app (últimos 7 días)
  const since7d = new Date(now - 7 * 24 * HOUR).toISOString()
  const [activationSent, reengagementSent] = await Promise.all([
    selectAll<{ email_type: string; sent_at: string }>((from, to) =>
      admin.from("activation_emails_sent").select("email_type, sent_at").gte("sent_at", since7d).order("id").range(from, to),
    ),
    selectAll<{ email_type: string; sent_at: string }>((from, to) =>
      admin.from("reengagement_emails_sent").select("email_type, sent_at").gte("sent_at", since7d).order("sent_at").range(from, to),
    ),
  ])
  const appEmails = [...(activationSent.data ?? []), ...(reengagementSent.data ?? [])]
  const appEmailsByType = new Map<string, number>()
  for (const r of appEmails) appEmailsByType.set(r.email_type, (appEmailsByType.get(r.email_type) || 0) + 1)

  // Estado de los últimos correos en Resend. Una llave «solo enviar» no puede listar: se avisa.
  let provider:
    | { available: true; sampled: number; counts: Record<string, number>; last24h: number; problems: { to: string; subject: string; at: string; status: string }[] }
    | { available: false; reason: string } = { available: false, reason: "missing" }
  if (process.env.RESEND_API_KEY) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY)
      const rows: { id: string; to: string[] | string; subject: string; created_at: string; last_event: string }[] = []
      let listError: string | null = null
      let after: string | undefined
      for (let page = 0; page < 3; page++) {
        const res = await resend.emails.list(after ? { limit: 100, after } : { limit: 100 })
        if (res.error || !res.data) {
          listError = String(res.error?.message || "error")
          break
        }
        const pageRows = res.data.data as unknown as typeof rows
        rows.push(...pageRows)
        if (!res.data.has_more || pageRows.length === 0) break
        after = pageRows[pageRows.length - 1].id
      }
      if (listError && rows.length === 0) {
        provider = { available: false, reason: /restricted|permission|not allowed|sending/i.test(listError) ? "restricted_key" : "error" }
      } else {
        const counts: Record<string, number> = {}
        for (const r of rows) counts[r.last_event] = (counts[r.last_event] || 0) + 1
        provider = {
          available: true,
          sampled: rows.length,
          counts,
          last24h: rows.filter((r) => now - new Date(r.created_at).getTime() < 24 * HOUR).length,
          problems: rows
            .filter((r) => PROBLEM_EVENTS.has(r.last_event))
            .slice(0, 25)
            .map((r) => ({ to: Array.isArray(r.to) ? r.to.join(", ") : r.to, subject: r.subject, at: r.created_at, status: r.last_event })),
        }
      }
    } catch (error) {
      console.error("[api/admin/health] resend:", error)
      provider = { available: false, reason: "error" }
    }
  }

  const problems: string[] = []
  if (!database.ok) problems.push("database")
  if ("healthy" in webhook && webhook.configured && !webhook.healthy) problems.push("webhook")
  if ("error" in webhook && webhook.error) problems.push("webhook")
  for (const c of crons) if (c.ok === false || c.late) problems.push(`cron:${c.job}`)
  if (provider.available && provider.problems.length > 0) problems.push("emails")
  for (const i of config.items) if (!i.set) problems.push(`config:${i.key}`)

  const data = {
    checkedAt: new Date(now).toISOString(),
    problems,
    config,
    database,
    webhook,
    crons,
    appEmails: { total7d: appEmails.length, byType: [...appEmailsByType.entries()].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count) },
    provider,
  }
  cache = { at: now, data }
  return NextResponse.json(data)
}
