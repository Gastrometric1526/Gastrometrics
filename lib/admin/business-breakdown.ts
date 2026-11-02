/**
 * Negocios de una cuenta vistos desde /admin (docs/232). Puro, cubierto por pruebas.
 *
 * Por cada espacio (el principal, sin negocio, y cada negocio): su contenido, lo mismo que la
 * persona ve en su Dashboard (recetas, ingredientes, costo promedio, margen promedio, recetas
 * sin precio, productos con poco stock) y lo que hizo ahí: PDF exportados, recetas migradas,
 * importaciones y su última actividad. Las mismas cuentas que el Dashboard (app/dashboard).
 */

import { unitMarginPercent } from "@/lib/recipe-pricing"
import type { Recipe } from "@/types/recipe"
import { SUBRECIPE_CLASSIFICATION } from "@/types/recipe"

export interface BreakdownBusiness {
  id: string
  name: string
  createdAt: string
  isActive: boolean
}

export interface BreakdownRecipe {
  businessId: string | null
  isSubRecipe: boolean
  totalCost: number | null
  unitPrice: number | null
  yieldAmount: number | null
  classification: string | null
  pricingMethod: string | null
  isv: number | null
  salesCommissionPercent: number | null
}

export interface BreakdownActivity {
  businessId: string | null
  module: string
  action: string
  entityLabel: string | null
  at: string
}

export interface BreakdownInput {
  businesses: BreakdownBusiness[]
  recipes: BreakdownRecipe[]
  ingredients: { businessId: string | null; category: string | null }[]
  inventory: { businessId: string | null; status: string | null }[]
  /** Filas de las tablas que solo se cuentan. */
  counted: Record<"menus" | "inventoryCounts" | "purchaseOrders" | "invoices" | "salesImports", { businessId: string | null }[]>
  activity: BreakdownActivity[]
}

export interface SpaceStats {
  /** null = espacio principal (sin negocio). */
  id: string | null
  name: string | null
  createdAt: string | null
  isActive: boolean
  recipes: number
  subRecipes: number
  ingredients: number
  menus: number
  inventoryItems: number
  inventoryCounts: number
  purchaseOrders: number
  invoices: number
  salesImports: number
  averageCost: number
  averageMargin: number | null
  recipesWithoutPrice: number
  lowStock: number
  pdfExports: number
  pdfByKind: Record<string, number>
  recipesMigrated: number
  imports: number
  lastActivityAt: string | null
}

export interface BusinessBreakdown {
  spaces: SpaceStats[]
  totals: Omit<SpaceStats, "id" | "name" | "createdAt" | "isActive"> & {
    businessesNow: number
    businessesCreated: number
    businessesDeleted: number
  }
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0)

