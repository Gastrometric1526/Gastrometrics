/**
 * Negocios reales de una cuenta ajena, vistos/editados desde /admin — pedido explícito
 * del dueño del proyecto. Mismo patrón de guardia que el resto de /admin
 * (hasAdminSession) y mismo cliente admin (bypassa RLS, ve cualquier cuenta).
 *
 * Solo activar/desactivar (isActive, el mismo campo reversible que ya usa el propio
 * dueño de un negocio desde /negocios) — no se agrega borrado acá: es destructivo
 * (cascada real a ingredientes/recetas/inventario/etc.) y no fue parte de lo pedido.
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
      .from("businesses")
      .select("id, name, created_at, data")
      .eq("owner_id", userId)
      .order("created_at", { ascending: true })
    if (error) throw error

    const businesses = (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      createdAt: row.created_at,
      isActive: (row.data as { isActive?: boolean })?.isActive !== false,
    }))

    return NextResponse.json({ businesses })
  } catch (error) {
    console.error("[api/admin/account-businesses] Error listando negocios:", error)
    return NextResponse.json({ error: "No se pudieron listar los negocios." }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const userId = typeof body?.userId === "string" ? body.userId : ""
  const businessId = typeof body?.businessId === "string" ? body.businessId : ""
  const isActive = Boolean(body?.isActive)

  if (!userId || !businessId) {
    return NextResponse.json({ error: "Falta userId o businessId." }, { status: 400 })
  }

  try {
    const admin = getSupabaseAdminClient()

    // Confirma que el negocio de verdad pertenece a userId antes de tocar nada — evita
    // que alguien mande un businessId de otra cuenta distinta a la que se está viendo.
    const { data: current, error: fetchError } = await admin
      .from("businesses")
      .select("owner_id, data")
      .eq("id", businessId)
      .maybeSingle()
    if (fetchError) throw fetchError
    if (!current || current.owner_id !== userId) {
      return NextResponse.json({ error: "Ese negocio no pertenece a esta cuenta." }, { status: 404 })
    }

    const nextData = { ...(current.data as Record<string, unknown>), isActive }
    const { error } = await admin.from("businesses").update({ data: nextData }).eq("id", businessId)
    if (error) throw error

    return NextResponse.json({ ok: true, isActive })
  } catch (error) {
    console.error("[api/admin/account-businesses] Error actualizando negocio:", error)
    return NextResponse.json({ error: "No se pudo actualizar el negocio." }, { status: 500 })
  }
}
