"use client"

/**
 * Ingrediente y receta de ejemplo, editable/borrable, para que quien recién se
 * registra vea el cálculo de costo/margen funcionando sin tener que escribir nada
 * primero (ver referencia-estrategia-crecimiento-y-psicologia-del-usuario.md, sección
 * 1 — "considerar una receta de ejemplo pre-cargada"). Decisión de producto confirmada
 * por el dueño del proyecto antes de implementarse.
 *
 * Deliberadamente NO llama a logActivity: si el guardado de esta receta contara como
 * "recetas creadas" en activity_log, inflaría la tasa de activación real que mide
 * app/api/admin/activation/route.ts con cuentas que nunca tocaron nada — el punto de
 * ese panel es medir qué hace la gente, no lo que el sistema le regala.
 *
 * Se dispara solo a pedido (botón "Ver un ejemplo primero" en el estado vacío del
 * dashboard, app/dashboard/page.tsx; o el botón "Cargar plato de ejemplo" al terminar
 * de crear un negocio nuevo, components/add-business-dialog.tsx) — nunca en segundo
 * plano al cargar la página, para no escribir datos sin que el usuario lo haya pedido.
 */

import { addIngredient } from "@/lib/storage/ingredients"
import { saveRecipe, getRecipeById } from "@/lib/storage/recipes"
import { defaultPricingConfig } from "@/types/recipe"
import type { Ingredient } from "@/types/ingredient"
import type { Recipe, RecipeIngredient } from "@/types/recipe"
import type { LanguageCode } from "@/lib/i18n/translations"

interface SeedContent {
  chickenName: string
  oilName: string
  supplier: string
  recipeName: string
  steps: string[]
}

const SEED_CONTENT: Record<LanguageCode, SeedContent> = {
  es: {
    chickenName: "Pechuga de pollo (ejemplo)",
    oilName: "Aceite vegetal (ejemplo)",
    supplier: "Proveedor de ejemplo",
    recipeName: "Ejemplo: Pollo a la plancha",
    steps: [
      "Sazonar la pechuga de pollo con sal y pimienta.",
      "Cocinar a la plancha 6-7 minutos por lado hasta dorar.",
    ],
  },
  en: {
    chickenName: "Chicken breast (example)",
    oilName: "Vegetable oil (example)",
    supplier: "Example supplier",
    recipeName: "Example: Grilled chicken breast",
    steps: ["Season the chicken breast with salt and pepper.", "Grill 6-7 minutes per side until golden."],
  },
  da: {
    chickenName: "Kyllingebryst (eksempel)",
    oilName: "Vegetabilsk olie (eksempel)",
    supplier: "Eksempel-leverandør",
    recipeName: "Eksempel: Grillet kyllingebryst",
    steps: [
      "Krydr kyllingebrystet med salt og peber.",
      "Steg på panden 6-7 minutter på hver side, til det er gyldent.",
    ],
  },
  fr: {
    chickenName: "Blanc de poulet (exemple)",
    oilName: "Huile végétale (exemple)",
    supplier: "Fournisseur d'exemple",
    recipeName: "Exemple : poulet grillé",
    steps: [
      "Assaisonner le blanc de poulet avec sel et poivre.",
      "Cuire à la poêle 6-7 minutes de chaque côté jusqu'à coloration dorée.",
    ],
  },
  pt: {
    chickenName: "Peito de frango (exemplo)",
    oilName: "Óleo vegetal (exemplo)",
    supplier: "Fornecedor de exemplo",
    recipeName: "Exemplo: frango grelhado",
    steps: ["Tempere o peito de frango com sal e pimenta.", "Grelhe por 6-7 minutos de cada lado até dourar."],
  },
  zh: {
    chickenName: "鸡胸肉（示例）",
    oilName: "植物油（示例）",
    supplier: "示例供应商",
    recipeName: "示例：煎鸡胸肉",
    steps: ["用盐和胡椒给鸡胸肉调味。", "每面煎 6-7 分钟至金黄色。"],
  },
}

const EXAMPLE_RECIPE_ID_KEY_PREFIX = "example_recipe_id_"

