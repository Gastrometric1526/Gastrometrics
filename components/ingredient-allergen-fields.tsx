"use client"

/**
 * Alérgenos y tipo de un ingrediente (docs/137, docs/324). Muestra lo que la app SUGIERE por la
 * categoría o el nombre, con el porqué, y la persona lo agrega con un toque: nunca se marca solo.
 * Marcarlos no es obligatorio, pero se recomienda (las recetas los heredan). Debajo, el tipo
 * (automático, vegetal, producto animal o carne) por si la categoría no lo dice bien.
 */

import { ALLERGENS, allergenLabelKey, type AllergenKey } from "@/lib/allergens"
import { pendingSuggestions, type AllergenSuggestion } from "@/lib/allergen-suggest"
import { ingredientDiet, type DietOverride } from "@/lib/diet"
import { proteinLabelKey } from "@/lib/dish-tags"
import { getCategoryLabel } from "@/lib/ingredient-labels"
import { DietIcon } from "@/components/icons/diet-icon"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { useLanguage } from "@/contexts/language-context"
import { cn } from "@/lib/utils"
import type { Ingredient } from "@/types/ingredient"

type Value = Pick<Partial<Ingredient>, "name" | "category" | "allergens" | "dietOverride">

export function useSuggestionReason() {
  const { t, language } = useLanguage()
  return (s: AllergenSuggestion) =>
    s.reason.kind === "category"
      ? t("allergen_suggest_by_category").replace("{category}", getCategoryLabel(s.reason.category as never, language))
      : t("allergen_suggest_by_name").replace("{word}", s.reason.word)
}

export function IngredientAllergenFields({ value, onChange }: { value: Value; onChange: (patch: Partial<Value>) => void }) {
  const { t } = useLanguage()
  const reason = useSuggestionReason()
  const selected = value.allergens || []
  const pending = value.name ? pendingSuggestions({ name: value.name, category: value.category, allergens: selected }) : []
  const toggle = (key: AllergenKey) => onChange({ allergens: selected.includes(key) ? selected.filter((a) => a !== key) : [...selected, key] })
  const add = (keys: AllergenKey[]) => onChange({ allergens: [...new Set([...selected, ...keys])] })
  const auto = ingredientDiet({ name: value.name || "", category: value.category as never, allergens: selected })
  const autoText = auto.protein ? t(proteinLabelKey(auto.protein)) : auto.animalProduct ? t("diet_type_animal_product") : t("diet_type_plant")
  const overrides: (DietOverride | "auto")[] = ["auto", "plant", "animal_product", "meat"]

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-foreground font-medium">{t("allergens_label")}</Label>
        <p className="text-xs text-muted-foreground">{t("allergens_ingredient_hint_v2")}</p>

        {pending.length > 0 && (
          <div className="space-y-2 rounded-lg border border-warning/40 bg-warning-soft p-3" data-testid="allergen-suggestions">
            <p className="text-sm font-medium">{t("allergen_suggest_title")}</p>
            <ul className="space-y-1.5">
              {pending.map((s) => (
                <li key={s.key} className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-sm">
                    <DietIcon k={s.key} className="h-5 w-5 text-primary" />
                    <span className="font-medium">{t(allergenLabelKey(s.key))}</span>
                    <span className="text-xs text-muted-foreground">{reason(s)}</span>
                  </span>
                  <Button type="button" size="sm" variant="outline" className="min-h-[36px]" onClick={() => add([s.key])}>
                    {t("allergen_suggest_add")}
                  </Button>
                </li>
              ))}
            </ul>
            {pending.length > 1 && (
              <Button type="button" size="sm" className="min-h-[36px]" onClick={() => add(pending.map((s) => s.key))}>
                {t("allergen_suggest_add_all")}
              </Button>
            )}
            <p className="text-xs text-muted-foreground">{t("allergen_suggest_note")}</p>
          </div>
        )}

        <div className="flex flex-wrap gap-2" role="group" aria-label={t("allergens_label")}>
          {ALLERGENS.map((key) => {
            const on = selected.includes(key)
            return (
              <button
                key={key}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(key)}
                className={cn(
                  "inline-flex min-h-[32px] items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors",
                  on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-transparent text-foreground hover:bg-muted",
                )}
              >
                <DietIcon k={key} className="h-3.5 w-3.5" />
                {t(allergenLabelKey(key))}
              </button>
            )
          })}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-foreground font-medium">{t("diet_type_label")}</Label>
        <p className="text-xs text-muted-foreground">{t("diet_type_hint")}</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label={t("diet_type_label")}>
          {overrides.map((o) => {
            const on = (value.dietOverride ?? "auto") === o
            return (
              <button
                key={o}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => onChange({ dietOverride: o === "auto" ? undefined : o })}
                className={cn(
                  "min-h-[44px] rounded-lg border-2 px-2 py-1.5 text-left text-xs transition-colors",
                  on ? "border-primary bg-primary/5 font-medium" : "border-border hover:border-primary/50",
                )}
              >
                <span className="block text-sm">{t(`diet_type_${o}` as const)}</span>
                {o === "auto" && <span className="block text-muted-foreground">{autoText}</span>}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
