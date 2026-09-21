"use client"

import { useEffect, useId, useRef, useState } from "react"
import Link from "next/link"
import { Plus, Trash2, ArrowRight, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NumericInput } from "@/components/ui/numeric-input"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useLanguage } from "@/contexts/language-context"

interface DemoIngredient {
  id: string
  name: string
  unitCost: number
}

interface DemoRecipeLine {
  id: string
  ingredientId: string
  quantity: number
}

interface DemoDraft {
  dishName: string
  ingredients: DemoIngredient[]
  recipeLines: DemoRecipeLine[]
  salePrice: number
  step: 1 | 2
  startedAt: number
}

const MAX_INGREDIENTS = 6
const MIN_INGREDIENTS = 1
const STORAGE_KEY = "gm_landing_demo_v1"
const EXPIRY_MS = 10 * 60 * 1000

function emptyDraft(): DemoDraft {
  return {
    dishName: "",
    ingredients: [{ id: "i1", name: "", unitCost: 0 }],
    recipeLines: [],
    salePrice: 0,
    step: 1,
    startedAt: Date.now(),
  }
}

// Carga el borrador si existe y todavía no expiró (10 min desde que se empezó a llenar,
// sin importar actividad — pedido explícito del dueño del proyecto: "si el usuario no
// crea una cuenta el ejemplo llenado se borra después de 10 minutos"). Si expiró, lo
// limpia y arranca de cero — es solo un ejemplo de prueba, nunca pertenece a una cuenta
// real, así que no hay nada que migrar ni avisar más allá de este límite de tiempo.
function loadDraft(): DemoDraft {
  if (typeof window === "undefined") return emptyDraft()
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyDraft()
    const parsed = JSON.parse(raw) as DemoDraft
    if (Date.now() - parsed.startedAt > EXPIRY_MS) {
      window.localStorage.removeItem(STORAGE_KEY)
      return emptyDraft()
    }
    return parsed
  } catch {
    return emptyDraft()
  }
}

