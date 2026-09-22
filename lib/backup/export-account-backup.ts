// Respaldo completo de la cuenta — pedido explícito del dueño del proyecto: "el usuario
// en settings debería tener una opción para... descargar un backup de todo su contenido,
// ya sea como un zip lleno de pdfs y todo al igual que sus ingredientes, datos recetas
// menus TODO".
//
// Corre en el navegador (no en el servidor): reusa exactamente las mismas cachés
// reactivas que ya usa el resto de la app (ensureXLoaded + getX), así que el respaldo
// siempre refleja lo mismo que la persona ve en pantalla, no una copia aparte. Recorre
// el workspace "main" (business_id null) más cada negocio real de la cuenta.

import JSZip from "jszip"
import { getAllBusinesses, refreshBusinesses } from "@/lib/storage/businesses"
import { ensureIngredientsLoaded, getIngredients } from "@/lib/storage/ingredients"
import { ensureRecipesLoaded, getRecipes } from "@/lib/storage/recipes"
import { ensureMenusLoaded, getMenus } from "@/lib/menus"
import { ensureInventoryLoaded, getInventory } from "@/lib/storage/inventory"
import { ensurePurchaseOrdersLoaded, getPurchaseOrders } from "@/lib/storage/purchase-orders"
import { ensureInvoicesLoaded, getInvoices } from "@/lib/storage/invoices"
import { ensureSalesImportsLoaded, getSalesImports } from "@/lib/storage/sales-imports"
import { generateRecipePDF } from "@/lib/pdf/recipe-pdf-generator"
import { generateMenuPDF } from "@/lib/pdf/menu-pdf-generator"
import type { Business } from "@/types/business"

// Nombre de archivo seguro para dentro del zip — quita cualquier caracter que rompa un
// nombre de archivo en Windows/macOS/Linux, sin depender de una librería aparte.
function safeFilename(name: string, fallback: string): string {
  const cleaned = (name || fallback).trim().replace(/[\\/:*?"<>|]+/g, "-").slice(0, 80)
  return cleaned || fallback
}

export interface ExportProgress {
  stage: string
  current: number
  total: number
}

export async function exportAccountBackup(onProgress?: (p: ExportProgress) => void): Promise<Blob> {
  await refreshBusinesses()
  const businesses = getAllBusinesses()
  // "main" (null) es siempre el primer espacio — cada negocio real después.
  const scopes: { id: string | null; label: string; business: Business | null }[] = [
    { id: null, label: "main", business: null },
    ...businesses.map((b) => ({ id: b.id, label: b.name || b.id, business: b })),
  ]

  const zip = new JSZip()
  const data: Record<string, unknown> = {
    exportedAt: new Date().toISOString(),
    businesses: businesses.map((b) => ({
      id: b.id,
      name: b.name,
      description: b.description,
      type: b.type,
      expenses: b.expenses,
      pricingMethod: b.pricingMethod,
    })),
    scopes: {} as Record<string, unknown>,
  }

  let step = 0
  const totalSteps = scopes.length * 6 // 6 tipos de dato por scope
  const tick = (stage: string) => onProgress?.({ stage, current: ++step, total: totalSteps })

  const pdfFolder = zip.folder("pdfs")

  for (const scope of scopes) {
    const bizIdForLoaders = scope.id // null → funciones ya interpretan null como "main"
    const bizIdForOrders = scope.id || "main" // purchase_orders/invoices/menus exigen string

    tick(`${scope.label}: ingredientes`)
    await ensureIngredientsLoaded(bizIdForLoaders)
    const ingredients = getIngredients(bizIdForLoaders)

    tick(`${scope.label}: recetas`)
    await ensureRecipesLoaded(bizIdForLoaders)
    const recipes = getRecipes(bizIdForLoaders)

    tick(`${scope.label}: menús`)
    await ensureMenusLoaded(bizIdForOrders)
    const menus = getMenus(bizIdForOrders)

    tick(`${scope.label}: inventario`)
    await ensureInventoryLoaded(bizIdForLoaders)
    const inventory = getInventory(bizIdForLoaders)

    tick(`${scope.label}: órdenes de compra`)
    await ensurePurchaseOrdersLoaded(bizIdForOrders)
    const purchaseOrders = getPurchaseOrders(bizIdForOrders)

    tick(`${scope.label}: facturas y ventas`)
    await ensureInvoicesLoaded(bizIdForOrders)
    const invoices = getInvoices(bizIdForOrders)
    await ensureSalesImportsLoaded(bizIdForLoaders)
    const salesImports = getSalesImports(bizIdForLoaders)

    ;(data.scopes as Record<string, unknown>)[scope.label] = {
      businessId: scope.id,
      ingredients,
      recipes,
      menus,
      inventory,
      purchaseOrders,
      invoices,
      salesImports,
    }

    // PDF de cada receta real (variante administrativa — incluye costos, es el
    // respaldo del dueño, no el documento que se comparte con el equipo de cocina).
    const scopeFolder = pdfFolder?.folder(safeFilename(scope.label, "main"))
    const recipesFolder = scopeFolder?.folder("recetas")
    for (const recipe of recipes) {
      try {
        const doc = generateRecipePDF(recipe, {
          type: "administrative",
          includeImage: true,
          includeCosts: true,
          includePricing: true,
          includeNotes: true,
          businessName: scope.business?.name,
          businessLogo: scope.business?.logo,
        })
        const blob = doc.output("blob")
        recipesFolder?.file(`${safeFilename(recipe.name, recipe.id)}.pdf`, blob)
      } catch (error) {
        console.error("[export-account-backup] Error generando PDF de receta", recipe.id, error)
      }
    }

    // PDF de cada menú (variante cliente — la carta real, sin costos internos; los
    // costos de cada plato ya quedan en datos.json y en el PDF de la receta).
    const menusFolder = scopeFolder?.folder("menus")
    for (const menu of menus) {
      try {
        const doc = generateMenuPDF(menu, recipes, {
          type: "cliente",
          businessName: scope.business?.name,
          businessLogo: scope.business?.logo,
        })
        const blob = doc.output("blob")
        menusFolder?.file(`${safeFilename(menu.name, menu.id)}.pdf`, blob)
      } catch (error) {
        console.error("[export-account-backup] Error generando PDF de menú", menu.id, error)
      }
    }
  }

  zip.file("datos.json", JSON.stringify(data, null, 2))

  onProgress?.({ stage: "comprimiendo", current: totalSteps, total: totalSteps })
  return zip.generateAsync({ type: "blob" })
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
