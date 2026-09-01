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
 *
 * País y tiempo en la app (?sort=time, ver docs/78): mismo criterio — total_active_seconds
 * (supabase/migrations/0016_presence_time_tracking.sql) y nationality (profiles) se
 * traen completos para TODAS las cuentas antes de ordenar/paginar, porque "página 1
 * ordenada por tiempo" tiene que ser de verdad el top 25 de toda la base, no de los 25
 * que hubieran salido primero por fecha de registro.
 */

import { NextResponse } from "next/server"
import { hasAdminSession } from "@/lib/admin-auth"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { getStripeClient, isStripeConfigured } from "@/lib/stripe/client"

const PAGE_SIZE = 25

export async function GET(request: Request) {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 })
  }

  const url = new URL(request.url)
  const search = (url.searchParams.get("search") || "").trim().toLowerCase()
  const planFilter = (url.searchParams.get("plan") || "").trim()
  const sort = (url.searchParams.get("sort") || "recent").trim()
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

    const [{ data: allPlanRows }, { data: allProfileRows }, { data: allPresenceRows }] = await Promise.all([
      admin.from("account_plans").select("account_id, plan_slug, plan_expires_at, stripe_subscription_id"),
      admin.from("profiles").select("id, nationality"),
      admin.from("user_presence").select("user_id, total_active_seconds"),
    ])
    const planByUser = new Map(allPlanRows?.map((r) => [r.account_id, r]) ?? [])
    const countryByUser = new Map(allProfileRows?.map((r) => [r.id, r.nationality || null]) ?? [])
    const activeSecondsByUser = new Map(allPresenceRows?.map((r) => [r.user_id, r.total_active_seconds || 0]) ?? [])

    let filtered = search ? allUsers.filter((u) => u.email.toLowerCase().includes(search)) : allUsers
    if (planFilter) {
      // Cuentas sin fila en account_plans están en "foodie" por default en toda la app.
      filtered = filtered.filter((u) => (planByUser.get(u.id)?.plan_slug || "foodie") === planFilter)
    }
    if (sort === "time") {
      filtered.sort((a, b) => (activeSecondsByUser.get(b.id) || 0) - (activeSecondsByUser.get(a.id) || 0))
    } else {
      filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    }

    const total = filtered.length
    const pageUsers = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
    const ids = pageUsers.map((u) => u.id)

    const [businessRows, teamRows, recipeRows, ingredientRows, salesImportRows] = await Promise.all([
      ids.length ? admin.from("businesses").select("owner_id").in("owner_id", ids) : Promise.resolve({ data: [] as { owner_id: string }[] }),
      ids.length ? admin.from("team_members").select("owner_id").in("owner_id", ids) : Promise.resolve({ data: [] as { owner_id: string }[] }),
      ids.length ? admin.from("recipes").select("owner_id").in("owner_id", ids) : Promise.resolve({ data: [] as { owner_id: string }[] }),
      ids.length ? admin.from("ingredients").select("owner_id").in("owner_id", ids) : Promise.resolve({ data: [] as { owner_id: string }[] }),
      ids.length
        ? admin.from("sales_imports").select("owner_id, data").in("owner_id", ids)
        : Promise.resolve({ data: [] as { owner_id: string; data: Record<string, unknown> }[] }),
    ])

    const businessCountByUser = new Map<string, number>()
    for (const row of businessRows.data ?? []) {
      businessCountByUser.set(row.owner_id, (businessCountByUser.get(row.owner_id) || 0) + 1)
    }
    const teamCountByUser = new Map<string, number>()
    for (const row of teamRows.data ?? []) {
      teamCountByUser.set(row.owner_id, (teamCountByUser.get(row.owner_id) || 0) + 1)
    }
    const recipeCountByUser = new Map<string, number>()
    for (const row of recipeRows.data ?? []) {
      recipeCountByUser.set(row.owner_id, (recipeCountByUser.get(row.owner_id) || 0) + 1)
    }
    const ingredientCountByUser = new Map<string, number>()
    for (const row of ingredientRows.data ?? []) {
      ingredientCountByUser.set(row.owner_id, (ingredientCountByUser.get(row.owner_id) || 0) + 1)
    }
    const importSummaryByUser = new Map<string, { count: number; lastImportedAt: string | null }>()
    for (const row of salesImportRows.data ?? []) {
      const info = row.data as { importedAt?: string }
      const prev = importSummaryByUser.get(row.owner_id) || { count: 0, lastImportedAt: null }
      prev.count += 1
      if (info.importedAt && (!prev.lastImportedAt || info.importedAt > prev.lastImportedAt)) {
        prev.lastImportedAt = info.importedAt
      }
      importSummaryByUser.set(row.owner_id, prev)
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
      recipeCount: recipeCountByUser.get(u.id) || 0,
      ingredientCount: ingredientCountByUser.get(u.id) || 0,
      salesImportCount: importSummaryByUser.get(u.id)?.count || 0,
      lastSalesImportAt: importSummaryByUser.get(u.id)?.lastImportedAt || null,
      hasActiveSubscription: Boolean(planByUser.get(u.id)?.stripe_subscription_id),
      country: countryByUser.get(u.id) || null,
      totalActiveSeconds: activeSecondsByUser.get(u.id) || 0,
    }))

    return NextResponse.json({ accounts, total, page, pageSize: PAGE_SIZE })
  } catch (error) {
    console.error("[api/admin/accounts] Error listando cuentas:", error)
    return NextResponse.json({ error: "No se pudieron listar las cuentas." }, { status: 500 })
  }
}

