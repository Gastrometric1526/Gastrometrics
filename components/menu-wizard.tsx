"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { ArrowLeft, ArrowRight, Calendar, ChefHat, Plus, Trash2, UtensilsCrossed, Check } from "lucide-react"
import { getRecipes } from "@/lib/storage/recipes"
import { createMenu, updateMenu, getRecipeSection } from "@/lib/menus"
import { ActivityTracker } from "@/lib/activity-tracker"
import type { Menu, MenuItem, MenuStep } from "@/lib/types/menus"
import { menuTypes } from "@/lib/types/menus"
import { recipeSteps } from "@/types/recipe"
import type { Recipe } from "@/types/recipe"
import { formatCurrency } from "@/lib/currency"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/contexts/language-context"
import { getDateLocale } from "@/lib/i18n/translations"

interface MenuWizardProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  menu: Menu | null
  businessId: string
  onMenuSaved: (menu: Menu) => void
}

type Stage = "details" | "steps" | "dishes" | "review"

const stageDefs: { id: Stage; labelKey: "mw_stage_details" | "mw_stage_steps" | "mw_stage_dishes" | "mw_stage_review" }[] = [
  { id: "details", labelKey: "mw_stage_details" },
  { id: "steps", labelKey: "mw_stage_steps" },
  { id: "dishes", labelKey: "mw_stage_dishes" },
  { id: "review", labelKey: "mw_stage_review" },
]

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

function defaultSteps(): MenuStep[] {
  return [
    { id: generateId("step"), name: "Entrada", order: 0 },
    { id: generateId("step"), name: "Plato fuerte", order: 1 },
    { id: generateId("step"), name: "Postre", order: 2 },
  ]
}

