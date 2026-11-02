/**
 * Lee de Supabase lo que necesita la vista de negocios de una cuenta en /admin (docs/232) y lo
 * arma con buildBusinessBreakdown (lib/admin/business-breakdown.ts). Solo lee columnas y campos
 * puntuales del JSON (nunca las fotos ni las recetas completas).
 */

import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { buildBusinessBreakdown, type BreakdownBusiness, type BusinessBreakdown } from "@/lib/admin/business-breakdown"

async function allRows<T>(build: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>, cap = 20000): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; from < cap; from += 1000) {
    const { data, error } = await build(from, from + 999)
    if (error) throw error
    if (!Array.isArray(data)) break
    out.push(...(data as T[]))
    if (data.length < 1000) break
  }
  return out
}

const n = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v))
const s = (v: unknown) => (typeof v === "string" ? v : null)

// Texto plano (no literal) para que supabase-js no intente tipar las rutas del JSON (TS2589).
const RECIPE_SELECT: string =
  "business_id, is_sub_recipe, classification, total:data->totalCost, price:data->unitPrice, yield:data->yieldAmount, method:data->>pricingMethod, isv:data->isv, commission:data->salesCommissionPercent"
const INVENTORY_SELECT: string = "business_id, status:data->>status"

export type AccountBusinessBreakdown = BusinessBreakdown & { /** Moneda de la cuenta, para el costo promedio. */ currency: string | null }

export async function getBusinessBreakdown(userId: string, businesses: BreakdownBusiness[]): Promise<AccountBusinessBreakdown> {
  const admin = getSupabaseAdminClient()
  const ids = businesses.map((b) => b.id)
  const ownedOr = ids.length ? `owner_id.eq.${userId},business_id.in.(${ids.join(",")})` : `owner_id.eq.${userId}`
  const activityOr = ids.length ? `user_id.eq.${userId},business_id.in.(${ids.join(",")})` : `user_id.eq.${userId}`
  const owned = <T>(table: string, select: string) =>
    allRows<T>((from, to) => admin.from(table).select(select).or(ownedOr).range(from, to))

  type Row = Record<string, unknown>
  const [profile, recipes, ingredients, inventory, menus, snapshots, orders, invoices, sales, activity] = await Promise.all([
    admin.from("profiles").select("currency").eq("id", userId).maybeSingle(),
    owned<Row>("recipes", RECIPE_SELECT),
    owned<Row>("ingredients", "business_id, category"),
    owned<Row>("inventory_items", INVENTORY_SELECT),
    owned<Row>("menus", "business_id"),
    owned<Row>("inventory_snapshots", "business_id"),
    owned<Row>("purchase_orders", "business_id"),
    owned<Row>("invoices", "business_id"),
    owned<Row>("sales_imports", "business_id"),
    allRows<Row>((from, to) =>
      admin
        .from("activity_log")
        .select("business_id, module, action, entity_label, created_at")
        .or(activityOr)
        .neq("action", "entered")
        .range(from, to),
    ),
  ])
  const bid = (r: Row) => s(r.business_id)
  const only = (rows: Row[]) => rows.map((r) => ({ businessId: bid(r) }))
  const breakdown = buildBusinessBreakdown({
    businesses,
    recipes: recipes.map((r) => ({
      businessId: bid(r),
      isSubRecipe: r.is_sub_recipe === true,
      totalCost: n(r.total),
      unitPrice: n(r.price),
      yieldAmount: n(r.yield),
      classification: s(r.classification),
      pricingMethod: s(r.method),
      isv: n(r.isv),
      salesCommissionPercent: n(r.commission),
    })),
    ingredients: ingredients.map((r) => ({ businessId: bid(r), category: s(r.category) })),
    inventory: inventory.map((r) => ({ businessId: bid(r), status: s(r.status) })),
    counted: { menus: only(menus), inventoryCounts: only(snapshots), purchaseOrders: only(orders), invoices: only(invoices), salesImports: only(sales) },
    activity: activity.map((r) => ({ businessId: bid(r), module: String(r.module), action: String(r.action), entityLabel: s(r.entity_label), at: String(r.created_at) })),
  })
  return { ...breakdown, currency: profile.data?.currency || null }
}
