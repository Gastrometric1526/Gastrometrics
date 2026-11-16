/**
 * Etiquetas de un plato para mostrar y exportar (docs/324): lo confirmado (vegano, vegetariano,
 * sin gluten, sin alérgenos), las proteínas, los alérgenos heredados y las trazas declaradas.
 * Sale de `dishLabels` (lib/diet.ts), así pantalla, ficha, menú y carta dicen lo mismo.
 *
 * Cómo se muestran al exportar lo elige la persona: íconos, texto, los dos o nada
 * (`DishLabelMode`, recordado en el aparato).
 */

import { allergenLabelKey, type AllergenKey } from "@/lib/allergens"
import type { DishLabels, Protein } from "@/lib/diet"
import type { DietIconKey } from "@/lib/diet-icons"
import type { TranslationKey } from "@/lib/i18n/translations"

export type DishTagKind = "claim" | "protein" | "allergen" | "trace"

export interface DishTag {
  key: DietIconKey
  kind: DishTagKind
  text: string
}

export const DISH_LABEL_MODES = ["both", "icons", "text", "none"] as const
export type DishLabelMode = (typeof DISH_LABEL_MODES)[number]

const MODE_KEY = "gm-dish-label-mode"

export function proteinLabelKey(p: Protein): `protein_${Protein}` {
  return `protein_${p}`
}

/** Todas las etiquetas del plato, en orden: confirmado → proteínas → alérgenos → trazas. */
export function dishTags(labels: DishLabels, t: (key: TranslationKey) => string): DishTag[] {
  const out: DishTag[] = []
  const c = labels.claims
  if (c.vegan) out.push({ key: "vegan", kind: "claim", text: t("diet_vegan") })
  else if (c.vegetarian) out.push({ key: "vegetarian", kind: "claim", text: t("diet_vegetarian") })
  if (c.allergenFree) out.push({ key: "allergen_free", kind: "claim", text: t("diet_allergen_free") })
  else if (c.glutenFree) out.push({ key: "gluten_free", kind: "claim", text: t("diet_gluten_free") })
  for (const p of labels.proteins) out.push({ key: p, kind: "protein", text: t(proteinLabelKey(p)) })
  for (const a of labels.allergens) out.push({ key: a, kind: "allergen", text: t(allergenLabelKey(a)) })
  if (labels.mayContain.length > 0) {
    const list = labels.mayContain.map((a: AllergenKey) => t(allergenLabelKey(a))).join(", ")
    out.push({ key: "may_contain", kind: "trace", text: t("diet_may_contain").replace("{list}", list) })
  }
  return out
}

export function readDishLabelMode(): DishLabelMode {
  try {
    const v = localStorage.getItem(MODE_KEY)
    if (v && (DISH_LABEL_MODES as readonly string[]).includes(v)) return v as DishLabelMode
  } catch {}
  return "both"
}

export function saveDishLabelMode(mode: DishLabelMode): void {
  try {
    localStorage.setItem(MODE_KEY, mode)
  } catch {}
}