function stats(
  recipes: BreakdownRecipe[],
  ingredients: BreakdownInput["ingredients"],
  inventory: BreakdownInput["inventory"],
  counted: Record<keyof BreakdownInput["counted"], number>,
  activity: BreakdownActivity[],
) {
  const sellable = recipes.filter((r) => !r.isSubRecipe && r.classification !== SUBRECIPE_CLASSIFICATION)
  const costed = recipes.filter((r) => num(r.totalCost) > 0)
  const priced = sellable.filter((r) => num(r.unitPrice) > 0 && num(r.yieldAmount) > 0)
  const averageMargin = priced.length
    ? priced.reduce((sum, r) => {
        const asRecipe = { pricingMethod: r.pricingMethod ?? undefined, isv: num(r.isv), salesCommissionPercent: num(r.salesCommissionPercent) } as unknown as Recipe
        return sum + unitMarginPercent(asRecipe, num(r.unitPrice), num(r.totalCost) / num(r.yieldAmount))
      }, 0) / priced.length
    : null
  const pdf = activity.filter((a) => a.module === "pdf" && a.action === "exported")
  const pdfByKind: Record<string, number> = {}
  for (const a of pdf) pdfByKind[a.entityLabel || "other"] = (pdfByKind[a.entityLabel || "other"] || 0) + 1
  const real = activity.filter((a) => a.action !== "entered")
  return {
    recipes: recipes.length,
    subRecipes: recipes.length - sellable.length,
    ingredients: ingredients.filter((i) => i.category !== SUBRECIPE_CLASSIFICATION).length,
    menus: counted.menus,
    inventoryItems: inventory.length,
    inventoryCounts: counted.inventoryCounts,
    purchaseOrders: counted.purchaseOrders,
    invoices: counted.invoices,
    salesImports: counted.salesImports,
    averageCost: costed.length ? costed.reduce((s, r) => s + num(r.totalCost), 0) / costed.length : 0,
    averageMargin: averageMargin === null ? null : Math.round(averageMargin * 10) / 10,
    recipesWithoutPrice: sellable.filter((r) => !(num(r.unitPrice) > 0)).length,
    lowStock: inventory.filter((i) => i.status === "critical" || i.status === "low").length,
    pdfExports: pdf.length,
    pdfByKind,
    recipesMigrated: activity.filter((a) => a.module === "recetas" && a.action === "migrated").length,
    imports: activity.filter((a) => a.action === "imported").length,
    lastActivityAt: real.reduce<string | null>((last, a) => (!last || a.at > last ? a.at : last), null),
  }
}

export function buildBusinessBreakdown(raw: BreakdownInput): BusinessBreakdown {
  const ids = new Set(raw.businesses.map((b) => b.id))
  // La actividad incluye la de su equipo en sus negocios; la de la persona en negocios ajenos
  // (donde es miembro) no es de esta cuenta.
  const input = { ...raw, activity: raw.activity.filter((a) => !a.businessId || ids.has(a.businessId)) }
  // Lo que tenga un negocio que ya no existe (o de otro dueño) cuenta en el espacio principal.
  const key = (businessId: string | null) => (businessId && ids.has(businessId) ? businessId : null)
  const of = <T extends { businessId: string | null }>(rows: T[], id: string | null) => rows.filter((r) => key(r.businessId) === id)
  const countOf = (id: string | null) =>
    Object.fromEntries(Object.entries(input.counted).map(([k, rows]) => [k, of(rows, id).length])) as Record<keyof BreakdownInput["counted"], number>

  const spaceFor = (id: string | null, b?: BreakdownBusiness): SpaceStats => ({
    id,
    name: b?.name ?? null,
    createdAt: b?.createdAt ?? null,
    isActive: b ? b.isActive : true,
    ...stats(of(input.recipes, id), of(input.ingredients, id), of(input.inventory, id), countOf(id), of(input.activity, id)),
  })

  const main = spaceFor(null)
  const mainHasSomething =
    main.recipes + main.ingredients + main.menus + main.inventoryItems + main.purchaseOrders + main.invoices + main.salesImports + main.pdfExports > 0
  const spaces = [...(mainHasSomething ? [main] : []), ...input.businesses.map((b) => spaceFor(b.id, b))]

  const all = stats(input.recipes, input.ingredients, input.inventory, {
    menus: input.counted.menus.length,
    inventoryCounts: input.counted.inventoryCounts.length,
    purchaseOrders: input.counted.purchaseOrders.length,
    invoices: input.counted.invoices.length,
    salesImports: input.counted.salesImports.length,
  }, input.activity)
  const created = input.activity.filter((a) => a.module === "negocios" && a.action === "created").length
  const deleted = input.activity.filter((a) => a.module === "negocios" && a.action === "deleted").length
  return {
    spaces,
    totals: {
      ...all,
      businessesNow: input.businesses.length,
      // El registro empezó después de que algunas cuentas ya tenían negocios: nunca menos que los que hay.
      businessesCreated: Math.max(created, input.businesses.length + deleted),
      businessesDeleted: deleted,
    },
  }
}
