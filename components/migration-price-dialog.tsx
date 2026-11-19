"use client"

/**
 * Precio de las recetas que llegan a un negocio (pedido del dueño, docs/341). Se abre con el
 * evento MIGRATION_PRICE_EVENT ({ businessId, recipeIds }) que mandan las migraciones (una
 * receta desde Mis Recetas o varias desde «Trae lo que ya tienes»). Lista las recetas cuyo
 * precio cambia en el negocio y deja elegir, una por una o todas, entre el precio que traían
 * y el que sugiere el negocio. Explica de dónde sale el sugerido (costo fijo por plato).
 * Lógica pura: lib/migration-price.ts.
 */

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/contexts/language-context"
import { useToast } from "@/hooks/use-toast"
import { formatCurrency } from "@/lib/currency"
import { cn } from "@/lib/utils"
import { ensureRecipesLoaded, getRecipes, saveRecipes } from "@/lib/storage/recipes"
import { getBusinessById } from "@/lib/storage/businesses"
import { pricingContextFor } from "@/lib/recalculate"
import { getDefaultPricingPercentages } from "@/lib/pricing-percentages"
import { MIGRATION_PRICE_EVENT, migrationPricePatch, migrationPriceRows, type MigrationPriceRow } from "@/lib/migration-price"
import { calculateTotalMonthlyExpenses, fixedCostPerPlateOf } from "@/types/business"

type Choice = "business" | "mine"

export function MigrationPriceDialog() {
  const { t } = useLanguage()
  const { toast } = useToast()
  const [review, setReview] = useState<{ businessId: string; rows: MigrationPriceRow[] } | null>(null)
  const [choices, setChoices] = useState<Record<string, Choice>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const onReview = async (event: Event) => {
      const detail = (event as CustomEvent<{ businessId?: string; recipeIds?: string[] }>).detail
      const businessId = detail?.businessId
      if (!businessId || !detail?.recipeIds?.length) return
      await ensureRecipesLoaded(businessId).catch(() => {})
      const ids = new Set(detail.recipeIds)
      const recipes = getRecipes(businessId).filter((r) => ids.has(r.id))
      const rows = migrationPriceRows(recipes, getDefaultPricingPercentages(businessId), pricingContextFor(businessId))
      if (rows.length === 0) return
      setChoices(Object.fromEntries(rows.map((r) => [r.recipeId, "business" as Choice])))
      setReview({ businessId, rows })
    }
    window.addEventListener(MIGRATION_PRICE_EVENT, onReview)
    return () => window.removeEventListener(MIGRATION_PRICE_EVENT, onReview)
  }, [])

  if (!review) return null
  const business = getBusinessById(review.businessId)
  const fixedCost = fixedCostPerPlateOf(business)

  const setAll = (choice: Choice) => setChoices(Object.fromEntries(review.rows.map((r) => [r.recipeId, choice])))

  const save = async () => {
    setSaving(true)
    try {
      const defaults = getDefaultPricingPercentages(review.businessId)
      const ctx = pricingContextFor(review.businessId)
      const all = getRecipes(review.businessId)
      const next = all.map((r) => (choices[r.id] ? migrationPricePatch(r, choices[r.id], defaults, ctx) : r))
      await saveRecipes(next, review.businessId)
      window.dispatchEvent(new CustomEvent("recipesUpdated", { detail: { businessId: review.businessId, action: "updated" } }))
      toast({ title: t("migprice_saved") })
      setReview(null)
    } catch {
      toast({ title: t("migprice_error"), variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !saving && setReview(null)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("migprice_title").replace("{name}", business?.name ?? "")}</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>{t("migprice_desc")}</p>
              {fixedCost > 0 && business?.expenses && (
                <p className="rounded-md bg-muted/60 p-2 text-xs">
                  {t("migprice_fixed_cost")
                    .replace("{expenses}", formatCurrency(calculateTotalMonthlyExpenses(business.expenses)))
                    .replace("{plates}", String(business.estimatedMonthlyPlates ?? 0))
                    .replace("{perPlate}", formatCurrency(fixedCost))}
                </p>
              )}
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="h-9" onClick={() => setAll("business")}>
            {t("migprice_all_business")}
          </Button>
          <Button variant="outline" size="sm" className="h-9" onClick={() => setAll("mine")}>
            {t("migprice_all_mine")}
          </Button>
        </div>

        <ul className="space-y-2">
          {review.rows.map((row) => (
            <li key={row.recipeId} className="rounded-lg border border-border p-3">
              <p className="mb-2 text-sm font-medium text-foreground">{row.name}</p>
              <div className="grid grid-cols-2 gap-2">
                {(["mine", "business"] as Choice[]).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setChoices((s) => ({ ...s, [row.recipeId]: c }))}
                    aria-pressed={choices[row.recipeId] === c}
                    className={cn(
                      "min-h-[44px] rounded-md border px-2 py-1.5 text-left text-xs transition-colors",
                      choices[row.recipeId] === c ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:bg-muted",
                    )}
                  >
                    <span className="block">{t(c === "mine" ? "migprice_mine" : "migprice_business")}</span>
                    <span className="block text-sm font-semibold tabular-nums text-foreground">
                      {formatCurrency(c === "mine" ? row.currentPrice : row.suggestedPrice)}
                    </span>
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-0">
          <Button variant="ghost" onClick={() => setReview(null)} disabled={saving}>
            {t("migprice_later")}
          </Button>
          <Button onClick={save} disabled={saving}>
            {t("migprice_save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