/**
 * Devuelve el id de la receta de ejemplo de esta cuenta, creándola si hace falta.
 * Idempotente: si ya existe (guardada la última vez en localStorage, y todavía viva en
 * la caché), la reutiliza en vez de duplicarla; si el usuario la borró, crea una nueva.
 *
 * `businessId` es opcional (por defecto `null`, el workspace "main" que ya usaba el
 * dashboard principal) — pasar el id real de un negocio recién creado siembra el
 * ejemplo DENTRO de ese negocio en vez de en "main", con su propia bandera de
 * idempotencia en localStorage (un negocio nuevo no debe heredar el "ya lo vi" de otro).
 */
export async function getOrSeedExampleRecipe(
  userId: string,
  language: LanguageCode,
  businessId: string | null = null,
): Promise<string> {
  const key = `${EXAMPLE_RECIPE_ID_KEY_PREFIX}${userId}_${businessId ?? "main"}`
  const storedId = typeof window !== "undefined" ? localStorage.getItem(key) : null
  if (storedId && getRecipeById(storedId, businessId)) {
    return storedId
  }

  const content = SEED_CONTENT[language] || SEED_CONTENT.es
  const now = new Date().toISOString()

  const chicken: Ingredient = {
    id: crypto.randomUUID(),
    name: content.chickenName,
    category: "AVES",
    unit: "kilogramos",
    pricing: { purchasePrice: 120, netContent: 1, pricePerUnit: 120, lastUpdated: now },
    supplier: content.supplier,
    metadata: { createdAt: now, updatedAt: now, version: 1 },
  }
  const oil: Ingredient = {
    id: crypto.randomUUID(),
    name: content.oilName,
    category: "ACEITES",
    unit: "litros",
    pricing: { purchasePrice: 80, netContent: 1, pricePerUnit: 80, lastUpdated: now },
    supplier: content.supplier,
    metadata: { createdAt: now, updatedAt: now, version: 1 },
  }

  const savedChicken = await addIngredient(chicken, businessId)
  const savedOil = await addIngredient(oil, businessId)

  const recipeIngredients: RecipeIngredient[] = [
    {
      id: crypto.randomUUID(),
      ingredientId: savedChicken.id,
      name: savedChicken.name,
      category: savedChicken.category,
      quantity: 0.2,
      unit: savedChicken.unit,
      measure: "kg",
      cost: 24,
      unitCost: 120,
      costPerMeasure: 120,
      extension: 24,
      originalIndex: 0,
    },
    {
      id: crypto.randomUUID(),
      ingredientId: savedOil.id,
      name: savedOil.name,
      category: savedOil.category,
      quantity: 0.02,
      unit: savedOil.unit,
      measure: "L",
      cost: 1.6,
      unitCost: 80,
      costPerMeasure: 80,
      extension: 1.6,
      originalIndex: 1,
    },
  ]

  const ingredientsCost = 25.6

  const recipe: Recipe = {
    id: crypto.randomUUID(),
    name: content.recipeName,
    classification: "Carnes y asados (Rôtisseur)",
    plate: "INDIVIDUAL",
    servings: 1,
    yieldAmount: 1,
    yieldUnit: "unidad",
    ingredients: recipeIngredients,
    procedure: content.steps,
    totalCost: ingredientsCost,
    costPerServing: ingredientsCost,
    ingredientsCost,
    pricingConfig: defaultPricingConfig,
    publicServices: defaultPricingConfig.publicServices,
    marketing: defaultPricingConfig.marketing,
    operationalCosts: defaultPricingConfig.operationalCosts,
    laborCosts: defaultPricingConfig.laborCosts,
    isv: defaultPricingConfig.isv,
    contributionMargin: defaultPricingConfig.netProfit,
    businessId: businessId ?? "main",
    metadata: { createdAt: now, updatedAt: now, version: 1 },
  }

  const savedRecipe = await saveRecipe(recipe, businessId)
  if (typeof window !== "undefined") localStorage.setItem(key, savedRecipe.id)
  return savedRecipe.id
}
