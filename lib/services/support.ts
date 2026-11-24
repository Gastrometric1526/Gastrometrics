/**
 * Chat de soporte (docs/204), parte con base de datos (supabase/migrations/0034_support_chat.sql).
 * Lo usan las rutas app/api/support/* (la persona, con su sesión) y app/api/admin/support/* (el
 * dueño). Siempre con la service role key: las tablas no tienen políticas para el cliente.
 *
 * Flujo:
 * - La persona escribe → si no tiene una conversación abierta se crea (categoría, página, idioma)
 *   en «waiting» con `waiting_since` = ahora (orden de llegada). Si ya esperaba, sigue en su
 *   lugar; si el dueño ya había respondido, vuelve a la fila al final. Al dueño le llega un aviso
 *   por correo cuando entra una conversación nueva o vuelve a la fila.
 * - El dueño responde → «answered», la persona tiene un mensaje sin leer (punto en el botón) y le
 *   llega SIEMPRE un correo en su idioma (plantilla 02, textos del chat) con la respuesta y un
 *   botón que abre el chat (/dashboard?soporte=chat) para seguir el caso (docs/229).
 * - La persona o el dueño la cierran → «closed». Si la persona vuelve a escribir, empieza una nueva.
 * - docs/349: si el dueño respondió y la persona no escribe en 24 horas, se cierra sola con un
 *   mensaje del asistente. Al cerrarse (sola, por la persona o por el dueño) le llega a la persona
 *   un correo con la conversación completa. En el chat ve sus conversaciones anteriores y puede
 *   pedir cualquiera por correo.
 */

import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { autoCloseNotifies, messageReceipts, queuePosition, SUPPORT_AUTO_CLOSE_MS, SUPPORT_DELIVERED_EVENT, SUPPORT_SEEN_EVENT, transcriptHtml, type SupportAttachment, type SupportCategory } from "@/lib/support/core"
import { Resend } from "resend"
import { sendWithRetry } from "./send-email"
import { renderEmailTemplate, escapeHtml, escapeHtmlWithLineBreaks } from "./email-templates"
import { withEmailTracking } from "@/lib/email-tracking"
import { formatDate, formatDateTime } from "@/lib/date-format"
import { sendOwnerNotification } from "./notify-owner"
import { sendUserPush } from "./user-push"
import { getEmailLabels, normalizeEmailLang } from "@/lib/i18n/email-labels"
import { sendFeedbackReplyEmail } from "./notify-feedback"
import { googleLanguage, supportAdminLanguage, translateText, type MessageTranslation } from "./translate"
import { adminAccountUrl } from "@/lib/admin/open-account"

export interface SupportConversation {
  id: string
  account_id: string
  category: string
  subject: string
  status: "waiting" | "answered" | "closed"
  waiting_since: string | null
  page: string | null
  language: string
  user_unread: number
  admin_unread: number
  last_message_at: string
  last_message_preview: string
  created_at: string
}

export interface SupportMessage {
  id: string
  conversation_id: string
  sender: "user" | "admin" | "bot"
  body: string
  attachments: SupportAttachment[]
  /** Traducción para quien lo lee (docs/252): al idioma del dueño o al de la persona. */
  translation?: MessageTranslation | null
  created_at: string
}

const db = () => getSupabaseAdminClient() as unknown as { from: (t: string) => any } // tablas fuera de types/database.ts

/**
 * Guarda un mensaje con su traducción. Si la columna `translation` (migración 0038) todavía
 * no existe, lo guarda sin ella.
 */
async function insertMessage(row: Record<string, unknown>, translation: MessageTranslation | null) {
  if (translation) {
    const { error } = await db().from("support_messages").insert({ ...row, translation })
    if (!error) return
    if (!/translation/.test(String(error.message))) throw error
  }
  const { error } = await db().from("support_messages").insert(row)
  if (error) throw error
}

/** false si la migración 0034 todavía no se corrió. */
export async function supportAvailable(): Promise<boolean> {
  const { error } = await db().from("support_conversations").select("id").limit(1)
  return !error
}

async function waitingList() {
  const { data } = await db().from("support_conversations").select("id, status, waiting_since").eq("status", "waiting")
  return (data as { id: string; status: string; waiting_since: string | null }[] | null) ?? []
}

async function messagesOf(conversationId: string): Promise<SupportMessage[]> {
  const { data, error } = await db().from("support_messages").select("*").eq("conversation_id", conversationId).order("created_at", { ascending: true }).limit(500)
  if (error) throw error
  return (data as SupportMessage[]) ?? []
}

