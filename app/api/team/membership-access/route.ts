/**
 * Para la persona invitada: ¿el plan de cada cuenta que la invitó todavía incluye Equipo?
 * (docs/236). Lo pide lib/storage/team.ts al cargar las membresías propias; lib/plan-access.ts
 * deja de aplicar la membresía si el dueño ya no tiene Equipo, y limita los permisos a lo que
 * incluye el plan del dueño. Solo devuelve el plan, si Equipo está activo y el nombre del dueño.
 */

import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { ownerTeamAccess } from "@/lib/team-owner-access"

export const dynamic = "force-dynamic"

export async function GET() {
  const {
    data: { user },
  } = await getSupabaseServerClient().auth.getUser()
  if (!user) return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 })

  try {
    const admin = getSupabaseAdminClient()
    const { data: rows, error } = await admin.from("team_members").select("owner_id").eq("invited_user_id", user.id)
    if (error) throw error
    const ownerIds = [...new Set((rows ?? []).map((r) => r.owner_id as string))]
    if (ownerIds.length === 0) return NextResponse.json({ owners: {} })

    const { data: plans, error: planError } = await admin
      .from("account_plans")
      .select("account_id, plan_slug, plan_expires_at, extra_team_seats")
      .in("account_id", ownerIds)
    if (planError) throw planError

    // El nombre solo para el aviso «ya no tienes acceso al equipo de…».
    const { data: profiles } = await admin.from("profiles").select("id, full_name").in("id", ownerIds)
    const names = new Map((profiles ?? []).map((p) => [p.id as string, (p.full_name as string | null) || null]))
    const byOwner = new Map((plans ?? []).map((p) => [p.account_id as string, p]))
    const owners = Object.fromEntries(ownerIds.map((id) => [id, { ...ownerTeamAccess(byOwner.get(id)), ownerName: names.get(id) ?? null }]))
    return NextResponse.json({ owners })
  } catch (error) {
    console.error("[api/team/membership-access] Error revisando el plan de los dueños:", error)
    return NextResponse.json({ error: "No se pudo revisar el plan." }, { status: 500 })
  }
}
