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
 *
 * Ordenar por plan (?sort=plan): además del filtro exacto por plan (?plan=<slug>, arriba),
 * esto deja ver TODAS las cuentas juntas pero agrupadas por nivel de plan (Foodie primero,
 * Chef Ejecutivo al final) — pedido explícito del dueño del proyecto ("organizar a los
 * usuarios por planes"). Usa el orden real de negocio de PLAN_ORDER (igual a como aparecen
 * en lib/plans.ts), no alfabético.
 */

import { NextResponse } from "next/server"
import { hasAdminSession } from "@/lib/admin-auth"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { getStripeClient, isStripeConfigured } from "@/lib/stripe/client"
import { plans } from "@/lib/plans"

const PAGE_SIZE = 25
const PLAN_ORDER = new Map(plans.map((plan, index) => [plan.slug, index]))

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
    } else if (sort === "plan") {
      filtered.sort((a, b) => {
        const planA = planByUser.get(a.id)?.plan_slug || "foodie"
        const planB = planByUser.get(b.id)?.plan_slug || "foodie"
        const orderDiff = (PLAN_ORDER.get(planA) ?? 0) - (PLAN_ORDER.get(planB) ?? 0)
        return orderDiff !== 0 ? orderDiff : new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })
    } else {
      filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    }

    const total = filtered.length
    const pageUsers = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
    const ids = pageUsers.map((u) => u.id)

    const [businessRows, teamRows, ownedRecipeRows, ownedIngredientRows, salesImportRows] = await Promise.all([
      ids.length ? admin.from("businesses").select("id, owner_id").in("owner_id", ids) : Promise.resolve({ data: [] as { id: string; owner_id: string }[] }),
      ids.length ? admin.from("team_members").select("owner_id").in("owner_id", ids) : Promise.resolve({ data: [] as { owner_id: string }[] }),
      ids.length ? admin.from("recipes").select("id, owner_id, business_id").in("owner_id", ids) : Promise.resolve({ data: [] as { id: string; owner_id: string; business_id: string | null }[] }),
      ids.length ? admin.from("ingredients").select("id, owner_id, business_id").in("owner_id", ids) : Promise.resolve({ data: [] as { id: string; owner_id: string; business_id: string | null }[] }),
      ids.length
        ? admin.from("sales_imports").select("owner_id, data").in("owner_id", ids)
        : Promise.resolve({ data: [] as { owner_id: string; data: Record<string, unknown> }[] }),
    ])

    const businessCountByUser = new Map<string, number>()
    // Qué cuenta de la página actual es dueña de cada negocio real — necesario para
    // atribuir bien las recetas/ingredientes de abajo, ver el comentario grande más
    // adelante.
    const ownerByBusinessId = new Map<string, string>()
    const businessIdsInPage: string[] = []
    for (const row of businessRows.data ?? []) {
      businessCountByUser.set(row.owner_id, (businessCountByUser.get(row.owner_id) || 0) + 1)
      ownerByBusinessId.set(row.id, row.owner_id)
      businessIdsInPage.push(row.id)
    }
    const teamCountByUser = new Map<string, number>()
    for (const row of teamRows.data ?? []) {
      teamCountByUser.set(row.owner_id, (teamCountByUser.get(row.owner_id) || 0) + 1)
    }

    // BUG CORREGIDO (pedido explícito del dueño del proyecto): el conteo de
    // recetas/ingredientes por cuenta solo miraba owner_id, que en las tablas de
    // negocio SIEMPRE es quien ESCRIBIÓ la fila, no necesariamente el dueño real del
    // negocio (ver el comentario de cabecera de lib/storage/ingredients.ts/recipes.ts
    // y supabase/migrations/0011_team_write_access.sql, punto 3) — una receta o
    // ingrediente que un miembro de equipo invitado carga dentro de un negocio real
    // del dueño de la cuenta queda con owner_id = el UID del miembro, no el del dueño,
    // así que /admin subestimaba el total de cualquier cuenta con equipo activo. Se
    // trae también recipes/ingredients por business_id (los negocios reales de esta
    // página, ya resueltos arriba) y se atribuye cada fila al DUEÑO REAL del negocio
    // (no a quien la escribió) — con "main"/sin negocio, sigue siendo owner_id
    // directo, que ahí sí es siempre correcto (no hay ambigüedad de negocio).
    const [bizRecipeRows, bizIngredientRows] = await Promise.all([
      businessIdsInPage.length
        ? admin.from("recipes").select("id, owner_id, business_id").in("business_id", businessIdsInPage)
        : Promise.resolve({ data: [] as { id: string; owner_id: string; business_id: string | null }[] }),
      businessIdsInPage.length
        ? admin.from("ingredients").select("id, owner_id, business_id").in("business_id", businessIdsInPage)
        : Promise.resolve({ data: [] as { id: string; owner_id: string; business_id: string | null }[] }),
    ])

    function countByOwningAccount(
      ownRows: { id: string; owner_id: string; business_id: string | null }[],
      bizRows: { id: string; owner_id: string; business_id: string | null }[],
    ): Map<string, number> {
      const seenIds = new Set<string>()
      const countByAccount = new Map<string, number>()
      const attribute = (row: { id: string; owner_id: string; business_id: string | null }) => {
        if (seenIds.has(row.id)) return
        seenIds.add(row.id)
        const owningAccount = row.business_id ? ownerByBusinessId.get(row.business_id) : row.owner_id
        if (!owningAccount) return
        countByAccount.set(owningAccount, (countByAccount.get(owningAccount) || 0) + 1)
      }
      ownRows.forEach(attribute)
      bizRows.forEach(attribute)
      return countByAccount
    }

    const recipeCountByUser = countByOwningAccount(ownedRecipeRows.data ?? [], bizRecipeRows.data ?? [])
    const ingredientCountByUser = countByOwningAccount(ownedIngredientRows.data ?? [], bizIngredientRows.data ?? [])
    // Separa POS ("pos_import"/ausente, ver types/sales-import.ts) de registro manual
    // ("manual", docs/90) — antes se mezclaban bajo un solo conteo, y no había forma de
    // saber desde /admin si la función nueva de ventas manuales estaba aterrizando.
    const importSummaryByUser = new Map<
      string,
      { posCount: number; lastPosImportAt: string | null; manualCount: number; lastManualSalesAt: string | null }
    >()
    for (const row of salesImportRows.data ?? []) {
      const info = row.data as { importedAt?: string; source?: string }
      const prev =
        importSummaryByUser.get(row.owner_id) || {
          posCount: 0,
          lastPosImportAt: null,
          manualCount: 0,
          lastManualSalesAt: null,
        }
      if (info.source === "manual") {
        prev.manualCount += 1
        if (info.importedAt && (!prev.lastManualSalesAt || info.importedAt > prev.lastManualSalesAt)) {
          prev.lastManualSalesAt = info.importedAt
        }
      } else {
        prev.posCount += 1
        if (info.importedAt && (!prev.lastPosImportAt || info.importedAt > prev.lastPosImportAt)) {
          prev.lastPosImportAt = info.importedAt
        }
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
      posImportCount: importSummaryByUser.get(u.id)?.posCount || 0,
      lastPosImportAt: importSummaryByUser.get(u.id)?.lastPosImportAt || null,
      manualSalesCount: importSummaryByUser.get(u.id)?.manualCount || 0,
      lastManualSalesAt: importSummaryByUser.get(u.id)?.lastManualSalesAt || null,
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
/**
 * Reactiva una cuenta que pidió su propia eliminación y todavía está dentro de los 30
 * días de gracia (ver app/api/account/delete/route.ts, docs/118) — limpia
 * profiles.deletion_requested_at para que runAccountDeletionPurge() ya no la considere
 * candidata. Es la única forma de reactivar: los nuevos Términos de Uso/Política de
 * Privacidad prometen esto "contactando al soporte", no vía autoservicio.
 */
export async function PATCH(request: Request) {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const userId = typeof body?.userId === "string" ? body.userId : ""
  if (!userId || body?.action !== "reactivate") {
    return NextResponse.json({ error: "Falta el userId o la acción no es válida." }, { status: 400 })
  }

  try {
    const admin = getSupabaseAdminClient()
    const { error } = await admin.from("profiles").update({ deletion_requested_at: null }).eq("id", userId)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[api/admin/accounts PATCH] Error reactivando la cuenta:", error)
    return NextResponse.json({ error: "No se pudo reactivar la cuenta." }, { status: 500 })
  }
}

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
