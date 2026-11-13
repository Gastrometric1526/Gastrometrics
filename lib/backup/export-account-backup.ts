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
import type { SalesImport } from "@/types/sales-import"
import { computeCashUp } from "@/lib/cash-up"
import { getCurrentCurrencyCode } from "@/lib/currency"
import { getCurrentPlan } from "@/lib/plan-access"
import { translate, type LanguageCode, type TranslationKey } from "@/lib/i18n/translations"
import { buildBackupReadme, type BackupScopeCounts } from "@/lib/backup/backup-readme"
import { notifyAdminActivity } from "@/lib/services/activity-log"

/**
 * Versión del formato de datos.json (docs/223). Subirla cuando cambie la forma de algo
 * guardado, para que un respaldo viejo se pueda leer sabiendo cómo era.
 *   1 — formato original (sin versión).
 *   2 — formatVersion, currency, language, plan, counts, cuadre de caja calculado y LEEME.txt.
 */
export const BACKUP_FORMAT_VERSION = 2

/** Registro de ventas con el resultado del cuadre ya calculado (no solo lo anotado). */
function withCashUpResult(imp: SalesImport): SalesImport & { cashUpResult?: ReturnType<typeof computeCashUp> } {
  return imp.cashUp ? { ...imp, cashUpResult: computeCashUp(imp, imp.cashUp) } : imp
}

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

export async function exportAccountBackup(onProgress?: (p: ExportProgress) => void, language: LanguageCode = "es"): Promise<Blob> {
  const tr = (key: TranslationKey) => translate(language, key)
  await refreshBusinesses()
  const businesses = getAllBusinesses()
  // "main" (null) es siempre el primer espacio — cada negocio real después.
  const scopes: { id: string | null; label: string; business: Business | null }[] = [
    { id: null, label: "main", business: null },
    ...businesses.map((b) => ({ id: b.id, label: b.name || b.id, business: b })),
  ]

  const zip = new JSZip()
  const exportedAt = new Date().toISOString()
  const currency = getCurrentCurrencyCode()
  const counts: BackupScopeCounts[] = []
  const data: Record<string, unknown> = {
    app: "GastroMetrics",
    formatVersion: BACKUP_FORMAT_VERSION,
    exportedAt,
    currency,
    language,
    plan: getCurrentPlan().slug,
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

    tick(`${scope.label}: ${tr("nav_ingredientes")}`)
    await ensureIngredientsLoaded(bizIdForLoaders)
    const ingredients = getIngredients(bizIdForLoaders)

    tick(`${scope.label}: ${tr("nav_mis_recetas")}`)
    await ensureRecipesLoaded(bizIdForLoaders)
    const recipes = getRecipes(bizIdForLoaders)

    tick(`${scope.label}: ${tr("nav_menus")}`)
    await ensureMenusLoaded(bizIdForOrders)
    const menus = getMenus(bizIdForOrders)

    tick(`${scope.label}: ${tr("nav_inventario")}`)
    await ensureInventoryLoaded(bizIdForLoaders)
    const inventory = getInventory(bizIdForLoaders)

    tick(`${scope.label}: ${tr("nav_ordenes_compra")}`)
    await ensurePurchaseOrdersLoaded(bizIdForOrders)
    const purchaseOrders = getPurchaseOrders(bizIdForOrders)

    tick(`${scope.label}: ${tr("nav_ventas")}`)
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
      salesImports: salesImports.map(withCashUpResult),
    }
    const scopeCounts: BackupScopeCounts = {
      label: scope.label,
      ingredients: ingredients.length,
      recipes: recipes.length,
      menus: menus.length,
      inventory: inventory.length,
      purchaseOrders: purchaseOrders.length,
      invoices: invoices.length,
      salesImports: salesImports.length,
      recipePdfs: 0,
      menuPdfs: 0,
    }
    counts.push(scopeCounts)

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
        scopeCounts.recipePdfs++
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
        scopeCounts.menuPdfs++
      } catch (error) {
        console.error("[export-account-backup] Error generando PDF de menú", menu.id, error)
      }
    }
  }

  data.counts = counts
  zip.file("datos.json", JSON.stringify(data, null, 2))
  // Qué hay, qué no y cómo usarlo, en el idioma de la persona (docs/223).
  zip.file("LEEME.txt", buildBackupReadme({ language, exportedAt, currency, formatVersion: BACKUP_FORMAT_VERSION, counts }))

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
  // Solo se usa para el respaldo de la cuenta: aviso al celular del dueño (docs/295).
  notifyAdminActivity({ module: "respaldo", action: "downloaded" })
}
