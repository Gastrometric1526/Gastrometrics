/**
 * /admin → centro de notificaciones (docs/267). Solo con sesión de admin y solo lectura.
 * Junta lo que pasó en los últimos NOTICES_WINDOW_DAYS días desde las tablas que ya existen:
 * mensajes del chat (de la persona, no del bot ni del dueño), mensajes del buzón y
 * calificaciones, respuestas a preguntas cortas, cuentas que confirmaron su correo y cambios
 * de plan. Si una fuente falla, las demás salen igual.
 */

import { NextResponse } from "next/server"
import { hasAdminSession } from "@/lib/admin-auth"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { confirmedAt } from "@/lib/admin/confirmed-accounts"
import { getPlanBySlug } from "@/lib/plans"
import { mergeNotices, NOTICE_TARGET, NOTICES_WINDOW_DAYS, shortText, type AdminNotice } from "@/lib/admin/notifications"

export const dynamic = "force-dynamic"

const PER_SOURCE = 40

async function safe<T>(label: string, run: () => Promise<T[]>): Promise<T[]> {
  try {
    return await run()
  } catch (error) {
    console.error(`[admin/notifications] ${label}:`, error)
    return []
  }
}

export async function GET() {
  if (!(await hasAdminSession())) return NextResponse.json({ error: "No autorizado." }, { status: 401 })
  const admin = getSupabaseAdminClient()
  const since = new Date(Date.now() - NOTICES_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()

  // Correos y nombres de Auth: se leen una vez y sirven para el chat y las cuentas nuevas.
  const users: { id: string; email?: string | null; created_at?: string; email_confirmed_at?: string | null; confirmed_at?: string | null; user_metadata?: Record<string, unknown> }[] = []
  for (let page = 1; page <= 25; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error || !data) break
    users.push(...(data.users as typeof users))
    if (data.users.length < 200) break
  }
  const emailById = new Map(users.filter((u) => u.email).map((u) => [u.id, u.email as string]))

  const [chat, messages, surveys, plans] = await Promise.all([
    safe<AdminNotice>("chat", async () => {
      const { data, error } = await admin
        .from("support_messages")
        .select("id, conversation_id, body, attachments, created_at")
        .eq("sender", "user")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(PER_SOURCE)
      if (error) throw error
      const rows = (data ?? []) as { id: string; conversation_id: string; body: string; attachments: unknown[] | null; created_at: string }[]
      const ids = [...new Set(rows.map((r) => r.conversation_id))]
      const owner = new Map<string, string>()
      if (ids.length) {
        const { data: convs } = await admin.from("support_conversations").select("id, account_id").in("id", ids)
        for (const c of (convs ?? []) as { id: string; account_id: string }[]) owner.set(c.id, c.account_id)
      }
      return rows.map((r) => {
        const account = owner.get(r.conversation_id)
        const hasFiles = Array.isArray(r.attachments) && r.attachments.length > 0
        return {
          id: `chat:${r.id}`,
          kind: "chat" as const,
          who: (account && emailById.get(account)) || null,
          text: shortText(r.body) || (hasFiles ? "📎" : ""),
          at: r.created_at,
          ...NOTICE_TARGET.chat,
        }
      })
    }),
    safe<AdminNotice>("feedback", async () => {
      const { data, error } = await admin
        .from("feedback")
        .select("id, type, message, user_name, user_email, created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(PER_SOURCE)
      if (error) throw error
      return ((data ?? []) as { id: string; type: string; message: string; user_name: string | null; user_email: string | null; created_at: string }[]).map((r) => {
        const kind = r.type === "experiencia" ? ("rating" as const) : ("message" as const)
        return {
          id: `feedback:${r.id}`,
          kind,
          who: r.user_name || r.user_email || null,
          text: shortText(r.message),
          detail: r.type,
          at: r.created_at,
          ...NOTICE_TARGET[kind],
        }
      })
    }),
    safe<AdminNotice>("encuesta", async () => {
      const { data, error } = await admin
        .from("activity_log")
        .select("id, user_id, user_name, metadata, created_at")
        .eq("module", "encuesta")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(PER_SOURCE)
      if (error) throw error
      return ((data ?? []) as unknown as { id: number; user_id: string; user_name: string | null; metadata: Record<string, unknown> | null; created_at: string }[]).map((r) => {
        const m = r.metadata || {}
        return {
          id: `survey:${r.id}`,
          kind: "survey" as const,
          who: r.user_name || emailById.get(r.user_id) || null,
          // La opción y la pregunta van como claves; la pantalla las traduce.
          answer: typeof m.answer === "string" ? m.answer : null,
          text: shortText(typeof m.detail === "string" ? m.detail : ""),
          detail: typeof m.question === "string" ? m.question : null,
          at: r.created_at,
          ...NOTICE_TARGET.survey,
        }
      })
    }),
    safe<AdminNotice>("plan", async () => {
      const { data, error } = await admin
        .from("activity_log")
        .select("id, user_id, user_name, entity_label, metadata, created_at")
        .eq("module", "plan")
        .eq("action", "plan_changed")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(PER_SOURCE)
      if (error) throw error
      return ((data ?? []) as unknown as { id: number; user_id: string; user_name: string | null; entity_label: string | null; metadata: Record<string, unknown> | null; created_at: string }[]).map((r) => {
        const m = r.metadata || {}
        // Nombre del plan (Foodie, Chef Ejecutivo…), no la clave interna.
        const name = (slug: string): string => (slug ? getPlanBySlug(slug).name : "")
        const to = name((typeof m.to === "string" && m.to) || r.entity_label || "")
        const from = typeof m.from === "string" && m.from ? name(m.from) : ""
        return {
          id: `plan:${r.id}`,
          kind: "plan" as const,
          who: emailById.get(r.user_id) || r.user_name || null,
          text: from ? `${from} → ${to}` : to,
          at: r.created_at,
          ...NOTICE_TARGET.plan,
        }
      })
    }),
  ])

  const sinceMs = Date.parse(since)
  const signups: AdminNotice[] = users
    .map((u) => ({ u, at: confirmedAt(u) }))
    .filter((x): x is { u: (typeof users)[number]; at: string } => !!x.at && Date.parse(x.at) >= sinceMs)
    .map(({ u, at }) => {
      const name = typeof u.user_metadata?.full_name === "string" ? (u.user_metadata.full_name as string) : null
      return { id: `signup:${u.id}`, kind: "signup" as const, who: u.email || null, text: name || "", at, ...NOTICE_TARGET.signup }
    })

  return NextResponse.json({ notices: mergeNotices([chat, messages, surveys, plans, signups]) })
}
