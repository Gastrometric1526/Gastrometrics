/**
 * /admin → Chat de soporte, una conversación (docs/204).
 * GET   → mensajes (y la marca como leída por el dueño).
 * POST  → respuesta del dueño {body, attachments}; le manda el correo a la persona.
 * PATCH → {status: "waiting" | "answered" | "closed"}.
 */
import { NextResponse } from "next/server"
import { hasAdminSession } from "@/lib/admin-auth"
import { sanitizeAttachments } from "@/lib/support/core"
import { adminReply, adminSetStatus, adminThread } from "@/lib/services/support"

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  if (!(await hasAdminSession())) return NextResponse.json({ error: "No autorizado." }, { status: 401 })
  try {
    const thread = await adminThread(params.id)
    if (!thread.conversation) return NextResponse.json({ error: "No existe." }, { status: 404 })
    return NextResponse.json(thread)
  } catch (e) {
    console.error("[admin/support/id] GET", e)
    return NextResponse.json({ error: "No se pudo cargar la conversación." }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  if (!(await hasAdminSession())) return NextResponse.json({ error: "No autorizado." }, { status: 401 })
  const raw = await request.json().catch(() => null)
  const body = typeof raw?.body === "string" ? raw.body.trim().slice(0, 8000) : ""
  const attachments = sanitizeAttachments(raw?.attachments)
  if (!body && !attachments.length) return NextResponse.json({ error: "El mensaje está vacío." }, { status: 400 })
  try {
    return NextResponse.json({ ok: true, ...(await adminReply(params.id, body, attachments)) })
  } catch (e) {
    console.error("[admin/support/id] POST", e)
    return NextResponse.json({ error: "No se pudo mandar la respuesta." }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  if (!(await hasAdminSession())) return NextResponse.json({ error: "No autorizado." }, { status: 401 })
  const raw = await request.json().catch(() => null)
  const status = raw?.status
  if (!["waiting", "answered", "closed"].includes(status)) return NextResponse.json({ error: "Estado inválido." }, { status: 400 })
  try {
    await adminSetStatus(params.id, status)
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("[admin/support/id] PATCH", e)
    return NextResponse.json({ error: "No se pudo actualizar." }, { status: 500 })
  }
}