/**
 * Marcas de las palomitas (docs/334), sin migración: product_events con business_id = id de la
 * conversación. Si falla, el chat sigue igual (solo faltan las palomitas).
 */
async function supportMarks(conversationIds: string[]): Promise<{ event_name: string; business_id: string; created_at: string }[]> {
  if (conversationIds.length === 0) return []
  const { data, error } = await db()
    .from("product_events")
    .select("event_name, business_id, created_at")
    .in("event_name", [SUPPORT_DELIVERED_EVENT, SUPPORT_SEEN_EVENT])
    .in("business_id", conversationIds)
    .order("created_at", { ascending: true })
    .limit(2000)
  if (error) {
    console.error("[support] No se pudieron leer las palomitas:", error)
    return []
  }
  return data ?? []
}

async function addMark(event: string, conversationId: string) {
  const { error } = await db().from("product_events").insert({ event_name: event, business_id: conversationId })
  if (error) console.error("[support] No se pudo guardar la palomita:", error)
}

/**
 * «Recibida» (docs/334): la app de la persona cargó el chat con respuestas sin leer. Una marca
 * por respuesta nueva: solo si no hay una desde el último mensaje.
 */
async function markDelivered(conversation: SupportConversation) {
  if (!(conversation.user_unread > 0)) return
  const marks = await supportMarks([conversation.id])
  const since = new Date(conversation.last_message_at).getTime()
  if (marks.some((m) => m.event_name === SUPPORT_DELIVERED_EVENT && new Date(m.created_at).getTime() >= since)) return
  await addMark(SUPPORT_DELIVERED_EVENT, conversation.id)
}

/** La conversación más reciente de la persona (abierta o la última cerrada), con sus mensajes y su lugar en la fila. */
export async function getMyConversation(accountId: string) {
  await autoCloseStale(accountId).catch((e) => console.error("[support] Cierre automático:", e))
  const { data, error } = await db().from("support_conversations").select("*").eq("account_id", accountId).order("last_message_at", { ascending: false }).limit(1)
  if (error) throw error
  const conversation = ((data as SupportConversation[]) ?? [])[0] ?? null
  if (!conversation) return { conversation: null, messages: [], position: null, history: [] }
  await markDelivered(conversation).catch(() => {})
  const [messages, waiting, history] = await Promise.all([
    messagesOf(conversation.id),
    conversation.status === "waiting" ? waitingList() : Promise.resolve([]),
    myHistory(accountId, conversation.id),
  ])
  return { conversation, messages, position: conversation.status === "waiting" ? queuePosition(waiting, conversation.id) : null, history }
}

/** Conversaciones anteriores de la persona (docs/349), sin la actual. */
async function myHistory(accountId: string, exceptId: string) {
  const { data } = await db()
    .from("support_conversations")
    .select("id, category, status, created_at, last_message_at, last_message_preview")
    .eq("account_id", accountId)
    .neq("id", exceptId)
    .order("last_message_at", { ascending: false })
    .limit(20)
  return ((data as Pick<SupportConversation, "id" | "category" | "status" | "created_at" | "last_message_at" | "last_message_preview">[] | null) ?? []).map((c) => ({
    id: c.id,
    category: c.category,
    status: c.status,
    createdAt: c.created_at,
    lastMessageAt: c.last_message_at,
    preview: c.last_message_preview,
  }))
}

/** Una conversación anterior de la persona, para leerla (solo si es suya). */
export async function getMyThread(accountId: string, conversationId: string) {
  const { data } = await db().from("support_conversations").select("*").eq("id", conversationId).eq("account_id", accountId).maybeSingle()
  if (!data) return null
  return { conversation: data as SupportConversation, messages: await messagesOf(conversationId) }
}

