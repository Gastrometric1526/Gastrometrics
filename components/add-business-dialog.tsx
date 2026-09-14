"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Building2, DollarSign, Calculator, Percent, Lock, ArrowRight, Lightbulb, ChefHat, Loader2, PartyPopper } from "lucide-react"
import type { Business, PricingMethod } from "@/types/business"
import { DEFAULT_PRICING_METHOD, DEFAULT_TARGET_FOOD_COST_PERCENT } from "@/types/business"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { getMaxBusinesses, getCurrentPlan } from "@/lib/plan-access"
import { getCurrentCurrencyOption } from "@/lib/currency"
import { getAllBusinesses, addBusiness } from "@/lib/storage/businesses"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useLanguage } from "@/contexts/language-context"
import { useAuth } from "@/contexts/auth-context"
import { getOrSeedExampleRecipe } from "@/lib/services/seed-example-recipe"

interface AddBusinessDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onBusinessAdded: (business: Business) => void
}

const TOTAL_STEPS = 3

export function AddBusinessDialog({ open, onOpenChange, onBusinessAdded }: AddBusinessDialogProps) {
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    type: "",
    rent: "",
    utilities: "",
    operationalCosts: "",
    marketing: "",
    laborCosts: "",
    otherExpenses: "",
  })
  const [pricingMethod, setPricingMethod] = useState<PricingMethod>(DEFAULT_PRICING_METHOD)
  const [targetFoodCostPercent, setTargetFoodCostPercent] = useState(DEFAULT_TARGET_FOOD_COST_PERCENT)
  const [loading, setLoading] = useState(false)
  // Negocio recién creado, mientras se muestra la pantalla de "listo" (paso 4) — no es
  // parte del asistente de 3 pasos, es la bisagra para ofrecer el plato de ejemplo
  // dentro de ESTE negocio nuevo en vez de que quede una pantalla vacía (feedback de
  // producto: "aha moment en los primeros 5 minutos"). Sembrar solo si el usuario lo
  // pide con este botón — nunca en segundo plano, ver lib/services/seed-example-recipe.ts.
  const [createdBusiness, setCreatedBusiness] = useState<Business | null>(null)
  const [isSeedingExample, setIsSeedingExample] = useState(false)
  const { toast } = useToast()
  const { t, language } = useLanguage()
  const { user } = useAuth()
  const router = useRouter()

  // Limite de negocios por plan (ver docs, tabla de precios confirmada por el dueño
  // del proyecto): se revisa al abrir el dialogo, no en cada tecla, para no leer
  // localStorage de mas.
  const existingBusinessCount = open ? getAllBusinesses().length : 0
  const maxBusinesses = getMaxBusinesses()
  const currentPlan = getCurrentPlan()
  const limitReached = existingBusinessCount >= maxBusinesses
  // BUG CORREGIDO: estos campos mostraban "$" fijo sin importar la moneda elegida en
  // Configuración — el resto de la app (formatCurrency) sí respeta esa elección.
  const currencySymbol = open ? getCurrentCurrencyOption().symbol : "$"

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleNext = () => {
    if (step === 1) {
      if (!formData.name.trim()) {
        toast({
          title: t("addbiz_toast_error_title"),
          description: t("addbiz_toast_name_required_desc"),
          variant: "destructive",
        })
        return
      }
      setStep(2)
    } else if (step === 2) {
      setStep(3)
    }
  }

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1)
    }
  }

  const handleSubmit = async () => {
    setLoading(true)

    try {
      const hasFinancialData = !!(
        formData.rent ||
        formData.utilities ||
        formData.operationalCosts ||
        formData.marketing ||
        formData.laborCosts ||
        formData.otherExpenses
      )

      // BUG CORREGIDO: los inputs son type="number" con min="0", pero eso no bloquea
      // escribir un negativo a mano — sin este guard, un gasto negativo se colaba en
      // cada cálculo de food cost/margen que suma business.expenses.
      const expenses = {
        rent: Math.max(0, Number(formData.rent) || 0),
        utilities: Math.max(0, Number(formData.utilities) || 0),
        operationalCosts: Math.max(0, Number(formData.operationalCosts) || 0),
        marketing: Math.max(0, Number(formData.marketing) || 0),
        laborCosts: Math.max(0, Number(formData.laborCosts) || 0),
        otherExpenses: Math.max(0, Number(formData.otherExpenses) || 0),
      }

      const newBusiness: Business = {
        id: `business_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        type: formData.type || "Restaurante",
        createdAt: new Date().toISOString(),
        hasFinancialData,
        expenses: hasFinancialData ? expenses : undefined,
        hasCustomizedCosts: hasFinancialData,
        netProfitPercentage: 35, // Default value instead of user input
        isActive: true,
        pricingMethod,
        targetFoodCostPercent: pricingMethod === "food_cost" ? targetFoodCostPercent : undefined,
      }

      await addBusiness(newBusiness)

      onBusinessAdded(newBusiness)

      // Reset form (pero se queda en el paso 4 — "listo" — en vez de volver al 1, para
      // ofrecer el plato de ejemplo antes de cerrar; ver createdBusiness arriba).
      setFormData({
        name: "",
        description: "",
        type: "",
        rent: "",
        utilities: "",
        operationalCosts: "",
        marketing: "",
        laborCosts: "",
        otherExpenses: "",
      })
      setPricingMethod(DEFAULT_PRICING_METHOD)
      setTargetFoodCostPercent(DEFAULT_TARGET_FOOD_COST_PERCENT)
      setStep(4)
      setCreatedBusiness(newBusiness)

      toast({
        title: t("addbiz_toast_created_title"),
        description: t("addbiz_toast_created_desc").replace("{name}", newBusiness.name),
      })
    } catch (error) {
      console.error("Error creating business:", error)
      toast({
        title: t("addbiz_toast_error_title"),
        description: t("addbiz_toast_create_error_desc"),
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  // Cierra el dialogo y lo deja listo para la próxima vez que se abra (crear otro
  // negocio desde cero, no reabrir en la pantalla de "listo" del anterior).
  const handleCloseAfterCreate = () => {
    setCreatedBusiness(null)
    setStep(1)
    onOpenChange(false)
  }

  const handleSeedExampleForNewBusiness = async () => {
    if (!user || !createdBusiness) return
    setIsSeedingExample(true)
    try {
      const recipeId = await getOrSeedExampleRecipe(user.id, language, createdBusiness.id)
      setCreatedBusiness(null)
      setStep(1)
      onOpenChange(false)
      router.push(`/ficha-tecnica/${recipeId}?business=${createdBusiness.id}&mode=edit`)
    } catch (error) {
      console.error("Error creando la receta de ejemplo:", error)
      toast({
        title: t("addbiz_toast_error_title"),
        description: t("addbiz_seed_example_error_desc"),
        variant: "destructive",
      })
    } finally {
      setIsSeedingExample(false)
    }
  }

  // Los VALORES canónicos se mantienen en español (lo que se guarda en el negocio);
  // solo la etiqueta que ve el usuario se traduce, siguiendo el mismo patrón que
  // lib/classification-labels.ts y lib/ingredient-labels.ts.
  const businessTypes = [
    "Restaurante",
    "Cafetería",
    "Panadería",
    "Pastelería",
    "Food Truck",
    "Catering",
    "Bar",
    "Pizzería",
    "Comida Rápida",
    "Otro",
  ]

  const getBusinessTypeLabel = (type: string): string => {
    switch (type) {
      case "Restaurante":
        return t("addbiz_type_restaurante")
      case "Cafetería":
        return t("addbiz_type_cafeteria")
      case "Panadería":
        return t("addbiz_type_panaderia")
      case "Pastelería":
        return t("addbiz_type_pasteleria")
      case "Food Truck":
        return t("addbiz_type_food_truck")
      case "Catering":
        return t("addbiz_type_catering")
      case "Bar":
        return t("addbiz_type_bar")
      case "Pizzería":
        return t("addbiz_type_pizzeria")
      case "Comida Rápida":
        return t("addbiz_type_comida_rapida")
      case "Otro":
        return t("addbiz_type_otro")
      default:
        return type
    }
  }

  if (limitReached) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              {t("addbiz_limit_reached_title")}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center text-center gap-4 py-4">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">
              {t("addbiz_limit_reached_plan_prefix")}{" "}
              <span className="font-semibold text-foreground">{currentPlan.name}</span>{" "}
              {t("addbiz_limit_reached_allows")
                .replace("{max}", String(maxBusinesses))
                .replace("{count}", String(existingBusinessCount))}
            </p>
            <Link href="/planes">
              <Button className="gap-2">
                {t("addbiz_view_plans")}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  // Si se cierra el dialogo desde afuera (click fuera, Escape, la X) estando en el
  // paso 4, no debe reabrir la próxima vez ya parado en la pantalla de "listo" de un
  // negocio anterior.
  const handleDialogOpenChange = (next: boolean) => {
    if (!next) {
      setCreatedBusiness(null)
      setStep(1)
    }
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            {t("addbiz_dialog_title")}
          </DialogTitle>
          <DialogDescription>
            {step === 1 && t("addbiz_step1_desc")}
            {step === 2 && t("addbiz_step2_desc")}
            {step === 3 && t("addbiz_step3_desc")}
            {step === 4 && " "}
          </DialogDescription>
        </DialogHeader>

        {/* Indicador de paso — mismo patrón que app/signup/page.tsx, antes ausente aquí
            aunque es el mismo tipo de flujo de varios pasos (ver feedback del dueño).
            No se muestra en el paso 4 ("listo") — ese ya no es parte del asistente. */}
        {step <= TOTAL_STEPS && (
          <div className="space-y-1.5 shrink-0">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>
                {t("addbiz_step_indicator").replace("{step}", String(step)).replace("{total}", String(TOTAL_STEPS))}
              </span>
              <span>{Math.round((step / TOTAL_STEPS) * 100)}%</span>
            </div>
            <Progress value={(step / TOTAL_STEPS) * 100} className="h-1.5" />
          </div>
        )}

        <div className="flex-1 overflow-y-auto pr-2">
          {step === 4 && createdBusiness && (
            <div className="flex flex-col items-center text-center gap-4 py-6">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                <PartyPopper className="h-7 w-7 text-primary" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-lg font-semibold">
                  {t("addbiz_success_title").replace("{name}", createdBusiness.name)}
                </h3>
                <p className="text-sm text-muted-foreground max-w-sm">{t("addbiz_success_desc")}</p>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">{t("addbiz_field_name_label")}</Label>
                <Input
                  id="name"
                  placeholder={t("addbiz_field_name_placeholder")}
                  value={formData.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">{t("addbiz_field_description_label")}</Label>
                <Textarea
                  id="description"
                  placeholder={t("addbiz_field_description_placeholder")}
                  value={formData.description}
                  onChange={(e) => handleInputChange("description", e.target.value)}
                  className="w-full min-h-[80px]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">{t("addbiz_field_type_label")}</Label>
                <Select value={formData.type} onValueChange={(value) => handleInputChange("type", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("addbiz_field_type_placeholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {businessTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {getBusinessTypeLabel(type)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <Card className="border border-border bg-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-primary" />
                    {t("addbiz_expenses_card_title")}
                  </CardTitle>
                  <CardDescription>{t("addbiz_expenses_card_desc")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="rent">
                        {t("addbiz_field_rent_label")} ({currencySymbol})
                      </Label>
                      <Input
                        id="rent"
                        type="number"
                        step="0.01"
                        placeholder={t("addbiz_field_rent_placeholder")}
                        value={formData.rent}
                        onChange={(e) => handleInputChange("rent", e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="utilities">
                        {t("addbiz_field_utilities_label")} ({currencySymbol})
                      </Label>
                      <Input
                        id="utilities"
                        type="number"
                        step="0.01"
                        placeholder={t("addbiz_field_utilities_placeholder")}
                        value={formData.utilities}
                        onChange={(e) => handleInputChange("utilities", e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="operationalCosts">
                        {t("addbiz_field_operational_costs_label")} ({currencySymbol})
                      </Label>
                      <Input
                        id="operationalCosts"
                        type="number"
                        step="0.01"
                        placeholder={t("addbiz_field_operational_costs_placeholder")}
                        value={formData.operationalCosts}
                        onChange={(e) => handleInputChange("operationalCosts", e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="marketing">
                        {t("addbiz_field_marketing_label")} ({currencySymbol})
                      </Label>
                      <Input
                        id="marketing"
                        type="number"
                        step="0.01"
                        placeholder={t("addbiz_field_marketing_placeholder")}
                        value={formData.marketing}
                        onChange={(e) => handleInputChange("marketing", e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="laborCosts">
                        {t("addbiz_field_labor_costs_label")} ({currencySymbol})
                      </Label>
                      <Input
                        id="laborCosts"
                        type="number"
                        step="0.01"
                        placeholder={t("addbiz_field_labor_costs_placeholder")}
                        value={formData.laborCosts}
                        onChange={(e) => handleInputChange("laborCosts", e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="otherExpenses">
                        {t("addbiz_field_other_expenses_label")} ({currencySymbol})
                      </Label>
                      <Input
                        id="otherExpenses"
                        type="number"
                        step="0.01"
                        placeholder={t("addbiz_field_other_expenses_placeholder")}
                        value={formData.otherExpenses}
                        onChange={(e) => handleInputChange("otherExpenses", e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="mt-4 p-3 bg-primary/5 border border-primary/20 rounded-lg flex items-start gap-2">
                    <Lightbulb className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <p className="text-sm text-foreground">
                      <strong>{t("addbiz_tip_label")}</strong> {t("addbiz_tip_text")}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3">
                <button
                  type="button"
                  onClick={() => setPricingMethod("gastrometrics")}
                  className={cn(
                    "text-left rounded-lg border-2 p-4 transition-colors",
                    pricingMethod === "gastrometrics" ? "border-primary bg-primary/5" : "border-muted hover:bg-accent",
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Calculator className="h-5 w-5 text-primary" />
                    <span className="font-semibold">{t("addbiz_pricing_gastrometrics_title")}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{t("addbiz_pricing_gastrometrics_desc")}</p>
                </button>

                <button
                  type="button"
                  onClick={() => setPricingMethod("food_cost")}
                  className={cn(
                    "text-left rounded-lg border-2 p-4 transition-colors",
                    pricingMethod === "food_cost" ? "border-primary bg-primary/5" : "border-muted hover:bg-accent",
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Percent className="h-5 w-5 text-primary" />
                    <span className="font-semibold">{t("addbiz_pricing_food_cost_title")}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{t("addbiz_pricing_food_cost_desc")}</p>
                </button>
              </div>

              {pricingMethod === "food_cost" && (
                <div className="space-y-2">
                  <Label htmlFor="targetFoodCostPercent">{t("addbiz_field_target_food_cost_label")}</Label>
                  <Input
                    id="targetFoodCostPercent"
                    type="number"
                    step="0.1"
                    min={1}
                    max={99}
                    value={targetFoodCostPercent}
                    onChange={(e) => setTargetFoodCostPercent(Number(e.target.value) || DEFAULT_TARGET_FOOD_COST_PERCENT)}
                  />
                </div>
              )}

              <p className="text-xs text-muted-foreground">{t("addbiz_pricing_footnote")}</p>
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-4 border-t shrink-0">
          {step === 4 ? (
            <>
              <Button variant="outline" onClick={handleCloseAfterCreate} className="w-full sm:w-auto bg-transparent">
                {t("addbiz_success_skip_button")}
              </Button>
              <Button onClick={handleSeedExampleForNewBusiness} disabled={isSeedingExample} className="w-full sm:w-auto">
                {isSeedingExample ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <ChefHat className="h-4 w-4 mr-2" />
                )}
                {t("addbiz_success_seed_button")}
              </Button>
            </>
          ) : (
            <>
              {step > 1 && (
                <Button variant="outline" onClick={handleBack} className="w-full sm:w-auto bg-transparent">
                  {t("mw_back_button")}
                </Button>
              )}

              {step < 3 ? (
                <Button onClick={handleNext} className="w-full sm:w-auto">
                  {t("mw_next_button")}
                </Button>
              ) : (
                <Button onClick={handleSubmit} disabled={loading} className="w-full sm:w-auto">
                  {loading ? t("addbiz_creating") : t("addbiz_create_button")}
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
