import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { deletionDeadline } from "@/lib/account-recovery"
import { sendOwnerNotification } from "@/lib/services/notify-owner"
import { adminAccountUrl } from "@/lib/admin/open-account"

/**
 * Reactivar la propia cuenta dentro de los 30 días de gracia (docs/285). Antes solo se
 * podía desde /admin; ahora quien entra ve «Tu cuenta se eliminará el …» y la reactiva
 * con un toque. Solo actúa sobre la cuenta de la sesión: nunca acepta un id del cliente.
 * GET dice si la cuenta está por eliminarse y cuándo.
 */
async function sessionUser() {
  const { data } = await getSupabaseServerClient().auth.getUser()
  return data.user ?? null
}

export async function GET() {
  const user = await sessionUser()
  if (!user) return NextResponse.json({ pending: false })
  const { data } = await getSupabaseAdminClient().from("profiles").select("deletion_requested_at").eq("id", user.id).maybeSingle()
  const deadline = deletionDeadline(data?.deletion_requested_at)
  return NextResponse.json(deadline ? { pending: true, ...deadline } : { pending: false })
}

export async function POST() {
  const user = await sessionUser()
  if (!user) return NextResponse.json({ error: "no_session" }, { status: 401 })
  const admin = getSupabaseAdminClient()
  const { data } = await admin.from("profiles").select("deletion_requested_at").eq("id", user.id).maybeSingle()
  if (!data?.deletion_requested_at) return NextResponse.json({ ok: true, alreadyActive: true })
  const { error } = await admin.from("profiles").update({ deletion_requested_at: null }).eq("id", user.id)
  if (error) {
    console.error("[api/account/reactivate]", error.message)
    return NextResponse.json({ error: "save_failed" }, { status: 500 })
  }
  await sendOwnerNotification({
    subject: "Cuenta reactivada por su dueño",
    rows: [["Cuenta", user.email]],
    footnote: "La persona reactivó su cuenta dentro de los 30 días de gracia. Si tenía un plan pagado, tiene que volver a elegirlo en Mi Plan.",
    label: "cuenta reactivada",
    url: adminAccountUrl({ userId: user.id }),
  })
  return NextResponse.json({ ok: true })
}