/**
 * Borrar una cuenta por completo — pedido explícito del dueño del proyecto. Orden
 * obligatorio, investigado tabla por tabla antes de escribir esto (ver docs/71):
 *
 * 1. Cancelar la suscripción real de Stripe si la hay. Esto NUNCA pasa solo — borrar
 *    la cuenta de Supabase no cancela nada en Stripe (no hay sincronización inversa en
 *    este proyecto, solo Stripe -> Supabase vía el webhook), así que sin este paso
 *    Stripe seguiría cobrándole la tarjeta a una cuenta que ya no existe. Si la
 *    cancelación falla por cualquier motivo que no sea "ya no existía", se aborta todo
 *    y la cuenta NO se borra.
 * 2. Limpiar team_members.invited_user_id — el único FK de todo el esquema hacia
 *    auth.users que no tiene "on delete cascade" (confirmado leyendo cada migración).
 *    Sin este paso, el paso 3 fallaría con una violación de llave foránea si esta
 *    cuenta alguna vez fue invitada a un equipo ajeno.
 * 3. admin.auth.admin.deleteUser() — cascada automática de todo lo demás (negocios,
 *    recetas, ingredientes, inventario, menús, órdenes de compra, importaciones de
 *    POS, equipos que esta cuenta creó, profiles, user_presence, account_plans).
 */
export async function DELETE(request: Request) {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 })
  }

  const userId = new URL(request.url).searchParams.get("userId")
  if (!userId) {
    return NextResponse.json({ error: "Falta el userId de la cuenta a eliminar." }, { status: 400 })
  }

  try {
    const admin = getSupabaseAdminClient()

    const { data: planRow } = await admin
      .from("account_plans")
      .select("stripe_customer_id, stripe_subscription_id")
      .eq("account_id", userId)
      .maybeSingle()

    if (planRow?.stripe_subscription_id) {
      if (!isStripeConfigured()) {
        return NextResponse.json(
          { error: "Esta cuenta tiene una suscripción de Stripe activa, pero Stripe no está configurado en este entorno. No se eliminó." },
          { status: 409 },
        )
      }
      const stripe = getStripeClient()
      try {
        await stripe.subscriptions.cancel(planRow.stripe_subscription_id)
      } catch (stripeError: any) {
        if (stripeError?.code !== "resource_missing") {
          console.error("[api/admin/accounts DELETE] Error cancelando la suscripción de Stripe:", stripeError)
          return NextResponse.json(
            { error: "No se pudo cancelar la suscripción de Stripe. La cuenta no se eliminó." },
            { status: 500 },
          )
        }
      }
      if (planRow.stripe_customer_id) {
        try {
          await stripe.customers.del(planRow.stripe_customer_id)
        } catch (stripeError) {
          // Best-effort: el customer es secundario a la suscripción ya cancelada arriba,
          // no bloquea el borrado de la cuenta si esto falla.
          console.error("[api/admin/accounts DELETE] Error borrando el customer de Stripe:", stripeError)
        }
      }
    }

    const { error: teamCleanupError } = await admin.from("team_members").delete().eq("invited_user_id", userId)
    if (teamCleanupError) {
      console.error("[api/admin/accounts DELETE] Error limpiando team_members.invited_user_id:", teamCleanupError)
      return NextResponse.json({ error: "No se pudo limpiar las invitaciones de equipo. La cuenta no se eliminó." }, { status: 500 })
    }

    const { error: deleteError } = await admin.auth.admin.deleteUser(userId)
    if (deleteError) throw deleteError

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[api/admin/accounts DELETE] Error eliminando la cuenta:", error)
    return NextResponse.json({ error: "No se pudo eliminar la cuenta." }, { status: 500 })
  }
}