export async function postUserMessage(input: {
  accountId: string
  email: string
  category: SupportCategory
  body: string
  attachments: SupportAttachment[]
  page: string | null
  language: string
}) {
  const now = new Date().toISOString()
  const preview = (input.body || input.attachments[0]?.name || "").slice(0, 140)
  const { data: open } = await db().from("support_conversations").select("*").eq("account_id", input.accountId).neq("status", "closed").order("last_message_at", { ascending: false }).limit(1)
  let conversation = ((open as SupportConversation[]) ?? [])[0] ?? null
  let notifyOwner = false

  if (!conversation) {
    const { data, error } = await db()
      .from("support_conversations")
      .insert({ account_id: input.accountId, category: input.category, subject: preview.slice(0, 80), status: "waiting", waiting_since: now, page: input.page, language: input.language, admin_unread: 1, last_message_at: now, last_message_preview: preview })
      .select("*")
      .single()
    if (error) throw error
    conversation = data as SupportConversation
    notifyOwner = true
  } else {
    // Ya esperaba: conserva su lugar. Si el dueño ya había respondido, vuelve a la fila al final.
    const backToQueue = conversation.status !== "waiting"
    const { error } = await db()
      .from("support_conversations")
      .update({ status: "waiting", waiting_since: backToQueue ? now : conversation.waiting_since, admin_unread: (conversation.admin_unread || 0) + 1, last_message_at: now, last_message_preview: preview, updated_at: now })
      .eq("id", conversation.id)
    if (error) throw error
    notifyOwner = backToQueue
  }

  // Traducida al idioma del dueño (docs/252).
  const translation = await translateText(input.body, supportAdminLanguage())
  await insertMessage({ conversation_id: conversation.id, sender: "user", body: input.body, attachments: input.attachments }, translation)

  if (notifyOwner) {
    await sendOwnerNotification({
      subject: `Chat de soporte: ${input.email}`,
      rows: [
        ["Cuenta", input.email],
        ["Tema", input.category],
        ["Página", input.page],
        ["Mensaje", preview],
        ["Adjuntos", input.attachments.length ? String(input.attachments.length) : null],
      ],
      footnote: "Respóndelo en /admin → Buzón y reseñas → Chat. La persona ve cuántas personas tiene adelante.",
      label: "chat de soporte",
      url: adminAccountUrl({ userId: input.accountId, email: input.email }, { tab: "buzon", sub: "chat" }),
    }).catch(() => false)
  }
  return getMyConversation(input.accountId)
}

/** Había respuestas sin leer en esa conversación de la persona: marca «vista» (docs/334). */
async function markSeenIfUnread(accountId: string, conversationId: string) {
  const { data } = await db().from("support_conversations").select("user_unread").eq("id", conversationId).eq("account_id", accountId).maybeSingle()
  if ((data as { user_unread?: number } | null)?.user_unread) await addMark(SUPPORT_SEEN_EVENT, conversationId)
}

export async function markUserRead(accountId: string, conversationId: string) {
  await markSeenIfUnread(accountId, conversationId).catch(() => {})
  await db().from("support_conversations").update({ user_unread: 0 }).eq("id", conversationId).eq("account_id", accountId)
}

export async function closeByUser(accountId: string, conversationId: string) {
  await markSeenIfUnread(accountId, conversationId).catch(() => {})
  const { data } = await db()
    .from("support_conversations")
    .update({ status: "closed", user_unread: 0, updated_at: new Date().toISOString() })
    .eq("id", conversationId)
    .eq("account_id", accountId)
    .neq("status", "closed")
    .select("id")
  // docs/349: la conversación completa por correo, solo si de verdad se cerró ahora.
  if ((data as unknown[] | null)?.length) await sendTranscriptEmail(conversationId, "closed").catch((e) => console.error("[support] Correo de la conversación:", e))
}

/** La persona pide por correo una conversación suya (docs/349). */
export async function emailMyConversation(accountId: string, conversationId: string): Promise<boolean> {
  const { data } = await db().from("support_conversations").select("id").eq("id", conversationId).eq("account_id", accountId).maybeSingle()
  if (!data) return false
  return sendTranscriptEmail(conversationId, "copy")
}

// ─── /admin ───

export async function adminListConversations() {
  await autoCloseStale().catch((e) => console.error("[support] Cierre automático:", e))
  const { data, error } = await db().from("support_conversations").select("*").order("last_message_at", { ascending: false }).limit(300)
  if (error) throw error
  const conversations = (data as SupportConversation[]) ?? []
  const admin = getSupabaseAdminClient()
  const ids = Array.from(new Set(conversations.map((c) => c.account_id)))
  const emails = new Map<string, string>()
  await Promise.all(
    ids.map(async (id) => {
      const { data: u } = await admin.auth.admin.getUserById(id)
      if (u?.user?.email) emails.set(id, u.user.email)
    }),
  )
  const waiting = conversations.filter((c) => c.status === "waiting")
  // Palomitas de la última respuesta (docs/334): solo cuando el último mensaje es del dueño.
  const answered = conversations.filter((c) => c.status === "answered")
  const delivered = await supportMarks(answered.filter((c) => c.user_unread > 0).map((c) => c.id))
  const receiptOf = (c: SupportConversation) => {
    if (c.status !== "answered") return null
    if (!(c.user_unread > 0)) return "seen" as const
    const since = new Date(c.last_message_at).getTime()
    return delivered.some((m) => m.business_id === c.id && m.event_name === SUPPORT_DELIVERED_EVENT && new Date(m.created_at).getTime() >= since) ? ("delivered" as const) : ("sent" as const)
  }
  return conversations.map((c) => ({ ...c, email: emails.get(c.account_id) ?? null, position: c.status === "waiting" ? queuePosition(waiting, c.id) : null, receipt: receiptOf(c) }))
}

