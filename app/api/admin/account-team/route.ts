/**
 * Equipo real de una cuenta ajena, visto/administrado desde /admin — pedido explícito
 * del dueño del proyecto. Mismo patrón de guardia (hasAdminSession) y cliente admin
 * (bypassa RLS) que el resto de /admin.
 *
 * DELETE revoca a un miembro exactamente como lo hace removeTeamMember() en
 * lib/storage/team.ts (borra la fila de team_members Y sus filas de business_members),
 * reescrito acá del lado del servidor porque es la cuenta de OTRO dueño, no la propia
 * sesión — las políticas RLS de business_members/team_members solo dejan administrar
 * al dueño real desde su propia sesión, así que hace falta el cliente admin.
 */

import { NextResponse } from "next/server"
import { hasAdminSession } from "@/lib/admin-auth"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"

export async function GET(request: Request) {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 })
  }

  const userId = new URL(request.url).searchParams.get("userId")
  if (!userId) {
    return NextResponse.json({ error: "Falta userId." }, { status: 400 })
  }

  try {
    const admin = getSupabaseAdminClient()
    const { data, error } = await admin
      .from("team_members")
      .select("id, email, name, status, scope, allowed_features, pdf_access, invited_at, invited_user_id")
      .eq("owner_id", userId)
      .order("invited_at", { ascending: false })
    if (error) throw error

    const members = (data ?? []).map((row) => ({
      id: row.id,
      email: row.email,
      name: row.name || undefined,
      status: row.status,
      scope: row.scope,
      allowedFeatures: (row.allowed_features as string[]) || [],
      pdfAccess: row.pdf_access,
      invitedAt: row.invited_at,
      invitedUserId: row.invited_user_id,
    }))

    return NextResponse.json({ members })
  } catch (error) {
    console.error("[api/admin/account-team] Error listando equipo:", error)
    return NextResponse.json({ error: "No se pudo listar el equipo." }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 })
  }

  const url = new URL(request.url)
  const id = url.searchParams.get("id")
  const userId = url.searchParams.get("userId")
  if (!id || !userId) {
    return NextResponse.json({ error: "Falta id o userId." }, { status: 400 })
  }

  try {
    const admin = getSupabaseAdminClient()

    // Confirma que la fila de verdad pertenece a userId antes de borrar nada.
    const { data: member, error: fetchError } = await admin
      .from("team_members")
      .select("owner_id, scope, invited_user_id")
      .eq("id", id)
      .maybeSingle()
    if (fetchError) throw fetchError
    if (!member || member.owner_id !== userId) {
      return NextResponse.json({ error: "Ese miembro no pertenece a esta cuenta." }, { status: 404 })
    }

    const { error: deleteError } = await admin.from("team_members").delete().eq("id", id)
    if (deleteError) throw deleteError

    if (member.invited_user_id) {
      let businessIds: string[]
      if (member.scope === "dashboard") {
        const { data: ownedBusinesses } = await admin.from("businesses").select("id").eq("owner_id", userId)
        businessIds = (ownedBusinesses ?? []).map((b) => b.id)
      } else {
        businessIds = [member.scope]
      }
      if (businessIds.length > 0) {
        const { error: revokeError } = await admin
          .from("business_members")
          .delete()
          .eq("user_id", member.invited_user_id)
          .in("business_id", businessIds)
        if (revokeError) console.error("[api/admin/account-team] Error revocando business_members:", revokeError)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[api/admin/account-team] Error eliminando miembro:", error)
    return NextResponse.json({ error: "No se pudo eliminar el miembro." }, { status: 500 })
  }
}
