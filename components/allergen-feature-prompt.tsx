"use client"

/**
 * Aviso del Dashboard para las cuentas que ya existían (pedido del dueño, docs/324): alérgenos
 * sugeridos y tipo de plato. Sale solo si algún ingrediente del espacio principal tiene alérgenos
 * sugeridos sin marcar; «Ahora no» lo esconde en este aparato. No es obligatorio, se recomienda.
 * Lleva a Ingredientes con la revisión abierta (?review=allergens).
 */

import { useEffect, useState } from "react"
import Link from "next/link"
import { DietIcon } from "@/components/icons/diet-icon"
import { Button } from "@/components/ui/button"
import { ingredientsWithSuggestions } from "@/components/allergen-review-dialog"
import { ensureIngredientsLoaded, getIngredients } from "@/lib/storage/ingredients"
import { useFeatureAccess } from "@/lib/plan-access"
import { useLanguage } from "@/contexts/language-context"

const DISMISS_KEY = "gm-allergen-prompt-dismissed-v1"

export function AllergenFeaturePrompt() {
  const { t } = useLanguage()
  const canIngredients = useFeatureAccess("ingredients")
  const [show, setShow] = useState(false)

  useEffect(() => {
    let dismissed = false
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === "1"
    } catch {}
    if (dismissed) return
    let alive = true
    void ensureIngredientsLoaded(null).then(() => {
      if (alive) setShow(ingredientsWithSuggestions(getIngredients(null) || []).length > 0)
    })
    return () => {
      alive = false
    }
  }, [])

  if (!show || canIngredients === false) return null
  const hide = () => {
    setShow(false)
    try {
      localStorage.setItem(DISMISS_KEY, "1")
    } catch {}
  }
  return (
    <div className="mb-6 flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="flex gap-1 text-primary">
          <DietIcon k="gluten" className="h-6 w-6" />
          <DietIcon k="vegetarian" className="h-6 w-6" />
        </span>
        <div>
          <p className="text-sm font-semibold">{t("allergen_prompt_title")}</p>
          <p className="text-xs text-muted-foreground">{t("allergen_prompt_desc")}</p>
        </div>
      </div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row">
        <Button variant="outline" onClick={hide} className="min-h-[40px]">
          {t("allergen_prompt_dismiss")}
        </Button>
        <Button asChild className="min-h-[40px]" onClick={hide}>
          <Link href="/ingredientes?review=allergens">{t("allergen_prompt_cta")}</Link>
        </Button>
      </div>
    </div>
  )
}