function formatMoney(value: number) {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Demo interactiva de 2 pasos (Ingredientes → Ficha Técnica), embebida en la landing sin
// cuenta — pedido explícito del dueño del proyecto, segunda vuelta sobre este
// componente: la versión anterior (un solo paso, precio y cantidad tipeados directo en
// la fila de la receta) "no tiene sentido porque se ocupa una base de datos" — en la app
// real un ingrediente vive aparte, con su propio costo, y la Ficha Técnica lo REFERENCIA
// por cantidad, no lo tipea de nuevo. Esta versión refleja esa misma separación: Paso 1
// crea una mini base de ingredientes (nombre + costo por unidad), Paso 2 arma la receta
// eligiendo de esos ingredientes ya cargados — mismo flujo de 2 módulos que fuerza el
// tour real al crear una cuenta (ver components/onboarding-tour.tsx / page-tours.tsx),
// para que la demo y la app real cuenten la misma historia.
//
// Persistencia de 10 minutos: el borrador se guarda en localStorage (nunca en una
// cuenta — no existe ninguna todavía) y se borra solo si pasan 10 minutos sin que la
// persona haya creado una cuenta real, ver loadDraft()/EXPIRY_MS arriba.
export function LandingRecipeDemo() {
  const { t } = useLanguage()
  const idPrefix = useId()
  const [draft, setDraft] = useState<DemoDraft>(emptyDraft)
  const [hydrated, setHydrated] = useState(false)
  const [minutesLeft, setMinutesLeft] = useState(10)
  const expiryTimeout = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    setDraft(loadDraft())
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft))

    const tick = () => {
      const remainingMs = EXPIRY_MS - (Date.now() - draft.startedAt)
      if (remainingMs <= 0) {
        window.localStorage.removeItem(STORAGE_KEY)
        setDraft(emptyDraft())
        setMinutesLeft(10)
        return
      }
      setMinutesLeft(Math.max(1, Math.ceil(remainingMs / 60000)))
      expiryTimeout.current = setTimeout(tick, 30000)
    }
    tick()
    return () => clearTimeout(expiryTimeout.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, draft.startedAt])

  if (!hydrated) return null

  const patch = (p: Partial<DemoDraft>) => setDraft((prev) => ({ ...prev, ...p }))

  const updateIngredient = (id: string, p: Partial<DemoIngredient>) => {
    patch({ ingredients: draft.ingredients.map((i) => (i.id === id ? { ...i, ...p } : i)) })
  }

  const addIngredient = () => {
    if (draft.ingredients.length >= MAX_INGREDIENTS) return
    patch({ ingredients: [...draft.ingredients, { id: `${idPrefix}-${Date.now()}`, name: "", unitCost: 0 }] })
  }

  const removeIngredient = (id: string) => {
    if (draft.ingredients.length <= MIN_INGREDIENTS) return
    patch({
      ingredients: draft.ingredients.filter((i) => i.id !== id),
      recipeLines: draft.recipeLines.filter((l) => l.ingredientId !== id),
    })
  }

  const addRecipeLine = () => {
    const firstUnused = draft.ingredients.find((i) => !draft.recipeLines.some((l) => l.ingredientId === i.id))
    patch({
      recipeLines: [
        ...draft.recipeLines,
        { id: `${idPrefix}-line-${Date.now()}`, ingredientId: firstUnused?.id || draft.ingredients[0]?.id || "", quantity: 0 },
      ],
    })
  }

  const updateRecipeLine = (id: string, p: Partial<DemoRecipeLine>) => {
    patch({ recipeLines: draft.recipeLines.map((l) => (l.id === id ? { ...l, ...p } : l)) })
  }

  const removeRecipeLine = (id: string) => {
    patch({ recipeLines: draft.recipeLines.filter((l) => l.id !== id) })
  }

  const namedIngredients = draft.ingredients.filter((i) => i.name.trim())
  const totalCost = draft.recipeLines.reduce((sum, line) => {
    const ing = draft.ingredients.find((i) => i.id === line.ingredientId)
    return sum + line.quantity * (ing?.unitCost || 0)
  }, 0)
  const foodCostPercent = draft.salePrice > 0 ? (totalCost / draft.salePrice) * 100 : 0
  const marginPercent = draft.salePrice > 0 ? 100 - foodCostPercent : 0

  const goToStep2 = () => {
    if (draft.recipeLines.length === 0 && namedIngredients.length > 0) addRecipeLine()
    patch({ step: 2 })
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
            {draft.step === 1 ? t("landing_calc_step1_badge") : t("landing_calc_step2_badge")}
          </p>
          <p className="text-[10px] font-medium text-text-4 tabular-nums">
            {t("landing_calc_expiry_caption").replace("{minutes}", String(minutesLeft))}
          </p>
        </div>

        <CardContent className="p-5 md:p-6 space-y-5">
          {draft.step === 1 ? (
            <>
              <div className="space-y-1">
                <h3 className="text-lg font-semibold text-foreground">{t("landing_calc_step1_title")}</h3>
                <p className="text-sm text-text-3">{t("landing_calc_step1_desc")}</p>
              </div>

              <div className="border border-hairline rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-canvas-alt hover:bg-canvas-alt">
                      <TableHead className="text-[10px] uppercase tracking-[0.06em]">
                        {t("landing_calc_ingredient_name_placeholder")}
                      </TableHead>
                      <TableHead className="text-[10px] uppercase tracking-[0.06em] text-right w-40">
                        {t("landing_calc_step1_cost_label")}
                      </TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {draft.ingredients.map((ing) => (
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
                            value={ing.unitCost}
                            onChange={(value) => updateIngredient(ing.id, { unitCost: value })}
                            decimalPlaces={2}
                            className="h-8 text-right border-transparent bg-transparent hover:border-input focus-visible:border-input"
                          />
                        </TableCell>
                        <TableCell className="p-1.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeIngredient(ing.id)}
                            disabled={draft.ingredients.length <= MIN_INGREDIENTS}
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
                disabled={draft.ingredients.length >= MAX_INGREDIENTS}
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                {t("landing_calc_add_ingredient")}
              </Button>

              <div className="flex justify-end pt-2">
                <Button
                  type="button"
                  onClick={goToStep2}
                  disabled={namedIngredients.length === 0}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {t("landing_calc_step1_next")}
                  <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-1">
                <h3 className="text-lg font-semibold text-foreground">{t("landing_calc_step2_title")}</h3>
                <p className="text-sm text-text-3">{t("landing_calc_step2_desc")}</p>
              </div>

              <div className="space-y-1.5 max-w-sm">
                <label htmlFor={`${idPrefix}-dish`} className="text-[10px] font-medium uppercase tracking-[0.08em] text-text-4">
                  {t("ficha_tecnica_field_name")}
                </label>
                <Input
                  id={`${idPrefix}-dish`}
                  value={draft.dishName}
                  onChange={(e) => patch({ dishName: e.target.value })}
                  placeholder={t("landing_calc_dish_name_placeholder")}
                />
              </div>

              {namedIngredients.length === 0 ? (
                <p className="text-sm text-text-3 py-4">{t("landing_calc_step2_empty_hint")}</p>
              ) : (
                <div className="border border-hairline rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-canvas-alt hover:bg-canvas-alt">
                        <TableHead className="text-[10px] uppercase tracking-[0.06em]">
                          {t("landing_calc_ingredient_name_placeholder")}
                        </TableHead>
                        <TableHead className="text-[10px] uppercase tracking-[0.06em] text-right w-24">
                          {t("ficha_tecnica_col_quantity")}
                        </TableHead>
                        <TableHead className="text-[10px] uppercase tracking-[0.06em] text-right w-28">
                          {t("ficha_tecnica_col_cost_per_measure")}
                        </TableHead>
                        <TableHead className="text-[10px] uppercase tracking-[0.06em] text-right w-24">
                          {t("ficha_tecnica_col_extension")}
                        </TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {draft.recipeLines.map((line) => {
                        const ing = draft.ingredients.find((i) => i.id === line.ingredientId)
                        return (
                          <TableRow key={line.id}>
                            <TableCell className="p-1.5">
                              <Select value={line.ingredientId} onValueChange={(value) => updateRecipeLine(line.id, { ingredientId: value })}>
                                <SelectTrigger className="h-8 border-transparent bg-transparent hover:border-input">
                                  <SelectValue placeholder={t("landing_calc_step2_pick_placeholder")} />
                                </SelectTrigger>
                                <SelectContent>
                                  {namedIngredients.map((i) => (
                                    <SelectItem key={i.id} value={i.id}>
                                      {i.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="p-1.5">
                              <NumericInput
                                value={line.quantity}
                                onChange={(value) => updateRecipeLine(line.id, { quantity: value })}
                                decimalPlaces={2}
                                className="h-8 text-right border-transparent bg-transparent hover:border-input focus-visible:border-input"
                              />
                            </TableCell>
                            <TableCell className="text-right text-sm tabular-nums text-text-3 p-1.5">
                              {formatMoney(ing?.unitCost || 0)}
                            </TableCell>
                            <TableCell className="text-right text-sm tabular-nums text-foreground p-1.5 pr-3">
                              {formatMoney(line.quantity * (ing?.unitCost || 0))}
                            </TableCell>
                            <TableCell className="p-1.5">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removeRecipeLine(line.id)}
                                aria-label={t("landing_calc_remove_ingredient")}
                                className="h-8 w-8 text-text-4 hover:text-destructive"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}

              {namedIngredients.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addRecipeLine}
                  disabled={draft.recipeLines.length >= namedIngredients.length}
                >
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  {t("landing_calc_add_ingredient")}
                </Button>
              )}

              <div className="border-t border-hairline pt-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-text-4">{t("ficha_tecnica_col_production_cost")}</p>
                  <p className="text-lg font-semibold text-foreground tabular-nums mt-0.5">{formatMoney(totalCost)}</p>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor={`${idPrefix}-price`} className="text-[10px] font-medium uppercase tracking-[0.08em] text-text-4 block">
                    {t("ficha_tecnica_col_unit_sale_price")}
                  </label>
                  <NumericInput id={`${idPrefix}-price`} value={draft.salePrice} onChange={(value) => patch({ salePrice: value })} decimalPlaces={2} className="h-8" />
                </div>
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-text-4">{t("ficha_tecnica_food_cost_percent_label")}</p>
                  <p className="text-lg font-semibold text-foreground tabular-nums mt-0.5">{draft.salePrice > 0 ? `${foodCostPercent.toFixed(1)}%` : "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-text-4">{t("ficha_tecnica_field_contribution_margin")}</p>
                  <p className="text-lg font-semibold text-foreground tabular-nums mt-0.5">{draft.salePrice > 0 ? `${marginPercent.toFixed(1)}%` : "—"}</p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => patch({ step: 1 })}>
                  <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
                  {t("landing_calc_step2_back")}
                </Button>
                <Link href="/signup">
                  <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90">
                    {t("landing_calc_cta")}
                  </Button>
                </Link>
              </div>
              <p className="text-xs text-text-4 text-center max-w-sm mx-auto">{t("landing_calc_caption")}</p>
            </>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
