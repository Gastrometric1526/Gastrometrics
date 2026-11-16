"use client"

/**
 * «Alérgenos y tipo de plato» en la Ficha Técnica (docs/137, docs/324).
 * - Alérgenos y proteínas: se heredan de los ingredientes y subrecetas (con de dónde viene cada uno).
 * - Vegano, vegetariano, sin gluten y sin alérgenos: los CONFIRMA la persona, y solo se pueden
 *   marcar si los ingredientes no dicen lo contrario (`validClaims`). Ej.: harina de arroz sin
 *   gluten marcado → el plato puede declararse «sin gluten».
 * - «Puede contener trazas de…»: contacto cruzado en la cocina, a mano.
 * Nada es obligatorio, pero se recomienda: es lo que ve el cliente en la carta y en la ficha.
 */

import { useMemo } from "react"
import { ALLERGENS, allergenLabelKey, getRecipeAllergens, type AllergenKey } from "@/lib/allergens"
import { dishLabels, type DietClaims } from "@/lib/diet"
import { dishTags, proteinLabelKey } from "@/lib/dish-tags"
import { DietIcon } from "@/components/icons/diet-icon"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { useLanguage } from "@/contexts/language-context"
import { cn } from "@/lib/utils"
import type { Ingredient } from "@/types/ingredient"
import type { Recipe } from "@/types/recipe"

type ClaimKey = "vegan" | "vegetarian" | "glutenFree" | "allergenFree"
const CLAIMS: { key: ClaimKey; icon: "vegan" | "vegetarian" | "gluten_free" | "allergen_free"; label: "diet_vegan" | "diet_vegetarian" | "diet_gluten_free" | "diet_allergen_free" }[] = [
  { key: "vegetarian", icon: "vegetarian", label: "diet_vegetarian" },
  { key: "vegan", icon: "vegan", label: "diet_vegan" },
  { key: "glutenFree", icon: "gluten_free", label: "diet_gluten_free" },
  { key: "allergenFree", icon: "allergen_free", label: "diet_allergen_free" },
]

