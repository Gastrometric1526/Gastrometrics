/**
 * Clics desde correos (docs/145): por cada tipo de correo automático, cuántos se
 * enviaron y cuántas cuentas distintas entraron a la app desde ese correo, en los
 * últimos 90 días, más los últimos clics con su cuenta. Fuentes: activation_emails_sent,
 * reengagement_emails_sent y engagement_emails_sent (envíos) y engagement_emails_sent
 * con email_type "click:<tipo>" (clics, ver lib/email-tracking.ts).
 *
 * Los correos de novedades, cambio de plan y vencimiento no tienen tabla de envíos: de
 * esos se muestran solo los clics.
 *
 * Resumen (docs/210, «cuántas personas volvieron vía los correos»): personas distintas que
 * recibieron algún correo, personas distintas que entraron desde uno, y de esas cuántas
 * llevaban 7 días sin usar la app y cuántas hicieron algo en los 7 días siguientes
 * (activity_log). Ver lib/email-returns.ts.
 */

import { NextResponse } from "next/server"
import { hasAdminSession } from "@/lib/admin-auth"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { CLICK_PREFIX, isClickRow } from "@/lib/email-tracking"
import { fetchAllPages } from "@/lib/services/notify-reengagement"
import { summarizeEmailReturns } from "@/lib/email-returns"

const DAYS = 90

export async function GET() {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 })
  }
  try {
    const admin = getSupabaseAdminClient()
    const since = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000).toISOString()
    // Paginado: con más de 1000 envíos en 90 días, PostgREST cortaría en silencio.
    const [activation, reengagement, engagementRows] = await Promise.all([
      fetchAllPages<{ account_id: string; email_type: string }>((from, to) =>
        admin.from("activation_emails_sent").select("account_id, email_type").gte("sent_at", since).order("sent_at").range(from, to),
      ),
      fetchAllPages<{ account_id: string; email_type: string }>((from, to) =>
        admin.from("reengagement_emails_sent").select("account_id, email_type").gte("sent_at", since).order("sent_at").range(from, to),
      ),
      fetchAllPages<{ account_id: string; email_type: string; sent_at: string }>((from, to) =>
        admin
          .from("engagement_emails_sent")
          .select("account_id, email_type, sent_at")
          .gte("sent_at", since)
          .order("sent_at", { ascending: false })
          .range(from, to),
      ),
    ])

    const sent = new Map<string, number>()
    const recipients = new Set<string>()
    const firstClick = new Map<string, string>()
    const add = (type: string, accountId: string) => {
      sent.set(type, (sent.get(type) ?? 0) + 1)
      recipients.add(accountId)
    }
    for (const r of activation) add(r.email_type, r.account_id)
    for (const r of reengagement) add(r.email_type, r.account_id)
    const clicks = new Map<string, Set<string>>()
    const recent: { accountId: string; campaign: string; at: string }[] = []
    for (const r of engagementRows) {
      if (isClickRow(r.email_type)) {
        const campaign = r.email_type.slice(CLICK_PREFIX.length)
        const set = clicks.get(campaign) ?? new Set<string>()
        set.add(r.account_id)
        clicks.set(campaign, set)
        if (recent.length < 30) recent.push({ accountId: r.account_id, campaign, at: r.sent_at })
        // Filas de la más nueva a la más vieja: la última que se ve de cada cuenta es su primer clic.
        firstClick.set(r.account_id, r.sent_at)
      } else {
        add(r.email_type, r.account_id)
      }
    }

    // Actividad de quienes entraron desde un correo, desde 7 días antes del periodo.
    const activitySince = new Date(Date.parse(since) - 7 * 24 * 60 * 60 * 1000).toISOString()
    const clickedIds = [...firstClick.keys()]
    const activity: { user_id: string; created_at: string }[] = []
    for (let i = 0; i < clickedIds.length; i += 100) {
      const ids = clickedIds.slice(i, i + 100)
      activity.push(
        ...(await fetchAllPages<{ user_id: string; created_at: string }>((from, to) =>
          admin
            .from("activity_log")
            .select("user_id, created_at")
            .in("user_id", ids)
            .gte("created_at", activitySince)
            .order("created_at")
            .range(from, to),
        )),
      )
    }
    const summary = summarizeEmailReturns({ recipients, firstClick, activity, now: Date.now() })

    const emailById = new Map<string, string>()
    if (recent.length) {
      for (let page = 1; ; page++) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
        if (error) throw error
        for (const u of data.users) if (u.email) emailById.set(u.id, u.email)
        if (data.users.length < 200) break
      }
    }

    const types = new Set([...sent.keys(), ...clicks.keys()])
    const rows = [...types]
      .map((type) => {
        const s = sent.get(type) ?? null
        const c = clicks.get(type)?.size ?? 0
        return { type, sent: s, clickedAccounts: c, ratePercent: s ? Math.round((c / s) * 1000) / 10 : null }
      })
      .sort((a, b) => (b.sent ?? 0) - (a.sent ?? 0) || b.clickedAccounts - a.clickedAccounts)

    return NextResponse.json({
      days: DAYS,
      summary,
      rows,
      recent: recent.map((r) => ({ email: emailById.get(r.accountId) ?? "—", campaign: r.campaign, at: r.at })),
    })
  } catch (error) {
    console.error("[api/admin/email-clicks] Error:", error)
    return NextResponse.json({ error: "No se pudo calcular." }, { status: 500 })
  }
}
