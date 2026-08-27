/**
 * Lista completa de cuentas reales (no una búsqueda de a una por correo, como
 * /api/admin/account-plan) — pedido explícito del dueño del proyecto: "ahi debo poder
 * manejar TODO". Mismo patrón de paginación en memoria que ya usa account-plan/route.ts
 * (no hay endpoint de "listar con filtro" en esta versión del SDK de Supabase Auth).
 *
 * Filtro por plan (?plan=<slug>, ver docs/63): el plan de cada cuenta hace falta ANTES
 * de paginar (para que "página 1 de Chef Ejecutivo" muestre de verdad 25 cuentas de ese
 * plan, no 25 cuentas cualesquiera de las que ninguna sea ese plan) — por eso
 * account_plans se trae completo, para TODAS las cuentas, no solo la página actual.
 */

import { NextResponse } from "next/server"
import { hasAdminSession } from "@/lib/admin-auth"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"

const PAGE_SIZE = 25

export async function GET(request: Request) {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 })
  }

  const url = new URL(request.url)
  const search = (url.searchParams.get("search") || "").trim().toLowerCase()
  const planFilter = (url.searchParams.get("plan") || "").trim()
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1)

  try {
    const admin = getSupabaseAdminClient()

    // Trae todas las cuentas (a esta escala, barato) y filtra/pagina en memoria — mismo
    // criterio ya aceptado en account-plan/route.ts para "buscar por correo exacto".
    let allUsers: { id: string; email: string; created_at: string; email_confirmed_at: string | null }[] = []
    let listPage = 1
    while (true) {
      const { data, error } = await admin.auth.admin.listUsers({ page: listPage, perPage: 200 })
      if (error) throw error
      allUsers = allUsers.concat(
        data.users.map((u) => ({
          id: u.id,
          email: u.email || "",
          created_at: u.created_at,
          email_confirmed_at: u.email_confirmed_at || null,
        })),
      )
      if (data.users.length < 200) break
      listPage += 1
    }

    const { data: allPlanRows } = await admin.from("account_plans").select("account_id, plan_slug, plan_expires_at")
    const planByUser = new Map(allPlanRows?.map((r) => [r.account_id, r]) ?? [])

    let filtered = search ? allUsers.filter((u) => u.email.toLowerCase().includes(search)) : allUsers
    if (planFilter) {
      // Cuentas sin fila en account_plans están en "foodie" por default en toda la app.
      filtered = filtered.filter((u) => (planByUser.get(u.id)?.plan_slug || "foodie") === planFilter)
    }
    filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    const total = filtered.length
    const pageUsers = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
    const ids = pageUsers.map((u) => u.id)

    const [businessRows, teamRows] = await Promise.all([
      ids.length ? admin.from("businesses").select("owner_id").in("owner_id", ids) : Promise.resolve({ data: [] as { owner_id: string }[] }),
      ids.length ? admin.from("team_members").select("owner_id").in("owner_id", ids) : Promise.resolve({ data: [] as { owner_id: string }[] }),
    ])

    const businessCountByUser = new Map<string, number>()
    for (const row of businessRows.data ?? []) {
      businessCountByUser.set(row.owner_id, (businessCountByUser.get(row.owner_id) || 0) + 1)
    }
    const teamCountByUser = new Map<string, number>()
    for (const row of teamRows.data ?? []) {
      teamCountByUser.set(row.owner_id, (teamCountByUser.get(row.owner_id) || 0) + 1)
    }

    const accounts = pageUsers.map((u) => ({
      userId: u.id,
      email: u.email,
      createdAt: u.created_at,
      emailConfirmed: Boolean(u.email_confirmed_at),
      planSlug: planByUser.get(u.id)?.plan_slug || "foodie",
      planExpiresAt: planByUser.get(u.id)?.plan_expires_at || null,
      businessCount: businessCountByUser.get(u.id) || 0,
      teamMemberCount: teamCountByUser.get(u.id) || 0,
    }))

    return NextResponse.json({ accounts, total, page, pageSize: PAGE_SIZE })
  } catch (error) {
    console.error("[api/admin/accounts] Error listando cuentas:", error)
    return NextResponse.json({ error: "No se pudieron listar las cuentas." }, { status: 500 })
  }
}
