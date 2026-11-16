import { NextResponse } from "next/server"
import { hasAdminSession } from "@/lib/admin-auth"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { selectAll } from "@/lib/admin/select-all"
import { isConfirmedAccount } from "@/lib/admin/confirmed-accounts"
import { computeDishOverview, type IngredientRowLite, type RecipeRowLite } from "@/lib/admin/dish-overview"

/**
 * «Tipo de plato» de /admin (docs/325): qué platos tienen las cuentas confirmadas y cuánto se
 * usan los alérgenos. Lee todas las recetas e ingredientes (sin el tope de 1000) y calcula con
 * las mismas funciones que la app. Solo con sesión de /admin.
 */
export async function GET() {
  if (!(await hasAdminSession())) return NextResponse.json({ error: "No autorizado." }, { status: 401 })
  const admin = getSupabaseAdminClient()

  const confirmed = new Set<string>()
  for (let page = 1; page < 200; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) return NextResponse.json({ error: "No se pudieron leer las cuentas." }, { status: 500 })
    for (const u of data.users) if (isConfirmedAccount(u)) confirmed.add(u.id)
    if (data.users.length < 200) break
  }

  const [recipes, ingredients] = await Promise.all([
    selectAll<RecipeRowLite>((from, to) =>
      admin.from("recipes").select("id, owner_id, business_id, name, classification, is_sub_recipe, data").order("id").range(from, to),
    ),
    selectAll<IngredientRowLite>((from, to) =>
      admin.from("ingredients").select("id, owner_id, business_id, name, category, data").order("id").range(from, to),
    ),
  ])
  if (recipes.error || ingredients.error) return NextResponse.json({ error: "No se pudieron leer las recetas." }, { status: 500 })

  const overview = computeDishOverview(confirmed, recipes.data ?? [], ingredients.data ?? [])
  return NextResponse.json({ ...overview, readAt: new Date().toISOString() })
}