export function MenuWizard({ open, onOpenChange, menu, businessId, onMenuSaved }: MenuWizardProps) {
  const { toast } = useToast()
  const { t, language } = useLanguage()
  const stages = stageDefs.map((s) => ({ id: s.id, label: t(s.labelKey) }))
  const [stage, setStage] = useState<Stage>("details")
  const [recipes, setRecipes] = useState<Recipe[]>([])

  const [menuName, setMenuName] = useState("")
  const [menuType, setMenuType] = useState<string>("")
  const [serviceDate, setServiceDate] = useState<string>("")
  const [plannedServings, setPlannedServings] = useState<string>("")
  const [steps, setSteps] = useState<MenuStep[]>([])
  const [items, setItems] = useState<MenuItem[]>([])
  const [newStepName, setNewStepName] = useState("")
  const [activeStepTab, setActiveStepTab] = useState<string>("")
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!open) return

    try {
      setRecipes(getRecipes(businessId))
    } catch (error) {
      console.error("Error loading recipes:", error)
      toast({ title: t("mw_toast_load_error_title"), description: t("mw_toast_load_error_desc"), variant: "destructive" })
    }

    if (menu) {
      setMenuName(menu.name)
      setMenuType(menu.menuType || "")
      setServiceDate(menu.serviceDate || "")
      setPlannedServings(menu.plannedServings ? String(menu.plannedServings) : "")
      setSteps(menu.steps.length > 0 ? menu.steps : defaultSteps())
      setItems([...menu.items])
    } else {
      setMenuName("")
      setMenuType("")
      setServiceDate("")
      setPlannedServings("")
      const initialSteps = defaultSteps()
      setSteps(initialSteps)
      setItems([])
      setActiveStepTab(initialSteps[0]?.id || "")
    }
    setStage("details")
    setNewStepName("")
  }, [open, menu, businessId])

  useEffect(() => {
    if (steps.length > 0 && !steps.some((s) => s.id === activeStepTab)) {
      setActiveStepTab(steps[0].id)
    }
  }, [steps, activeStepTab])

  const stageIndex = stages.findIndex((s) => s.id === stage)

  const totalDishes = items.filter((item) => item.enabled).length

  const dishesByStep = useMemo(() => {
    const map: Record<string, MenuItem[]> = {}
    steps.forEach((step) => {
      map[step.id] = items.filter((item) => item.stepId === step.id && item.enabled)
    })
    return map
  }, [steps, items])

  const addStep = () => {
    const name = newStepName.trim()
    if (!name) return
    const step: MenuStep = { id: generateId("step"), name, order: steps.length }
    setSteps((prev) => [...prev, step])
    setNewStepName("")
    setActiveStepTab(step.id)
  }

  const renameStep = (stepId: string, name: string) => {
    setSteps((prev) => prev.map((s) => (s.id === stepId ? { ...s, name } : s)))
  }

  const removeStep = (stepId: string) => {
    setSteps((prev) => prev.filter((s) => s.id !== stepId).map((s, i) => ({ ...s, order: i })))
    setItems((prev) => prev.filter((item) => item.stepId !== stepId))
  }

  const toggleRecipeForStep = (step: MenuStep, recipe: Recipe, checked: boolean) => {
    if (checked) {
      const existing = items.find((item) => item.stepId === step.id && item.recipeId === recipe.id)
      if (existing) {
        setItems((prev) =>
          prev.map((item) => (item === existing ? { ...item, enabled: true } : item)),
        )
        return
      }
      const newItem: MenuItem = {
        id: generateId("item"),
        recipeId: recipe.id,
        stepId: step.id,
        section: getRecipeSection(recipe),
        label: recipe.name,
        priceOverride: null,
        enabled: true,
      }
      setItems((prev) => [...prev, newItem])
    } else {
      setItems((prev) => prev.filter((item) => !(item.stepId === step.id && item.recipeId === recipe.id)))
    }
  }

  // Cuánto se necesita de este plato en particular para esta corrida del menú — solo se
  // usa para escalar la lista de compras (ver lib/menus.ts generateMenuIngredientList),
  // nunca toca la receta original. Si el usuario no ajusta un plato, se usa
  // plannedServings (el total de comensales del menú) como valor por defecto.
  const updateItemPlannedQuantity = (itemId: string, value: string) => {
    const parsed = value.trim() ? Number.parseFloat(value) : null
    setItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, plannedQuantity: parsed } : item)),
    )
  }

  const recipesForStep = (step: MenuStep) => {
    const normalizedStepName = step.name.trim().toLowerCase()
    const suggested: Recipe[] = []
    const others: Recipe[] = []
    recipes.forEach((recipe) => {
      if (recipe.plate && recipe.plate.trim().toLowerCase() === normalizedStepName) {
        suggested.push(recipe)
      } else {
        others.push(recipe)
      }
    })
    return { suggested, others }
  }

  const isRecipeSelected = (step: MenuStep, recipeId: string) =>
    items.some((item) => item.stepId === step.id && item.recipeId === recipeId && item.enabled)

  const goNext = () => {
    if (stage === "details") {
      if (!menuName.trim()) {
        toast({ title: t("mw_toast_missing_name_title"), description: t("mw_toast_missing_name_desc"), variant: "destructive" })
        return
      }
      setStage("steps")
      return
    }
    if (stage === "steps") {
      if (steps.length === 0) {
        toast({
          title: t("mw_toast_missing_step_title"),
          description: t("mw_toast_missing_step_desc"),
          variant: "destructive",
        })
        return
      }
      setStage("dishes")
      return
    }
    if (stage === "dishes") {
      if (totalDishes === 0) {
        toast({
          title: t("mw_toast_missing_dish_title"),
          description: t("mw_toast_missing_dish_desc"),
          variant: "destructive",
        })
        return
      }
      setStage("review")
      return
    }
  }

  const goBack = () => {
    if (stage === "steps") setStage("details")
    else if (stage === "dishes") setStage("steps")
    else if (stage === "review") setStage("dishes")
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const payload = {
        businessId,
        name: menuName.trim(),
        menuType: menuType || undefined,
        serviceDate: serviceDate || null,
        plannedServings: plannedServings.trim() ? Number.parseInt(plannedServings, 10) : null,
        steps,
        items,
      }

      let savedMenu: Menu
      if (menu) {
        savedMenu = (await updateMenu(businessId, menu.id, payload)) || menu
      } else {
        savedMenu = await createMenu(businessId, payload)
      }

      onMenuSaved(savedMenu)
      ActivityTracker.addActivity(
        menu ? `Menú actualizado: ${savedMenu.name}` : `Menú creado: ${savedMenu.name}`,
        "recipe",
        businessId,
        { menuId: savedMenu.id },
      )
      toast({
        title: menu ? t("mw_toast_updated_title") : t("mw_toast_created_title"),
        description: t("mw_toast_saved_desc")
          .replace("{name}", savedMenu.name)
          .replace("{dishes}", String(totalDishes))
          .replace("{steps}", String(steps.length)),
      })
    } catch (error) {
      console.error("Error saving menu:", error)
      toast({ title: t("mw_toast_save_error_title"), description: t("mw_toast_save_error_desc"), variant: "destructive" })
    } finally {
      setIsSaving(false)
    }
  }

  const getRecipePrice = (recipeId: string) => recipes.find((r) => r.id === recipeId)?.unitPrice || 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ChefHat className="h-5 w-5 text-primary" />
            {menu ? t("mw_dialog_title_edit") : t("mw_dialog_title_new")}
          </DialogTitle>
        </DialogHeader>

        {/* Indicador de pasos del asistente */}
        <div className="flex items-center gap-2 shrink-0">
          {stages.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2 flex-1">
              <div
                className={cn(
                  "flex items-center gap-2 text-sm font-medium",
                  i === stageIndex ? "text-primary" : i < stageIndex ? "text-foreground" : "text-muted-foreground",
                )}
              >
                <div
                  className={cn(
                    "h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                    i === stageIndex
                      ? "bg-primary text-primary-foreground"
                      : i < stageIndex
                        ? "bg-primary/20 text-primary"
                        : "bg-muted text-muted-foreground",
                  )}
                >
                  {i < stageIndex ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </div>
                <span className="hidden sm:inline">{s.label}</span>
              </div>
              {i < stages.length - 1 && <div className="h-px flex-1 bg-border" />}
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto pr-1 py-2">
          {stage === "details" && (
            <div className="space-y-5">
              <p className="text-sm text-muted-foreground">{t("mw_details_intro")}</p>
              <div className="space-y-2">
                <Label htmlFor="menuName">{t("mw_name_label")}</Label>
                <Input
                  id="menuName"
                  value={menuName}
                  onChange={(e) => setMenuName(e.target.value)}
                  placeholder={t("mw_name_placeholder")}
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="menuType">{t("mw_type_label")}</Label>
                  <Select value={menuType} onValueChange={setMenuType}>
                    <SelectTrigger id="menuType">
                      <SelectValue placeholder={t("mw_type_placeholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {menuTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="serviceDate" className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    {t("mw_service_date_label")}
                  </Label>
                  <Input
                    id="serviceDate"
                    type="date"
                    value={serviceDate}
                    onChange={(e) => setServiceDate(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">{t("mw_service_date_hint")}</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="plannedServings">{t("mw_servings_label")}</Label>
                <Input
                  id="plannedServings"
                  type="number"
                  min="1"
                  step="1"
                  value={plannedServings}
                  onChange={(e) => setPlannedServings(e.target.value)}
                  placeholder={t("mw_servings_placeholder")}
                  className="max-w-[160px]"
                />
                <p className="text-xs text-muted-foreground">{t("mw_servings_hint")}</p>
              </div>
            </div>
          )}

          {stage === "steps" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{t("mw_steps_intro")}</p>
              <div className="space-y-2">
                {steps.map((step, index) => (
                  <div key={step.id} className="flex items-center gap-2">
                    <Badge variant="outline" className="w-7 h-7 shrink-0 rounded-full flex items-center justify-center p-0">
                      {index + 1}
                    </Badge>
                    <Select value={step.name} onValueChange={(value) => renameStep(step.id, value)}>
                      <SelectTrigger className="flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {recipeSteps.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => removeStep(step.id)}
                      aria-label={t("mw_remove_step_aria").replace("{name}", step.name)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 pt-2">
                <Select value={newStepName} onValueChange={setNewStepName}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder={t("mw_add_step_placeholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {recipeSteps
                      .filter((s) => !steps.some((step) => step.name === s))
                      .map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" onClick={addStep} disabled={!newStepName} className="gap-1.5 shrink-0 bg-transparent">
                  <Plus className="h-4 w-4" />
                  {t("mw_add_step_button")}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">{t("mw_steps_count").replace("{count}", String(steps.length))}</p>
            </div>
          )}

          {stage === "dishes" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{t("mw_dishes_intro")}</p>
              {recipes.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-sm">{t("mw_no_recipes")}</div>
              ) : (
                <Tabs value={activeStepTab} onValueChange={setActiveStepTab}>
                  <TabsList className="flex-wrap h-auto">
                    {steps.map((step) => (
                      <TabsTrigger key={step.id} value={step.id} className="gap-1.5">
                        {step.name || t("mw_step_unnamed")}
                        {dishesByStep[step.id]?.length > 0 && (
                          <Badge variant="secondary" className="ml-1 px-1.5 h-4 min-w-4 text-[10px]">
                            {dishesByStep[step.id].length}
                          </Badge>
                        )}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  {steps.map((step) => {
                    const { suggested, others } = recipesForStep(step)
                    return (
                      <TabsContent key={step.id} value={step.id} className="mt-3">
                        <ScrollArea className="h-72 rounded-md border">
                          <div className="p-3 space-y-1">
                            {suggested.length > 0 && (
                              <>
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1 pt-1">
                                  {t("mw_suggested_for").replace("{step}", step.name)}
                                </p>
                                {suggested.map((recipe) => (
                                  <RecipeCheckRow
                                    key={recipe.id}
                                    recipe={recipe}
                                    checked={isRecipeSelected(step, recipe.id)}
                                    price={getRecipePrice(recipe.id)}
                                    suggested
                                    suggestedLabel={t("mw_suggested_badge")}
                                    onCheckedChange={(checked) => toggleRecipeForStep(step, recipe, checked)}
                                  />
                                ))}
                              </>
                            )}
                            {others.length > 0 && (
                              <>
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1 pt-3">
                                  {suggested.length > 0 ? t("mw_other_recipes") : t("mw_all_recipes")}
                                </p>
                                {others.map((recipe) => (
                                  <RecipeCheckRow
                                    key={recipe.id}
                                    recipe={recipe}
                                    checked={isRecipeSelected(step, recipe.id)}
                                    price={getRecipePrice(recipe.id)}
                                    onCheckedChange={(checked) => toggleRecipeForStep(step, recipe, checked)}
                                  />
                                ))}
                              </>
                            )}
                          </div>
                        </ScrollArea>
                      </TabsContent>
                    )
                  })}
                </Tabs>
              )}
              <p className="text-xs text-muted-foreground">
                {t("mw_dishes_selected_total").replace("{count}", String(totalDishes))}
              </p>
            </div>
          )}

          {stage === "review" && (
            <div className="space-y-4">
              <div className="rounded-lg border p-4 space-y-1 bg-muted/20">
                <div className="flex items-center gap-2">
                  <UtensilsCrossed className="h-4 w-4 text-primary" />
                  <span className="font-bold text-foreground">{menuName}</span>
                </div>
                <div className="flex flex-wrap gap-3 text-sm text-muted-foreground pt-1">
                  {menuType && <Badge variant="outline">{menuType}</Badge>}
                  {serviceDate && (
                    <span className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      {new Date(`${serviceDate}T00:00:00`).toLocaleDateString(getDateLocale(language), {
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                      })}
                    </span>
                  )}
                  <span>
                    {t("mw_review_steps_dishes")
                      .replace("{steps}", String(steps.length))
                      .replace("{dishes}", String(totalDishes))}
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-foreground">{t("mw_review_quantity_title")}</h4>
                <p className="text-xs text-muted-foreground">
                  {t("mw_review_quantity_hint").replace("{total}", plannedServings || t("mw_undefined_servings"))}
                </p>
              </div>
              <div className="space-y-3">
                {steps.map((step) => {
                  const stepItems = dishesByStep[step.id] || []
                  if (stepItems.length === 0) return null
                  return (
                    <div key={step.id} className="space-y-1.5">
                      <h4 className="text-sm font-semibold text-foreground">{step.name}</h4>
                      {stepItems.map((item) => {
                        const recipe = recipes.find((r) => r.id === item.recipeId)
                        return (
                          <div
                            key={item.id}
                            className="flex items-center justify-between gap-3 text-sm bg-muted/20 rounded px-3 py-2"
                          >
                            <div className="min-w-0">
                              <span className="truncate block">{recipe?.name || t("mw_recipe_fallback")}</span>
                              {recipe?.yieldAmount ? (
                                <span className="text-xs text-muted-foreground">
                                  {t("mw_recipe_yield").replace("{amount}", String(recipe.yieldAmount))}
                                </span>
                              ) : null}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Input
                                type="number"
                                min="0"
                                step="1"
                                value={item.plannedQuantity ?? ""}
                                onChange={(e) => updateItemPlannedQuantity(item.id, e.target.value)}
                                placeholder={plannedServings || "0"}
                                className="w-20 h-8 text-right"
                              />
                              <span className="font-medium whitespace-nowrap">
                                {formatCurrency(item.priceOverride ?? getRecipePrice(item.recipeId))}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="pt-4 border-t shrink-0 flex-row justify-between sm:justify-between">
          <div>
            {stage !== "details" ? (
              <Button type="button" variant="outline" onClick={goBack} className="gap-1.5 bg-transparent">
                <ArrowLeft className="h-4 w-4" />
                {t("mw_back_button")}
              </Button>
            ) : (
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t("mw_cancel_button")}
              </Button>
            )}
          </div>
          {stage !== "review" ? (
            <Button type="button" onClick={goNext} className="gap-1.5">
              {t("mw_next_button")}
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button type="button" onClick={handleSave} disabled={isSaving}>
              {isSaving ? t("mw_saving") : menu ? t("mw_save_changes") : t("mw_create_menu")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function RecipeCheckRow({
  recipe,
  checked,
  price,
  suggested,
  suggestedLabel,
  onCheckedChange,
}: {
  recipe: Recipe
  checked: boolean
  price: number
  suggested?: boolean
  suggestedLabel?: string
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <label
      className={cn(
        "flex items-center gap-3 rounded-md px-2 py-2 cursor-pointer hover:bg-accent transition-colors",
        checked && "bg-primary/5",
      )}
    >
      <Checkbox checked={checked} onCheckedChange={(c) => onCheckedChange(c === true)} />
      <span className="flex-1 min-w-0 truncate text-sm">{recipe.name}</span>
      {suggested && (
        <Badge variant="secondary" className="text-[10px] px-1.5 shrink-0">
          {suggestedLabel}
        </Badge>
      )}
      <span className="text-xs text-muted-foreground shrink-0">{formatCurrency(price)}</span>
    </label>
  )
}
