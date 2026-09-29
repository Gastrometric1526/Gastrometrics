/**
 * Usuarios que más usan la app (docs/141) — pedido del dueño: "en las métricas del admin
 * poder ver un listado de los usuarios que más usan la app". Mismo patrón que el resto
 * de /api/admin (hasAdminSession + getSupabaseAdminClient, bypassa RLS).
 *
 * Fuentes reales, nada estimado:
 * - activity_log (docs/87): cada acción (crear/editar/importar…) y cada "entró a tal
 *   módulo" de cualquier persona, dueña o invitada. De ahí salen días activos, acciones,
 *   visitas y módulos más usados dentro del período.
 * - user_presence: tiempo total en la app (total_active_seconds, docs/78, histórico) y
 *   última vez visto.
 * - account_plans: plan de la cuenta (a un invitado le corresponde el del dueño; acá se
 *   muestra el propio, que para un invitado suele ser Foodie).
 *
 * ?days=7|30|90 (por defecto 30) y ?sort=days|actions|time. Devuelve hasta 50 personas.
 */

import { NextResponse } from "next/server"
import { hasAdminSession } from "@/lib/admin-auth"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { rankUsersByUsage, type ActivityRow, type TopUsersSort } from "@/lib/admin/top-users"

const PAGE = 1000
const ALLOWED_DAYS = [7, 30, 90]
const LIMIT = 50

export async function GET(request: Request) {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 })
  }

  const url = new URL(request.url)
  const requestedDays = Number(url.searchParams.get("days"))
  const days = ALLOWED_DAYS.includes(requestedDays) ? requestedDays : 30
  const sortParam = url.searchParams.get("sort")
  const sort: TopUsersSort = sortParam === "actions" || sortParam === "time" ? sortParam : "days"

  try {
    const admin = getSupabaseAdminClient()
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

    // activity_log puede tener miles de filas en 90 días: Supabase corta en 1000 por
    // consulta, así que se pagina hasta traerlas todas.
    const activity: ActivityRow[] = []
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await admin
        .from("activity_log")
        .select("user_id, user_name, module, action, created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .range(from, from + PAGE - 1)
      if (error) throw error
      activity.push(...(data ?? []))
      if (!data || data.length < PAGE) break
    }

    const [{ data: presenceRows, error: presenceError }, { data: planRows, error: planError }] = await Promise.all([
      admin.from("user_presence").select("user_id, total_active_seconds, last_seen_at"),
      admin.from("account_plans").select("account_id, plan_slug"),
    ])
    if (presenceError) throw presenceError
    if (planError) throw planError

    const emailByUserId = new Map<string, string>()
    for (let page = 1; ; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
      if (error) throw error
      for (const u of data.users) if (u.email) emailByUserId.set(u.id, u.email)
      if (data.users.length < 200) break
    }

    const users = rankUsersByUsage({
      activity,
      presence: new Map((presenceRows ?? []).map((p) => [p.user_id, p])),
      planBy: new Map((planRows ?? []).map((p) => [p.account_id, p.plan_slug])),
      emailBy: emailByUserId,
      sort,
    })

    return NextResponse.json({ days, sort, totalActiveUsers: users.length, users: users.slice(0, LIMIT) })
  } catch (error) {
    console.error("[api/admin/top-users] Error calculando usuarios más activos:", error)
    return NextResponse.json({ error: "No se pudo calcular el uso por usuario." }, { status: 500 })
  }
}
