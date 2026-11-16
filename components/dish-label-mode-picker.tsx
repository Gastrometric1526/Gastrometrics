"use client"

/**
 * Cómo salen las etiquetas del plato en el PDF (docs/324): íconos y texto, solo íconos, solo
 * texto o nada. Se recuerda en el aparato (lib/dish-tags.ts).
 */

import { useEffect, useState } from "react"
import { DietIcon } from "@/components/icons/diet-icon"
import { DISH_LABEL_MODES, readDishLabelMode, saveDishLabelMode, type DishLabelMode } from "@/lib/dish-tags"
import { useLanguage } from "@/contexts/language-context"
import { cn } from "@/lib/utils"

export function useDishLabelMode(): [DishLabelMode, (m: DishLabelMode) => void] {
  const [mode, setMode] = useState<DishLabelMode>("both")
  useEffect(() => setMode(readDishLabelMode()), [])
  return [
    mode,
    (m) => {
      setMode(m)
      saveDishLabelMode(m)
    },
  ]
}

export function DishLabelModePicker({ value, onChange }: { value: DishLabelMode; onChange: (m: DishLabelMode) => void }) {
  const { t } = useLanguage()
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-semibold">{t("dish_labels_export_title")}</legend>
      <p className="text-xs text-muted-foreground">{t("dish_labels_export_hint")}</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup">
        {DISH_LABEL_MODES.map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={value === m}
            onClick={() => onChange(m)}
            className={cn(
              "flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border-2 px-2 py-2 text-sm transition-colors",
              value === m ? "border-primary bg-primary/5 font-medium" : "border-border hover:border-primary/50",
            )}
          >
            {(m === "both" || m === "icons") && <DietIcon k="vegetarian" className="text-primary" />}
            {t(`dish_labels_mode_${m}` as const)}
          </button>
        ))}
      </div>
    </fieldset>
  )
}
