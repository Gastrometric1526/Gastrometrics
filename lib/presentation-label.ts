/**
 * Cómo se lee la presentación en una orden de compra (pedido del dueño, docs/323): con su
 * contenido neto, «3 latas de 500 ml», no solo «3 latas». Lo usan la pantalla de la orden, el
 * PDF y el texto para WhatsApp o correo, para que digan lo mismo.
 *
 * El contenido es el FÍSICO del envase (`originalNetContent`, o `pricing.netContent` si no hay
 * merma), igual que lib/utils/presentation-quantity.ts: con merma, el aprovechable es menor y no
 * es lo que trae la lata.
 */

import { getPresentationLabel } from "@/lib/ingredient-labels"
import type { LanguageCode } from "@/lib/i18n/translations"
import type { Ingredient } from "@/types/ingredient"
import { unitAbbreviations } from "@/types/ingredient"

export interface PackageInfo {
  content: number
  unit: string
}

type IngredientLike = Pick<Ingredient, "id" | "name" | "unit"> & { originalNetContent?: number; pricing?: { netContent?: number } }

/** Contenido del envase de una línea: el guardado en la línea o, si no, el de su ingrediente. */
export function packageOf(
  item: { ingredientId?: string | null; name?: string; ingredientName?: string; packageContent?: number | null; packageUnit?: string | null },
  ingredients: IngredientLike[] = [],
): PackageInfo | null {
  if (item.packageContent && item.packageContent > 0 && item.packageUnit) return { content: item.packageContent, unit: item.packageUnit }
  const name = (item.name || item.ingredientName || "").trim().toLowerCase()
  const ing =
    (item.ingredientId ? ingredients.find((i) => i.id === item.ingredientId) : undefined) ??
    (name ? ingredients.find((i) => i.name.trim().toLowerCase() === name) : undefined)
  const content = ing?.originalNetContent || ing?.pricing?.netContent
  return ing && content && content > 0 ? { content, unit: ing.unit } : null
}

const fmt = (n: number) => String(Math.round(n * 1000) / 1000)

/** «500 ml», «1.5 kg», «12 un». */
export function packageContentLabel(pkg: PackageInfo): string {
  return `${fmt(pkg.content)} ${unitAbbreviations[pkg.unit] || pkg.unit}`
}

/**
 * «3 latas de 500 ml» (o «Lata de 500 ml» sin cantidad). Sin contenido conocido, como antes:
 * «3 latas».
 */
export function presentationText(quantity: number | null | undefined, presentation: string, pkg: PackageInfo | null, language: LanguageCode): string {
  const label = getPresentationLabel(presentation, language)
  const plural = ["es", "en", "fr", "pt"].includes(language) && quantity != null && quantity !== 1 && !/s$/i.test(label) ? "s" : ""
  const name = quantity != null ? `${fmt(quantity)} ${language === "zh" ? label : label.toLowerCase()}${plural}` : label
  if (!pkg) return name
  const content = packageContentLabel(pkg)
  switch (language) {
    case "en":
      return `${name} of ${content}`
    case "da":
      return `${name} à ${content}`
    case "zh":
      return `${name}（每${label} ${content}）`
    default:
      return `${name} de ${content}`
  }
}
