/**
 * Chat de soporte de la persona con sesión (docs/204).
 * GET   → su conversación más reciente, mensajes y cuántas personas tiene adelante.
 * POST  → manda un mensaje {category, body, attachments, page, language}.
 * PATCH → {action: "read" | "close", conversationId}.
 * Si la tabla no existe (migración 0034 sin correr) responde {available: false} y el widget
 * manda el mensaje al buzón de /contacto.
 */
import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import { checkRateLimit } from "@/lib/rate-limit"
import { isSupportCategory, sanitizeAttachments } from "@/lib/support/core"
import { closeByUser, getMyConversation, markUserRead, postUserMessage, supportAvailable } from "@/lib/services/support"

const MAX_BODY = 4000
const LANGS = ["es", "en", "da", "fr", "pt", "zh"]

async function currentUser() {
  const {
    data: { user },
  } = await getSupabaseServerClient().auth.getUser()
  return user
}

export async function GET() {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 })
  if (!(await supportAvailable())) return NextResponse.json({ available: false })
  try {
    return NextResponse.json({ available: true, ...(await getMyConversation(user.id)) })
  } catch (e) {
    console.error("[support] GET", e)
    return NextResponse.json({ error: "No se pudo cargar el chat." }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 })
  const limit = checkRateLimit(`support:${user.id}`, { maxAttempts: 20, windowMs: 10 * 60 * 1000, lockoutMs: 10 * 60 * 1000 })
  if (!limit.allowed) return NextResponse.json({ error: "too_many" }, { status: 429 })

  const raw = await request.json().catch(() => null)
  const body = typeof raw?.body === "string" ? raw.body.trim().slice(0, MAX_BODY) : ""
  const attachments = sanitizeAttachments(raw?.attachments)
  if (!body && !attachments.length) return NextResponse.json({ error: "empty" }, { status: 400 })
  const category = isSupportCategory(raw?.category) ? raw.category : "otro"
  const page = typeof raw?.page === "string" ? raw.page.slice(0, 200) : null
  const language = LANGS.includes(raw?.language) ? raw.language : "es"

  if (!(await supportAvailable())) return NextResponse.json({ available: false }, { status: 503 })
  try {
    const result = await postUserMessage({ accountId: user.id, email: user.email ?? "", category, body, attachments, page, language })
    return NextResponse.json({ available: true, ...result })
  } catch (e) {
    console.error("[support] POST", e)
    return NextResponse.json({ error: "No se pudo mandar el mensaje." }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 })
  const raw = await request.json().catch(() => null)
  const conversationId = typeof raw?.conversationId === "string" ? raw.conversationId : ""
  if (!conversationId) return NextResponse.json({ error: "Falta la conversación." }, { status: 400 })
  try {
    if (raw?.action === "close") await closeByUser(user.id, conversationId)
    else await markUserRead(user.id, conversationId)
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("[support] PATCH", e)
    return NextResponse.json({ error: "No se pudo actualizar." }, { status: 500 })
  }
}
