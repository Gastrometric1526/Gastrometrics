/**
 * Borra TODO el contenido de la cuenta (ingredientes, recetas, inventario, menús,
 * órdenes de compra, facturas, ventas, y los negocios mismos) pero mantiene la cuenta
 * en sí — a diferencia de "Eliminar cuenta" (app/api/account/delete/route.ts), que
 * desactiva el login. Pedido explícito del dueño del proyecto: "una opción para borrar
 * todo el contenido de su cuenta" (distinto de borrar la cuenta completa).
 *
 * Por qué dos pasos de borrado en vez de uno: todas las tablas con `business_id` tienen
 * `on delete cascade` hacia `businesses(id)` (ver supabase/migrations/0005, 0009, 0031),
 * así que borrar las filas de `businesses` del dueño ya arrastra automáticamente
 * ingredients/recipes/recipes_trash/inventory_items/inventory_snapshots/menus/
 * purchase_orders/sales_imports/pos_column_mappings/dish_name_mappings/invoices/
 * business_members/business_invites de esos negocios — sin necesidad de borrar cada
 * tabla a mano. Pero `business_id` es NULLABLE en la mayoría de esas tablas (representa
 * el espacio "main", sin negocio — ver el comentario "null = espacio main del usuario"
 * en la migración): esas filas NO cuelgan de ningún `business_id` real, así que no las
 * arrastra ningún cascade y hay que borrarlas aparte, tabla por tabla, filtradas por
 * `owner_id` + `business_id is null`.
 *
 * Deliberadamente NO se toca: profiles, account_plans (la cuenta y su plan siguen
 * existiendo), activity_log (registro de auditoría, no "contenido" del negocio), y
 * cualquier negocio/dato donde la persona sea solo miembro de equipo invitado, no dueño
 * — esto borra lo que la cuenta POSEE, no todo lo que puede ver.
 *
 * Misma autenticación que el resto de rutas de cuenta: contra la sesión real
 * (getSupabaseServerClient().auth.getUser()), nunca contra un id que mande el cliente.
 */

import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"

// Tablas con business_id nullable ("main" = null) que no cuelgan de ningún negocio real
// y por eso no las arrastra el cascade de `businesses` — se limpian aparte.
const MAIN_WORKSPACE_TABLES = [
  "ingredients",
  "recipes",
  "recipes_trash",
  "inventory_items",
  "inventory_snapshots",
  "menus",
  "purchase_orders",
  "sales_imports",
  "pos_column_mappings",
  "dish_name_mappings",
  "invoices",
] as const

export async function POST(request: Request) {
  const supabase = getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Debes iniciar sesión para continuar." }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  // Misma confirmación explícita del correo que ya usa "Eliminar cuenta" — evita un
  // borrado accidental de todo el contenido por un clic de más.
  if (typeof body?.confirmEmail !== "string" || body.confirmEmail.trim().toLowerCase() !== (user.email || "").toLowerCase()) {
    return NextResponse.json({ error: "El correo no coincide con tu cuenta." }, { status: 400 })
  }

  const userId = user.id
  const admin = getSupabaseAdminClient()

  try {
    // 1. Negocios reales del dueño — al borrarlos, el cascade se encarga de todo lo que
    //    cuelga de business_id para esos negocios.
    const { error: businessesError } = await admin.from("businesses").delete().eq("owner_id", userId)
    if (businessesError) {
      console.error("[api/account/wipe-content] Error borrando negocios:", businessesError)
      return NextResponse.json({ error: "No se pudo borrar el contenido. Intenta de nuevo." }, { status: 500 })
    }

    // 2. Contenido del espacio "main" (business_id null) — no cuelga de ningún negocio,
    //    así que ningún cascade lo alcanza; se borra tabla por tabla.
    for (const table of MAIN_WORKSPACE_TABLES) {
      const { error } = await admin.from(table).delete().eq("owner_id", userId).is("business_id", null)
      if (error) {
        console.error(`[api/account/wipe-content] Error borrando ${table} (main):`, error)
        return NextResponse.json({ error: "No se pudo borrar el contenido. Intenta de nuevo." }, { status: 500 })
      }
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[api/account/wipe-content] Error borrando el contenido:", error)
    return NextResponse.json({ error: "No se pudo borrar el contenido." }, { status: 500 })
  }
}
