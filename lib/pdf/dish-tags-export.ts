/**
 * Datos de etiquetas de plato para un PDF (docs/324): las etiquetas de cada receta y los PNG de
 * los íconos que se usan, en el color del negocio. Lo llaman la ventana del PDF de la Ficha y la
 * de Menús, así las dos exportan igual.
 */

import { dishLabels } from "@/lib/diet"
import { dishTags, type DishLabelMode, type DishTag } from "@/lib/dish-tags"
import { dietIconPngs } from "@/lib/diet-icons"
import { getBusinessThemeRgb } from "@/lib/theme-colors"
import type { IconPngs } from "./dish-tags-pdf"
import type { Ingredient } from "@/types/ingredient"
import type { Recipe } from "@/types/recipe"
import type { TranslationKey } from "@/lib/i18n/translations"

export async function pdfDishData(
  targets: Recipe[],
  ingredients: Ingredient[],
  allRecipes: Recipe[],
  t: (key: TranslationKey) => string,
  mode: DishLabelMode,
  businessId?: string,
): Promise<{ tagsByRecipeId: Record<string, DishTag[]>; icons: IconPngs }> {
  const tagsByRecipeId: Record<string, DishTag[]> = {}
  for (const r of targets) tagsByRecipeId[r.id] = dishTags(dishLabels(r, ingredients, allRecipes), t)
  let icons: IconPngs = {}
  if (mode === "icons" || mode === "both") {
    const keys = Object.values(tagsByRecipeId).flatMap((tags) => tags.map((x) => x.key))
    icons = await dietIconPngs(keys, getBusinessThemeRgb(businessId) as [number, number, number])
  }
  return { tagsByRecipeId, icons }
}