/** Todas las conversaciones de una cuenta con sus mensajes, para su ficha en /admin (docs/214). Solo lectura. */
export async function adminConversationsOf(accountId: string) {
  const { data, error } = await db().from("support_conversations").select("*").eq("account_id", accountId).order("last_message_at", { ascending: false }).limit(20)
  if (error) throw error
  const conversations = (data as SupportConversation[]) ?? []
  return Promise.all(
    conversations.map(async (c) => ({
      id: c.id,
      status: c.status,
      category: c.category,
      createdAt: c.created_at,
      lastMessageAt: c.last_message_at,
      messages: (await messagesOf(c.id)).map((m) => ({ sender: m.sender, body: m.body, attachments: m.attachments?.length ?? 0, at: m.created_at })),
    })),
  )
}

export async function adminThread(conversationId: string) {
  const [{ data: conv }, messages, marks] = await Promise.all([
    db().from("support_conversations").select("*").eq("id", conversationId).maybeSingle(),
    messagesOf(conversationId),
    supportMarks([conversationId]),
  ])
  if (conv) await db().from("support_conversations").update({ admin_unread: 0 }).eq("id", conversationId)
  const c = conv as SupportConversation | null
  return { conversation: c, messages, receipts: c ? messageReceipts(messages, c.user_unread, marks) : {} }
}

export async function adminReply(conversationId: string, body: string, attachments: SupportAttachment[]) {
  const now = new Date().toISOString()
  const { data: conv, error } = await db().from("support_conversations").select("*").eq("id", conversationId).maybeSingle()
  if (error || !conv) throw error || new Error("No existe la conversación")
  const c = conv as SupportConversation
  // Traducida al idioma de la persona (docs/252); el correo y el aviso van traducidos.
  const translation = await translateText(body, googleLanguage(c.language))
  const shown = translation?.text || body
  await insertMessage({ conversation_id: conversationId, sender: "admin", body, attachments }, translation)
  await db()
    .from("support_conversations")
    .update({ status: "answered", waiting_since: null, user_unread: (c.user_unread || 0) + 1, admin_unread: 0, last_message_at: now, last_message_preview: (body || attachments[0]?.name || "").slice(0, 140), updated_at: now })
    .eq("id", conversationId)

  // Correo a la persona con la respuesta (plantilla 02, en su idioma).
  let emailSent = false
  try {
    const { data: u } = await getSupabaseAdminClient().auth.admin.getUserById(c.account_id)
    const { data: firstMsg } = await db().from("support_messages").select("body").eq("conversation_id", conversationId).eq("sender", "user").order("created_at", { ascending: true }).limit(1)
    if (u?.user?.email) {
      await sendFeedbackReplyEmail({
        toEmail: u.user.email,
        type: "sugerencia",
        ticketId: conversationId.slice(0, 8).toUpperCase(),
        createdAt: c.created_at,
        originalMessage: ((firstMsg as { body: string }[] | null)?.[0]?.body || c.subject || "").slice(0, 600),
        reply: shown || attachments.map((a) => a.name).join(", "),
        preferredLanguage: c.language,
        source: "chat",
      })
      emailSent = true
    }
  } catch (e) {
    console.error("[support] No se pudo mandar el correo de respuesta:", e)
  }
  // Aviso al aparato (docs/241), con el mismo asunto del correo en su idioma.
  await sendUserPush(c.account_id, {
    title: getEmailLabels(normalizeEmailLang(c.language)).e02c_subject,
    body: shown || attachments.map((a) => a.name).join(", "),
    url: "/dashboard?soporte=chat",
  })
  return { emailSent }
}

export async function adminSetStatus(conversationId: string, status: "waiting" | "answered" | "closed") {
  const now = new Date().toISOString()
  const { data: before } = await db().from("support_conversations").select("status").eq("id", conversationId).maybeSingle()
  await db().from("support_conversations").update({ status, waiting_since: status === "waiting" ? now : null, updated_at: now }).eq("id", conversationId)
  // docs/349: al cerrarla el dueño, la persona recibe la conversación completa por correo.
  if (status === "closed" && (before as { status?: string } | null)?.status !== "closed") {
    await sendTranscriptEmail(conversationId, "closed").catch((e) => console.error("[support] Correo de la conversación:", e))
  }
}

