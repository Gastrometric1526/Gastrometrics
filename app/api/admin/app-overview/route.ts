import { NextResponse } from "next/server"
import { hasAdminSession } from "@/lib/admin-auth"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { selectAll } from "@/lib/admin/select-all"
import { isConfirmedAccount } from "@/lib/admin/confirmed-accounts"
import { APP_MODULES, computeAppOverview, type AppModule } from "@/lib/admin/app-overview"

/**
 * «Toda la app» (docs/286): totales, uso por módulo, actividad de 30 días y cómo se reparten
 * las cuentas (idioma, país, tipo de negocio, plan). Lee todas las filas, sin el tope de
 * 1000 (lib/admin/select-all.ts), y solo cuenta cuentas confirmadas.
 */
export async function GET() {
  if (!(await hasAdminSession())) return NextResponse.json({ error: "No autorizado." }, { status: 401 })
  const admin = getSupabaseAdminClient()

  const accounts: { id: string; confirmed: boolean }[] = []
  for (let page = 1; page < 200; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) return NextResponse.json({ error: "No se pudieron leer las cuentas." }, { status: 500 })
    for (const u of data.users) accounts.push({ id: u.id, confirmed: isConfirmedAccount(u) })
    if (data.users.length < 200) break
  }

  const since = new Date(Date.now() - 30 * 86_400_000).toISOString()
  const [profiles, plans, activity, ...ownerLists] = await Promise.all([
    selectAll<{ id: string; preferred_language: string | null; nationality: string | null; business_type: string | null; deletion_requested_at: string | null }>((from, to) =>
      admin.from("profiles").select("id, preferred_language, nationality, business_type, deletion_requested_at").order("id").range(from, to),
    ),
    selectAll<{ account_id: string; plan_slug: string | null }>((from, to) => admin.from("account_plans").select("account_id, plan_slug").order("account_id").range(from, to)),
    selectAll<{ user_id: string; module: string; created_at: string }>((from, to) =>
      admin.from("activity_log").select("user_id, module, created_at").gte("created_at", since).order("id").range(from, to),
    ),
    ...APP_MODULES.map((module) =>
      selectAll<Record<string, string>>((from, to) =>
        // Tablas sin columnas propias en types/database: se piden por nombre de forma genérica.
        (admin.from(module as "recipes") as unknown as { select: (c: string) => { order: (c: string) => { range: (a: number, b: number) => PromiseLike<{ data: unknown[] | null; error: unknown }> } } })
          .select("id, owner_id")
          .order("id")
          .range(from, to),
      ),
    ),
  ])

  const owners: Partial<Record<AppModule, string[]>> = {}
  APP_MODULES.forEach((module, i) => {
    owners[module] = (ownerLists[i].data ?? []).map((r) => r.owner_id).filter(Boolean)
  })

  const overview = computeAppOverview({
    accounts,
    profiles: profiles.data ?? [],
    plans: plans.data ?? [],
    owners,
    activity: activity.data ?? [],
  })
  return NextResponse.json({ ...overview, readAt: new Date().toISOString() })
}
