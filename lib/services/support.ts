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
 *   llega un correo en su idioma (plantilla 02) con la respuesta.
 * - La persona o el dueño la cierran → «closed». Si la persona vuelve a escribir, empieza una nueva.
 */

import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { queuePosition, type SupportAttachment, type SupportCategory } from "@/lib/support/core"
import { sendOwnerNotification } from "./notify-owner"
import { sendFeedbackReplyEmail } from "./notify-feedback"

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
  created_at: string
}

const db = () => getSupabaseAdminClient() as unknown as { from: (t: string) => any } // tablas fuera de types/database.ts

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

/** La conversación más reciente de la persona (abierta o la última cerrada), con sus mensajes y su lugar en la fila. */
export async function getMyConversation(accountId: string) {
  const { data, error } = await db().from("support_conversations").select("*").eq("account_id", accountId).order("last_message_at", { ascending: false }).limit(1)
  if (error) throw error
  const conversation = ((data as SupportConversation[]) ?? [])[0] ?? null
  if (!conversation) return { conversation: null, messages: [], position: null }
  const [messages, waiting] = await Promise.all([messagesOf(conversation.id), conversation.status === "waiting" ? waitingList() : Promise.resolve([])])
  return { conversation, messages, position: conversation.status === "waiting" ? queuePosition(waiting, conversation.id) : null }
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

  const { error: msgError } = await db().from("support_messages").insert({ conversation_id: conversation.id, sender: "user", body: input.body, attachments: input.attachments })
  if (msgError) throw msgError

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
    }).catch(() => false)
  }
  return getMyConversation(input.accountId)
}

export async function markUserRead(accountId: string, conversationId: string) {
  await db().from("support_conversations").update({ user_unread: 0 }).eq("id", conversationId).eq("account_id", accountId)
}

export async function closeByUser(accountId: string, conversationId: string) {
  await db().from("support_conversations").update({ status: "closed", user_unread: 0, updated_at: new Date().toISOString() }).eq("id", conversationId).eq("account_id", accountId)
}

// ─── /admin ───

export async function adminListConversations() {
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
  return conversations.map((c) => ({ ...c, email: emails.get(c.account_id) ?? null, position: c.status === "waiting" ? queuePosition(waiting, c.id) : null }))
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
  const [{ data: conv }, messages] = await Promise.all([db().from("support_conversations").select("*").eq("id", conversationId).maybeSingle(), messagesOf(conversationId)])
  if (conv) await db().from("support_conversations").update({ admin_unread: 0 }).eq("id", conversationId)
  return { conversation: conv as SupportConversation | null, messages }
}

export async function adminReply(conversationId: string, body: string, attachments: SupportAttachment[]) {
  const now = new Date().toISOString()
  const { data: conv, error } = await db().from("support_conversations").select("*").eq("id", conversationId).maybeSingle()
  if (error || !conv) throw error || new Error("No existe la conversación")
  const c = conv as SupportConversation
  const { error: msgError } = await db().from("support_messages").insert({ conversation_id: conversationId, sender: "admin", body, attachments })
  if (msgError) throw msgError
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
        reply: body || attachments.map((a) => a.name).join(", "),
        preferredLanguage: c.language,
      })
      emailSent = true
    }
  } catch (e) {
    console.error("[support] No se pudo mandar el correo de respuesta:", e)
  }
  return { emailSent }
}

export async function adminSetStatus(conversationId: string, status: "waiting" | "answered" | "closed") {
  const now = new Date().toISOString()
  await db().from("support_conversations").update({ status, waiting_since: status === "waiting" ? now : null, updated_at: now }).eq("id", conversationId)
}