// ─── Cierre por inactividad y conversación por correo (docs/349) ───

/**
 * Cierra las conversaciones que esperan a la persona hace 24 horas o más («answered»), con un
 * mensaje del asistente en su idioma, y le manda la conversación por correo. Se llama al abrir el
 * chat (sus conversaciones), al abrir la bandeja de /admin (todas) y en el cron diario. La
 * actualización es condicional (sigue «answered» y vieja), así dos llamadas a la vez no mandan
 * dos correos.
 */
export async function autoCloseStale(accountId?: string, now = Date.now()): Promise<number> {
  const cutoff = new Date(now - SUPPORT_AUTO_CLOSE_MS).toISOString()
  let query = db().from("support_conversations").select("id, language, last_message_at").eq("status", "answered").lte("last_message_at", cutoff).limit(50)
  if (accountId) query = query.eq("account_id", accountId)
  const { data, error } = await query
  if (error) throw error
  let closed = 0
  for (const c of (data as { id: string; language: string; last_message_at: string }[] | null) ?? []) {
    const at = new Date(now).toISOString()
    const { data: updated } = await db()
      .from("support_conversations")
      .update({ status: "closed", updated_at: at })
      .eq("id", c.id)
      .eq("status", "answered")
      .lte("last_message_at", cutoff)
      .select("id")
    if (!(updated as unknown[] | null)?.length) continue
    closed++
    if (!autoCloseNotifies(c.last_message_at, now)) continue // caso viejo: sin mensaje ni correo (docs/353)
    const message = getEmailLabels(normalizeEmailLang(c.language)).support_autoclose_message
    await insertMessage({ conversation_id: c.id, sender: "bot", body: message, attachments: [] }, null).catch((e) => console.error("[support] Mensaje de cierre:", e))
    await sendTranscriptEmail(c.id, "auto").catch((e) => console.error("[support] Correo de la conversación:", e))
  }
  return closed
}

/** Correo a la persona con la conversación completa (plantilla 02, en su idioma). */
export async function sendTranscriptEmail(conversationId: string, reason: "auto" | "closed" | "copy"): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) return false
  const { data: conv } = await db().from("support_conversations").select("*").eq("id", conversationId).maybeSingle()
  const c = conv as SupportConversation | null
  if (!c) return false
  const { data: u } = await getSupabaseAdminClient().auth.admin.getUserById(c.account_id)
  const to = u?.user?.email
  if (!to) return false
  const messages = await messagesOf(conversationId)
  const language = normalizeEmailLang(c.language)
  const labels = getEmailLabels(language)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
  const firstUser = messages.find((m) => m.sender === "user")
  const html = renderEmailTemplate("02-respuesta-feedback.html", {
    htmlLang: language,
    title: labels.e02t_title,
    preheader: labels.e02t_preheader,
    receivedPrefix: labels.e02_received_prefix,
    intro: reason === "auto" ? labels.e02t_intro_auto : reason === "closed" ? labels.e02t_intro_closed : labels.e02t_intro_copy,
    originalLabel: labels.e02t_original_label,
    cta: labels.e02t_cta,
    footnote: labels.e02t_footnote,
    footerAddress: labels.footer_address,
    footer2: labels.e02c_footer2,
    typeLabel: escapeHtml(labels.e02t_title),
    ticketId: escapeHtml(conversationId.slice(0, 8).toUpperCase()),
    receivedAt: escapeHtml(formatDate(c.created_at, { timeZone: "America/Tegucigalpa" })),
    replyTitle: escapeHtml(labels.e02t_reply_title),
    // Ya escapado por transcriptHtml.
    reply: transcriptHtml(messages, { you: labels.e02t_you, team: labels.e02t_team, bot: labels.e02t_bot, attachments: labels.e02t_attachments }, (iso) =>
      formatDateTime(iso, { timeZone: "America/Tegucigalpa" }),
    ),
    originalMessage: escapeHtmlWithLineBreaks((firstUser?.body || c.subject || "").slice(0, 600)),
    appUrl: withEmailTracking(`${siteUrl}/dashboard?soporte=chat`, "support_transcript"),
  })
  const { error } = await sendWithRetry(new Resend(process.env.RESEND_API_KEY), {
    from: process.env.FEEDBACK_NOTIFY_FROM || "GastroMetrics <onboarding@resend.dev>",
    to: [to],
    subject: reason === "auto" ? labels.e02t_subject_auto : reason === "closed" ? labels.e02t_subject_closed : labels.e02t_subject_copy,
    html,
  })
  if (error) throw error
  return true
}
