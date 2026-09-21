"use client"

import { useId, useState } from "react"
import Link from "next/link"
import { Plus, Trash2, Calculator } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NumericInput } from "@/components/ui/numeric-input"
import { Card, CardContent } from "@/components/ui/card"
import { useLanguage } from "@/contexts/language-context"

interface CalcIngredient {
  id: string
  name: string
  quantity: number
  unitPrice: number
}

const STARTER_INGREDIENTS: CalcIngredient[] = [
  { id: "i1", name: "", quantity: 0, unitPrice: 0 },
  { id: "i2", name: "", quantity: 0, unitPrice: 0 },
  { id: "i3", name: "", quantity: 0, unitPrice: 0 },
]

const MAX_INGREDIENTS = 8
const MIN_INGREDIENTS = 1

function formatMoney(value: number) {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Calculadora de costo de plato SIN cuenta, embebida en la landing — pedido explícito
// del dueño del proyecto: el CTA principal del hero dice "Calcular mi primer plato"
// pero antes llevaba directo a /signup sin calcular nada (promesa rota, señalada en
// una auditoría externa). Todo el cálculo vive en estado local de React — nada se
// manda a ningún API ni se guarda; el único destino real es /signup, con la etiqueta
// de "guardar esta receta" una vez la persona ya vio el resultado con sus propios
// números, no antes.
export function LandingCostCalculator() {
  const { t } = useLanguage()
  const idPrefix = useId()
  const [dishName, setDishName] = useState("")
  const [ingredients, setIngredients] = useState<CalcIngredient[]>(STARTER_INGREDIENTS)
  const [salePrice, setSalePrice] = useState(0)

  const totalCost = ingredients.reduce((sum, ing) => sum + ing.quantity * ing.unitPrice, 0)
  const foodCostPercent = salePrice > 0 ? (totalCost / salePrice) * 100 : 0
  const marginPercent = salePrice > 0 ? 100 - foodCostPercent : 0

  const updateIngredient = (id: string, patch: Partial<CalcIngredient>) => {
    setIngredients((prev) => prev.map((ing) => (ing.id === id ? { ...ing, ...patch } : ing)))
  }

  const addIngredient = () => {
    if (ingredients.length >= MAX_INGREDIENTS) return
    setIngredients((prev) => [...prev, { id: `${idPrefix}-${prev.length}-${Date.now()}`, name: "", quantity: 0, unitPrice: 0 }])
  }

  const removeIngredient = (id: string) => {
    if (ingredients.length <= MIN_INGREDIENTS) return
    setIngredients((prev) => prev.filter((ing) => ing.id !== id))
  }

  return (
    <section id="calculadora" className="max-w-[900px] mx-auto px-6 md:px-10 py-16 md:py-20 scroll-mt-16">
      <div className="text-center space-y-2 mb-8">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-primary">{t("landing_calc_kicker")}</p>
        <h2 className="text-3xl md:text-[40px] font-semibold tracking-[-0.038em] text-foreground leading-[1.08]">
          {t("landing_calc_title")}
        </h2>
        <p className="text-text-3 max-w-xl mx-auto">{t("landing_calc_subtitle")}</p>
      </div>

      <Card className="border-hairline bg-card">
        <CardContent className="p-5 md:p-8 space-y-6">
          <Input
            value={dishName}
            onChange={(e) => setDishName(e.target.value)}
            placeholder={t("landing_calc_dish_name_placeholder")}
            className="text-base font-medium"
          />

          <div className="space-y-3">
            {ingredients.map((ing) => (
              <div key={ing.id} className="grid grid-cols-[1fr_88px_110px_auto] gap-2 items-center">
                <Input
                  value={ing.name}
                  onChange={(e) => updateIngredient(ing.id, { name: e.target.value })}
                  placeholder={t("landing_calc_ingredient_name_placeholder")}
                />
                <NumericInput
                  value={ing.quantity}
                  onChange={(value) => updateIngredient(ing.id, { quantity: value })}
                  placeholder={t("landing_calc_quantity_placeholder")}
                  decimalPlaces={2}
                />
                <NumericInput
                  value={ing.unitPrice}
                  onChange={(value) => updateIngredient(ing.id, { unitPrice: value })}
                  placeholder={t("landing_calc_unit_price_placeholder")}
                  decimalPlaces={2}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeIngredient(ing.id)}
                  disabled={ingredients.length <= MIN_INGREDIENTS}
                  aria-label={t("landing_calc_remove_ingredient")}
                  className="text-text-4 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addIngredient}
            disabled={ingredients.length >= MAX_INGREDIENTS}
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            {t("landing_calc_add_ingredient")}
          </Button>

          <div className="border-t border-hairline pt-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-[0.09em] text-text-4">{t("landing_calc_total_cost")}</p>
              <p className="text-2xl font-semibold text-foreground tabular-nums">{formatMoney(totalCost)}</p>
            </div>
            <div className="space-y-1.5">
              <label htmlFor={`${idPrefix}-price`} className="text-xs font-medium uppercase tracking-[0.09em] text-text-4 block">
                {t("landing_calc_sale_price_label")}
              </label>
              <NumericInput
                id={`${idPrefix}-price`}
                value={salePrice}
                onChange={setSalePrice}
                decimalPlaces={2}
                className="text-lg font-semibold"
              />
            </div>
          </div>

          {salePrice > 0 && (
            <div className="grid grid-cols-2 gap-4 bg-canvas-alt rounded-xl px-4 py-3">
              <div>
                <p className="text-[10.5px] font-medium uppercase tracking-[0.09em] text-text-4">{t("landing_calc_food_cost_label")}</p>
                <p className="text-xl font-semibold text-foreground tabular-nums">{foodCostPercent.toFixed(1)}%</p>
              </div>
              <div>
                <p className="text-[10.5px] font-medium uppercase tracking-[0.09em] text-text-4">{t("landing_calc_margin_label")}</p>
                <p className="text-xl font-semibold text-foreground tabular-nums">{marginPercent.toFixed(1)}%</p>
              </div>
            </div>
          )}

          <div className="flex flex-col items-center gap-2 pt-2">
            <Link href="/signup">
              <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90">
                <Calculator className="h-4 w-4 mr-2" />
                {t("landing_calc_cta")}
              </Button>
            </Link>
            <p className="text-xs text-text-4 text-center max-w-sm">{t("landing_calc_caption")}</p>
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
