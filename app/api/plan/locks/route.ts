/**
 * Negocios bloqueados que la persona puede ver (docs/243): los suyos y los de las cuentas que
 * la invitaron. La pantalla de bloqueo confía en esta respuesta, nunca en el plan guardado en
 * el navegador, para no bloquear por error a quien acaba de subir de plan.
 */

import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { getPlanBySlug } from "@/lib/plans"
import { ownerTeamAccess } from "@/lib/team-owner-access"
import { lockedBusinessIds } from "@/lib/plan-locks"

export const dynamic = "force-dynamic"

export async function GET() {
  const {
    data: { user },
  } = await getSupabaseServerClient().auth.getUser()
  if (!user) return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 })

  try {
    const admin = getSupabaseAdminClient()
    const { data: memberships, error: memberError } = await admin.from("team_members").select("owner_id").eq("invited_user_id", user.id)
    if (memberError) throw memberError
    const ownerIds = [...new Set([user.id, ...(memberships ?? []).map((m) => m.owner_id as string)])]

    const [{ data: businesses, error: businessError }, { data: plans, error: planError }] = await Promise.all([
      admin.from("businesses").select("id, owner_id, created_at").in("owner_id", ownerIds),
      admin.from("account_plans").select("account_id, plan_slug, plan_expires_at, extra_businesses").in("account_id", ownerIds),
    ])
    if (businessError) throw businessError
    if (planError) throw planError

    const locked = ownerIds.flatMap((ownerId) => {
      const row = (plans ?? []).find((p) => p.account_id === ownerId)
      const limit = getPlanBySlug(ownerTeamAccess(row).planSlug).maxBusinesses + (row?.extra_businesses || 0)
      return lockedBusinessIds((businesses ?? []).filter((b) => b.owner_id === ownerId), limit)
    })
    return NextResponse.json({ lockedBusinessIds: locked })
  } catch (error) {
    console.error("[api/plan/locks] Error revisando los negocios bloqueados:", error)
    return NextResponse.json({ error: "No se pudo revisar el plan." }, { status: 500 })
  }
}