export function DishLabelsSection({
  recipe,
  ingredients,
  recipes,
  onChange,
}: {
  recipe: Recipe
  ingredients: Ingredient[]
  recipes: Recipe[]
  onChange: (claims: DietClaims | undefined) => void
}) {
  const { t } = useLanguage()
  const labels = useMemo(() => dishLabels(recipe, ingredients, recipes), [recipe, ingredients, recipes])
  const claims = recipe.dietClaims ?? {}
  const traces = claims.mayContain ?? []

  // De qué ingredientes (o subrecetas) viene cada alérgeno, para que se pueda comprobar.
  const sourcesOf = useMemo(() => {
    const byId = new Map(ingredients.map((i) => [i.id, i]))
    return (key: AllergenKey) =>
      [
        ...new Set(
          (recipe.ingredients || [])
            .map((l) => (l.ingredientId ? byId.get(l.ingredientId) : undefined))
            .filter((i): i is Ingredient => {
              if (!i) return false
              if ((i.allergens || []).includes(key)) return true
              const subId = i.recipeId || i.recipeData?.originalRecipeId
              const sub = subId ? recipes.find((r) => r.id === subId) : undefined
              return !!sub && getRecipeAllergens(sub, ingredients, recipes).includes(key)
            })
            .map((i) => i.name),
        ),
      ]
  }, [recipe.ingredients, ingredients, recipes])

  // Por qué no se puede marcar cada declaración (si no se puede).
  const blocked = (key: ClaimKey): string | null => {
    const d = labels.diet
    if (key === "vegetarian" && !d.vegetarian) return t("diet_blocked_meat").replace("{list}", d.meatFrom.join(", "))
    if (key === "vegan" && !d.vegan) return t("diet_blocked_animal").replace("{list}", [...d.meatFrom, ...d.animalFrom].join(", "))
    if (key === "glutenFree" && (labels.allergens.includes("gluten") || traces.includes("gluten")))
      return t("diet_blocked_gluten").replace("{list}", sourcesOf("gluten").join(", ") || t("diet_traces_short"))
    if (key === "allergenFree" && (labels.allergens.length > 0 || traces.length > 0)) return t("diet_blocked_allergens")
    return null
  }

  const setClaim = (key: ClaimKey, on: boolean) => {
    const next: DietClaims = { ...claims, [key]: on || undefined }
    if (key === "vegan" && on) next.vegetarian = true
    clean(next)
  }
  const toggleTrace = (key: AllergenKey) => clean({ ...claims, mayContain: traces.includes(key) ? traces.filter((k) => k !== key) : [...traces, key] })
  const clean = (c: DietClaims) => {
    const out: DietClaims = {}
    if (c.vegan) out.vegan = true
    if (c.vegetarian) out.vegetarian = true
    if (c.glutenFree) out.glutenFree = true
    if (c.allergenFree) out.allergenFree = true
    if (c.mayContain && c.mayContain.length) out.mayContain = ALLERGENS.filter((k) => c.mayContain!.includes(k))
    onChange(Object.keys(out).length ? out : undefined)
  }

  const preview = dishTags(labels, t)

  return (
    <Card className="w-full mx-auto" data-tour="ficha-dish-labels">
      <CardContent className="space-y-5 px-3 pt-6 sm:px-6">
        <div>
          <h3 className="text-base font-semibold">{t("dish_labels_title")}</h3>
          <p className="text-xs text-muted-foreground">{t("dish_labels_recommended")}</p>
        </div>

        {/* Lo que viene de los ingredientes */}
        <section className="space-y-2">
          <h4 className="text-sm font-medium">{t("allergens_label")}</h4>
          {labels.allergens.length > 0 ? (
            <ul className="space-y-1.5">
              {labels.allergens.map((key) => (
                <li key={key} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-soft px-3 py-1 text-xs font-medium text-warning">
                    <DietIcon k={key} className="h-3.5 w-3.5" />
                    {t(allergenLabelKey(key))}
                  </span>
                  <span className="text-xs text-muted-foreground">{t("dish_labels_from").replace("{list}", sourcesOf(key).join(", "))}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">{t("allergens_recipe_none")}</p>
          )}
          <p className="text-xs text-muted-foreground">{t("allergens_recipe_hint")}</p>
        </section>

        <section className="space-y-2">
          <h4 className="text-sm font-medium">{t("dish_labels_type")}</h4>
          <div className="flex flex-wrap gap-2">
            {labels.proteins.map((p) => (
              <span key={p} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs">
                <DietIcon k={p} className="h-4 w-4 text-primary" />
                {t(proteinLabelKey(p))}
              </span>
            ))}
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
              {labels.diet.vegan ? t("dish_labels_auto_vegan") : labels.diet.vegetarian ? t("dish_labels_auto_vegetarian") : t("dish_labels_auto_meat")}
            </span>
          </div>
        </section>

        {/* Lo que confirma la persona */}
        <section className="space-y-2">
          <h4 className="text-sm font-medium">{t("dish_labels_confirm")}</h4>
          <p className="text-xs text-muted-foreground">{t("dish_labels_confirm_hint")}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {CLAIMS.map((c) => {
              const why = blocked(c.key)
              const checked = !!claims[c.key] && !why
              const id = `claim-${c.key}`
              return (
                <label
                  key={c.key}
                  htmlFor={id}
                  className={cn("flex min-h-[44px] items-start gap-3 rounded-lg border border-border p-3", why ? "opacity-70" : "cursor-pointer hover:bg-muted/50")}
                >
                  <Checkbox id={id} checked={checked} disabled={!!why} onCheckedChange={(v) => setClaim(c.key, !!v)} className="mt-0.5" />
                  <span className="space-y-0.5">
                    <span className="flex items-center gap-1.5 text-sm font-medium">
                      <DietIcon k={c.icon} className="h-4 w-4 text-primary" />
                      {t(c.label)}
                    </span>
                    {why && <span className="block text-xs text-muted-foreground">{why}</span>}
                    {!why && claims[c.key] === undefined && (c.key === "glutenFree" || c.key === "allergenFree") && (
                      <span className="block text-xs text-muted-foreground">{t("dish_labels_check_kitchen")}</span>
                    )}
                  </span>
                </label>
              )
            })}
          </div>
        </section>

        <section className="space-y-2">
          <h4 className="text-sm font-medium">{t("dish_labels_traces")}</h4>
          <p className="text-xs text-muted-foreground">{t("dish_labels_traces_hint")}</p>
          <div className="flex flex-wrap gap-2" role="group" aria-label={t("dish_labels_traces")}>
            {ALLERGENS.filter((k) => !labels.allergens.includes(k)).map((key) => {
              const on = traces.includes(key)
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleTrace(key)}
                  className={cn(
                    "inline-flex min-h-[32px] items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors",
                    on ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted",
                  )}
                >
                  <DietIcon k={key} className="h-3.5 w-3.5" />
                  {t(allergenLabelKey(key))}
                </button>
              )
            })}
          </div>
        </section>

        {preview.length > 0 && (
          <section className="space-y-2 rounded-lg bg-muted/40 p-3">
            <h4 className="text-xs font-medium text-muted-foreground">{t("dish_labels_preview")}</h4>
            <div className="flex flex-wrap gap-x-3 gap-y-1.5">
              {preview.map((tag) => (
                <span key={`${tag.kind}-${tag.key}`} className="inline-flex items-center gap-1 text-xs">
                  <DietIcon k={tag.key} className="h-4 w-4 text-primary" />
                  {tag.text}
                </span>
              ))}
            </div>
          </section>
        )}
      </CardContent>
    </Card>
  )
}
