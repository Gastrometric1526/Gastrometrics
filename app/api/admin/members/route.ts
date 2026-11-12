import { NextResponse } from "next/server"
import { getAdminIdentity, type AdminIdentity } from "@/lib/admin-auth"
import { deleteAdminMember, insertAdminMember, listAdminMembers, updateAdminMember } from "@/lib/admin/members-server"
import { canManageAccess, canRemove, normalizeAdminEmail, sortMembers } from "@/lib/admin/members"
import { sendAdminInvite } from "@/lib/services/admin-invite"

/**
 * Personas con acceso a /admin (docs/282).
 * GET: la lista (cualquiera con sesión del panel).
 * POST { email, send }: da acceso; con `send` manda la invitación ya, sin él queda
 *   «sin enviar» y el dueño decide cuándo mandarla.
 * PATCH { email, action: "send" }: manda (o reenvía) la invitación.
 * DELETE { email }: quita el acceso (nunca el propio ni el del último dueño).
 * Dar, enviar y quitar: solo el dueño o el código de emergencia.
 */

const who = (identity: AdminIdentity | null) => (identity?.kind === "account" ? identity.email : "código de emergencia")

export async function GET() {
  const identity = await getAdminIdentity()
  if (!identity) return NextResponse.json({ error: "No autorizado." }, { status: 401 })
  const { ready, members } = await listAdminMembers()
  return NextResponse.json({ ready, members: sortMembers(members), canManage: canManageAccess(identity, members), me: identity.kind === "account" ? identity.email : null })
}

async function guard() {
  const identity = await getAdminIdentity()
  if (!identity) return { error: NextResponse.json({ error: "No autorizado." }, { status: 401 }) }
  const { ready, members } = await listAdminMembers()
  if (!ready) return { error: NextResponse.json({ error: "not_ready" }, { status: 503 }) }
  if (!canManageAccess(identity, members)) return { error: NextResponse.json({ error: "only_owner" }, { status: 403 }) }
  return { identity, members }
}

async function invite(email: string, identity: AdminIdentity) {
  const result = await sendAdminInvite({ email, invitedBy: identity.kind === "account" ? identity.email : null })
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 })
  await updateAdminMember(email, { status: "invited", invited_at: new Date().toISOString(), invited_by: who(identity) })
  return null
}

export async function POST(request: Request) {
  const g = await guard()
  if ("error" in g) return g.error
  const body = await request.json().catch(() => null)
  const email = normalizeAdminEmail(body?.email)
  if (!email) return NextResponse.json({ error: "invalid_email" }, { status: 400 })
  const existing = g.members.find((m) => m.email === email)
  if (!existing) {
    const ok = await insertAdminMember({ email, role: "admin", status: "pending", createdBy: who(g.identity) })
    if (!ok) return NextResponse.json({ error: "save_failed" }, { status: 500 })
  }
  if (body?.send === true && existing?.status !== "active") {
    const failed = await invite(email, g.identity)
    if (failed) return failed
  }
  return NextResponse.json({ ok: true, sent: body?.send === true })
}

export async function PATCH(request: Request) {
  const g = await guard()
  if ("error" in g) return g.error
  const body = await request.json().catch(() => null)
  const email = normalizeAdminEmail(body?.email)
  if (!email || body?.action !== "send") return NextResponse.json({ error: "invalid_request" }, { status: 400 })
  if (!g.members.some((m) => m.email === email)) return NextResponse.json({ error: "missing" }, { status: 404 })
  const failed = await invite(email, g.identity)
  return failed ?? NextResponse.json({ ok: true })
}

export async function DELETE(request: Request) {
  const g = await guard()
  if ("error" in g) return g.error
  const body = await request.json().catch(() => null)
  const email = normalizeAdminEmail(body?.email)
  if (!email) return NextResponse.json({ error: "invalid_email" }, { status: 400 })
  const check = canRemove(email, g.identity, g.members)
  if (!check.ok) return NextResponse.json({ error: check.reason }, { status: 400 })
  const ok = await deleteAdminMember(email)
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "save_failed" }, { status: 500 })
}
