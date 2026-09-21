/**
 * Convierte el borrador de la demo de la landing (lib/landing-demo.ts) en datos REALES
 * de la cuenta recién creada — pedido explícito del dueño del proyecto: "garantiza que
 * si se guarde en la cuenta creada por el usuario tanto en ingredientes como en mis
 * recetas". Se llama una sola vez, justo después del login automático que sigue al
 * registro (ver app/signup/page.tsx), antes de redirigir al dashboard — el tour de
 * onboarding real (onboarding-tour.tsx → page-tours.tsx) ya fuerza el paso por
 * Ingredientes y Ficha Técnica, así que la persona encuentra ahí su propio ejemplo, ya
 * guardado de verdad, en vez de una pantalla vacía.
 *
 * businessId "main" (el workspace por defecto antes de crear un negocio real, ver el
 * comentario de cabecera de lib/storage/businesses.ts) es exactamente lo que usan
 * /ingredientes y /ficha-tecnica cuando no hay ?business= en la URL — que es adonde
 * apunta el tour forzado. No hace falta crear un negocio real para esto.
 *
 * Best-effort: si algo falla acá (Supabase caído, borrador corrupto, etc.) no debe
 * romper el registro — se atrapa el error en la llamada, nunca acá adentro.
 */

import { generateId } from "@/lib/utils"
import { addIngredient } from "@/lib/storage/ingredients"
import { saveRecipe } from "@/lib/storage/recipes"
import { defaultPricingConfig } from "@/types/recipe"
import type { RecipeIngredient } from "@/types/recipe"
import type { Ingredient } from "@/types/ingredient"
import { readLandingDemoDraft, clearLandingDemoDraft, unitCostOf } from "@/lib/landing-demo"

const DEMO_UNIT: Ingredient["unit"] = "unidad"
const DEMO_CATEGORY: Ingredient["category"] = "OTROS"
const DEMO_CLASSIFICATION = "Línea caliente (Cuisine chaude)"

export async function tryCarryLandingDemoIntoAccount(): Promise<boolean> {
  const draft = readLandingDemoDraft()
  if (!draft) return false

  const namedIngredients = draft.ingredients.filter((i) => i.name.trim() && i.purchasePrice > 0)
  const usableLines = draft.recipeLines.filter(
    (line) => line.quantity > 0 && namedIngredients.some((i) => i.id === line.ingredientId),
  )
  if (namedIngredients.length === 0 || usableLines.length === 0) {
    clearLandingDemoDraft()
    return false
  }

  const realIdByDraftId = new Map<string, string>()
  for (const demoIngredient of namedIngredients) {
    const realId = generateId()
    realIdByDraftId.set(demoIngredient.id, realId)
    const unitCost = unitCostOf(demoIngredient)
    const ingredientToCreate: Ingredient = {
      id: realId,
      name: demoIngredient.name.trim(),
      category: DEMO_CATEGORY,
      unit: DEMO_UNIT,
      supplier: "",
      pricing: {
        purchasePrice: demoIngredient.purchasePrice,
        netContent: demoIngredient.netContent,
        pricePerUnit: unitCost,
        lastUpdated: new Date().toISOString(),
      },
      metadata: { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), version: 1 },
    }
    await addIngredient(ingredientToCreate, "main")
  }

  const recipeIngredients: RecipeIngredient[] = usableLines.map((line, index) => {
    const demoIngredient = namedIngredients.find((i) => i.id === line.ingredientId)!
    const unitCost = unitCostOf(demoIngredient)
    const extension = line.quantity * unitCost
    return {
      id: generateId(),
      ingredientId: realIdByDraftId.get(demoIngredient.id) || null,
      name: demoIngredient.name.trim(),
      category: DEMO_CATEGORY,
      quantity: line.quantity,
      unit: DEMO_UNIT,
      measure: DEMO_UNIT,
      cost: extension,
      unitCost,
      costPerMeasure: unitCost,
      extension,
      originalIndex: index,
    }
  })

  const totalCost = recipeIngredients.reduce((sum, ing) => sum + (ing.extension || 0), 0)

  await saveRecipe(
    {
      id: generateId(),
      name: draft.dishName.trim() || "Mi primera receta",
      classification: DEMO_CLASSIFICATION,
      plate: "INDIVIDUAL",
      servings: 1,
      yieldAmount: 1,
      yieldUnit: "porciones",
      ingredients: recipeIngredients,
      procedure: [],
      totalCost,
      costPerServing: totalCost,
      unitPrice: draft.salePrice > 0 ? draft.salePrice : undefined,
      pricingConfig: defaultPricingConfig,
      businessId: "main",
      metadata: { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), version: 1 },
    },
    "main",
  )

  clearLandingDemoDraft()
  return true
}
