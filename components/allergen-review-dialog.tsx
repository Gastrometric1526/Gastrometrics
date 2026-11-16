"use client"

/**
 * Revisar alérgenos sugeridos de todos los ingredientes de una vez (docs/324). La lista sale de
 * `pendingSuggestions` (categoría y nombre); la persona quita lo que no aplique y guarda. Nada se
 * marca sin que toque «Guardar». No es obligatorio: «Ahora no» cierra y el aviso sigue en
 * Ingredientes hasta que no quede nada por revisar.
 */

import { useMemo, useState } from "react"
import { allergenLabelKey, type AllergenKey } from "@/lib/allergens"
import { pendingSuggestions } from "@/lib/allergen-suggest"
import { updateIngredient } from "@/lib/storage/ingredients"
import { DietIcon } from "@/components/icons/diet-icon"
import { useSuggestionReason } from "@/components/ingredient-allergen-fields"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useLanguage } from "@/contexts/language-context"
import { useToast } from "@/hooks/use-toast"
import type { Ingredient } from "@/types/ingredient"
import { cn } from "@/lib/utils"

/** Ingredientes con algo sugerido que todavía no tienen marcado. */
export function ingredientsWithSuggestions(list: Ingredient[]) {
  return list
    .filter((i) => !i.recipeId && !i.recipeData)
    .map((i) => ({ ingredient: i, suggestions: pendingSuggestions(i) }))
    .filter((x) => x.suggestions.length > 0)
}

export function AllergenReviewBanner({ ingredients, onOpen, className }: { ingredients: Ingredient[]; onOpen: () => void; className?: string }) {
  const { t } = useLanguage()
  const n = useMemo(() => ingredientsWithSuggestions(ingredients).length, [ingredients])
  if (n === 0) return null
  return (
    <div className={cn("flex flex-col gap-3 rounded-lg border border-info/40 bg-info-soft p-4 sm:flex-row sm:items-center sm:justify-between", className)} data-tour="ing-allergen-review">
      <div className="flex items-start gap-3">
        <DietIcon k="allergen_free" className="mt-0.5 h-6 w-6 text-primary" />
        <div>
          <p className="text-sm font-semibold">{t("allergen_review_banner_title").replace("{n}", String(n))}</p>
          <p className="text-xs text-muted-foreground">{t("allergen_review_banner_desc")}</p>
        </div>
      </div>
      <Button onClick={onOpen} className="min-h-[40px] w-full sm:w-auto">
        {t("allergen_review_open")}
      </Button>
    </div>
  )
}

export function AllergenReviewDialog({
  open,
  onOpenChange,
  ingredients,
  businessId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  ingredients: Ingredient[]
  businessId?: string | null
}) {
  const { t } = useLanguage()
  const { toast } = useToast()
  const reason = useSuggestionReason()
  const rows = useMemo(() => ingredientsWithSuggestions(ingredients), [ingredients])
  // Lo que se va a guardar: id → claves marcadas. Empieza con todo lo sugerido; se puede quitar.
  const [picked, setPicked] = useState<Record<string, AllergenKey[]>>({})
  const [saving, setSaving] = useState(false)
  const keysOf = (id: string, fallback: AllergenKey[]) => picked[id] ?? fallback

  const save = async () => {
    setSaving(true)
    let changed = 0
    try {
      for (const { ingredient, suggestions } of rows) {
        const keys = keysOf(ingredient.id, suggestions.map((s) => s.key))
        if (keys.length === 0) continue
        await updateIngredient(ingredient.id, { allergens: [...new Set([...(ingredient.allergens || []), ...keys])] }, businessId)
        changed++
      }
      toast({ title: t("allergen_review_saved").replace("{n}", String(changed)) })
      setPicked({})
      onOpenChange(false)
    } catch {
      toast({ title: t("allergen_review_error"), variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("allergen_review_title")}</DialogTitle>
          <DialogDescription>{t("allergen_review_desc")}</DialogDescription>
        </DialogHeader>
        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t("allergen_review_empty")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map(({ ingredient, suggestions }) => {
              const keys = keysOf(ingredient.id, suggestions.map((s) => s.key))
              return (
                <li key={ingredient.id} className="space-y-2 py-3">
                  <p className="text-sm font-semibold">{ingredient.name}</p>
                  {suggestions.map((s) => {
                    const id = `rev-${ingredient.id}-${s.key}`
                    return (
                      <label key={s.key} htmlFor={id} className="flex min-h-[36px] cursor-pointer items-center gap-3">
                        <Checkbox
                          id={id}
                          checked={keys.includes(s.key)}
                          onCheckedChange={(v) =>
                            setPicked((p) => ({ ...p, [ingredient.id]: v ? [...keys, s.key] : keys.filter((k) => k !== s.key) }))
                          }
                        />
                        <DietIcon k={s.key} className="h-5 w-5 text-primary" />
                        <span className="text-sm">{t(allergenLabelKey(s.key))}</span>
                        <span className="text-xs text-muted-foreground">{reason(s)}</span>
                      </label>
                    )
                  })}
                </li>
              )
            })}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">{t("allergen_suggest_note")}</p>
        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("allergen_review_later")}
          </Button>
          {rows.length > 0 && (
            <Button onClick={save} disabled={saving}>
              {t("allergen_review_save")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
