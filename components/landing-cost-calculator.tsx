"use client"

import { useId, useState } from "react"
import Link from "next/link"
import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NumericInput } from "@/components/ui/numeric-input"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
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
// una auditoría externa).
//
// BUG CORREGIDO (segunda vuelta, a pedido explícito del dueño del proyecto: "no me
// gusta, hazlo mas similar a lo que realmente esta en la app"): la primera versión
// era una tarjeta genérica de 3 filas con inputs sueltos — no se parecía a la Ficha
// Técnica real (una tabla con columnas Ingrediente/Cantidad/Costo por medida/Extensión,
// más un pie de Costo de producción/Precio de venta/Food Cost/Margen). Ahora reutiliza
// las mismas claves de traducción que la Ficha Técnica real (ficha_tecnica_col_*,
// ficha_tecnica_field_contribution_margin, etc.) en vez de textos propios — el
// visitante ve literalmente el mismo vocabulario y la misma tabla que va a usar
// después de crear su cuenta, no una maqueta aparte.
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
    <section id="calculadora" className="max-w-[820px] mx-auto px-6 md:px-10 py-16 md:py-20 scroll-mt-16">
      <div className="text-center space-y-2 mb-8">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-primary">{t("landing_calc_kicker")}</p>
        <h2 className="text-3xl md:text-[40px] font-semibold tracking-[-0.038em] text-foreground leading-[1.08]">
          {t("landing_calc_title")}
        </h2>
        <p className="text-text-3 max-w-xl mx-auto">{t("landing_calc_subtitle")}</p>
      </div>

      <Card className="border-hairline bg-card overflow-hidden">
        {/* Misma banda superior que la réplica del PDF (landing-admin-pdf-preview.tsx) —
            mismo "look" de ficha técnica en toda la landing, no dos estilos distintos. */}
        <div className="flex items-center justify-between px-5 py-3 bg-canvas-alt border-b border-hairline">
          <p className="text-[10.5px] font-medium uppercase tracking-[0.09em] text-text-4">
            {t("landing_hero_card_kicker")}
          </p>
        </div>
        <CardContent className="p-5 md:p-6 space-y-5">
          <div className="space-y-1.5 max-w-sm">
            <label htmlFor={`${idPrefix}-dish`} className="text-[10px] font-medium uppercase tracking-[0.08em] text-text-4">
              {t("ficha_tecnica_field_name")}
            </label>
            <Input
              id={`${idPrefix}-dish`}
              value={dishName}
              onChange={(e) => setDishName(e.target.value)}
              placeholder={t("landing_calc_dish_name_placeholder")}
            />
          </div>

          <div className="border border-hairline rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-canvas-alt hover:bg-canvas-alt">
                  <TableHead className="text-[10px] uppercase tracking-[0.06em]">{t("landing_calc_ingredient_name_placeholder")}</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-[0.06em] text-right w-24">{t("ficha_tecnica_col_quantity")}</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-[0.06em] text-right w-28">{t("ficha_tecnica_col_cost_per_measure")}</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-[0.06em] text-right w-24">{t("ficha_tecnica_col_extension")}</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ingredients.map((ing) => (
                  <TableRow key={ing.id}>
                    <TableCell className="p-1.5">
                      <Input
                        value={ing.name}
                        onChange={(e) => updateIngredient(ing.id, { name: e.target.value })}
                        placeholder={t("landing_calc_ingredient_name_placeholder")}
                        className="h-8 border-transparent bg-transparent hover:border-input focus-visible:border-input"
                      />
                    </TableCell>
                    <TableCell className="p-1.5">
                      <NumericInput
                        value={ing.quantity}
                        onChange={(value) => updateIngredient(ing.id, { quantity: value })}
                        decimalPlaces={2}
                        className="h-8 text-right border-transparent bg-transparent hover:border-input focus-visible:border-input"
                      />
                    </TableCell>
                    <TableCell className="p-1.5">
                      <NumericInput
                        value={ing.unitPrice}
                        onChange={(value) => updateIngredient(ing.id, { unitPrice: value })}
                        decimalPlaces={2}
                        className="h-8 text-right border-transparent bg-transparent hover:border-input focus-visible:border-input"
                      />
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums text-foreground p-1.5 pr-3">
                      {formatMoney(ing.quantity * ing.unitPrice)}
                    </TableCell>
                    <TableCell className="p-1.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeIngredient(ing.id)}
                        disabled={ingredients.length <= MIN_INGREDIENTS}
                        aria-label={t("landing_calc_remove_ingredient")}
                        className="h-8 w-8 text-text-4 hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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

          <div className="border-t border-hairline pt-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-text-4">{t("ficha_tecnica_col_production_cost")}</p>
              <p className="text-lg font-semibold text-foreground tabular-nums mt-0.5">{formatMoney(totalCost)}</p>
            </div>
            <div className="space-y-1.5">
              <label htmlFor={`${idPrefix}-price`} className="text-[10px] font-medium uppercase tracking-[0.08em] text-text-4 block">
                {t("ficha_tecnica_col_unit_sale_price")}
              </label>
              <NumericInput id={`${idPrefix}-price`} value={salePrice} onChange={setSalePrice} decimalPlaces={2} className="h-8" />
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-text-4">{t("ficha_tecnica_food_cost_percent_label")}</p>
              <p className="text-lg font-semibold text-foreground tabular-nums mt-0.5">{salePrice > 0 ? `${foodCostPercent.toFixed(1)}%` : "—"}</p>
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-text-4">{t("ficha_tecnica_field_contribution_margin")}</p>
              <p className="text-lg font-semibold text-foreground tabular-nums mt-0.5">{salePrice > 0 ? `${marginPercent.toFixed(1)}%` : "—"}</p>
            </div>
          </div>

          <div className="flex flex-col items-center gap-2 pt-2">
            <Link href="/signup">
              <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90">
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
