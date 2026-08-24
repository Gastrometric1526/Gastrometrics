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
import { Building2, DollarSign, Calculator, Percent, Lock, ArrowRight, Lightbulb } from "lucide-react"
import type { Business, PricingMethod } from "@/types/business"
import { DEFAULT_PRICING_METHOD, DEFAULT_TARGET_FOOD_COST_PERCENT } from "@/types/business"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { getMaxBusinesses, getCurrentPlan } from "@/lib/plan-access"
import { getCurrentCurrencyOption } from "@/lib/currency"
import { getAllBusinesses, addBusiness } from "@/lib/storage/businesses"
import Link from "next/link"

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
  const { toast } = useToast()

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
          title: "Error",
          description: "El nombre del negocio es requerido.",
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

      const expenses = {
        rent: Number(formData.rent) || 0,
        utilities: Number(formData.utilities) || 0,
        operationalCosts: Number(formData.operationalCosts) || 0,
        marketing: Number(formData.marketing) || 0,
        laborCosts: Number(formData.laborCosts) || 0,
        otherExpenses: Number(formData.otherExpenses) || 0,
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

      // Reset form
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
      setStep(1)

      toast({
        title: "¡Negocio creado exitosamente!",
        description: `${newBusiness.name} ha sido configurado y está listo para usar.`,
      })
    } catch (error) {
      console.error("Error creating business:", error)
      toast({
        title: "Error",
        description: "Hubo un problema al crear el negocio. Inténtalo de nuevo.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

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

  if (limitReached) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Límite de negocios alcanzado
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center text-center gap-4 py-4">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">
              Tu plan <span className="font-semibold text-foreground">{currentPlan.name}</span> permite hasta{" "}
              {maxBusinesses} negocio{maxBusinesses !== 1 ? "s" : ""}. Ya tienes {existingBusinessCount} registrado
              {existingBusinessCount !== 1 ? "s" : ""}.
            </p>
            <Link href="/planes">
              <Button className="gap-2">
                Ver planes
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Crear Nuevo Negocio
          </DialogTitle>
          <DialogDescription>
            {step === 1 && "Configura la información básica de tu negocio"}
            {step === 2 && "Detalla tus gastos mensuales para análisis precisos"}
            {step === 3 && "Elige cómo quieres calcular el precio de venta en este negocio"}
          </DialogDescription>
        </DialogHeader>

        {/* Indicador de paso — mismo patrón que app/signup/page.tsx, antes ausente aquí
            aunque es el mismo tipo de flujo de varios pasos (ver feedback del dueño). */}
        <div className="space-y-1.5 shrink-0">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              Paso {step} de {TOTAL_STEPS}
            </span>
            <span>{Math.round((step / TOTAL_STEPS) * 100)}%</span>
          </div>
          <Progress value={(step / TOTAL_STEPS) * 100} className="h-1.5" />
        </div>

        <div className="flex-1 overflow-y-auto pr-2">
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre del Negocio *</Label>
                <Input
                  id="name"
                  placeholder="Ej: Restaurante La Cocina"
                  value={formData.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descripción</Label>
                <Textarea
                  id="description"
                  placeholder="Breve descripción de tu negocio..."
                  value={formData.description}
                  onChange={(e) => handleInputChange("description", e.target.value)}
                  className="w-full min-h-[80px]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">Tipo de Negocio</Label>
                <Select value={formData.type} onValueChange={(value) => handleInputChange("type", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona el tipo de negocio" />
                  </SelectTrigger>
                  <SelectContent>
                    {businessTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
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
                    Gastos Mensuales Detallados
                  </CardTitle>
                  <CardDescription>Especifica tus gastos mensuales para obtener análisis más precisos.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="rent">Renta/Alquiler ({currencySymbol})</Label>
                      <Input
                        id="rent"
                        type="number"
                        step="0.01"
                        placeholder="Ej: 5000"
                        value={formData.rent}
                        onChange={(e) => handleInputChange("rent", e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="utilities">Servicios públicos ({currencySymbol})</Label>
                      <Input
                        id="utilities"
                        type="number"
                        step="0.01"
                        placeholder="Ej: 800"
                        value={formData.utilities}
                        onChange={(e) => handleInputChange("utilities", e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="operationalCosts">Costos operativos ({currencySymbol})</Label>
                      <Input
                        id="operationalCosts"
                        type="number"
                        step="0.01"
                        placeholder="Ej: 3000"
                        value={formData.operationalCosts}
                        onChange={(e) => handleInputChange("operationalCosts", e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="marketing">Marketing y publicidad ({currencySymbol})</Label>
                      <Input
                        id="marketing"
                        type="number"
                        step="0.01"
                        placeholder="Ej: 1200"
                        value={formData.marketing}
                        onChange={(e) => handleInputChange("marketing", e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="laborCosts">Costos laborales ({currencySymbol})</Label>
                      <Input
                        id="laborCosts"
                        type="number"
                        step="0.01"
                        placeholder="Ej: 8000"
                        value={formData.laborCosts}
                        onChange={(e) => handleInputChange("laborCosts", e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="otherExpenses">Otros gastos ({currencySymbol})</Label>
                      <Input
                        id="otherExpenses"
                        type="number"
                        step="0.01"
                        placeholder="Ej: 500"
                        value={formData.otherExpenses}
                        onChange={(e) => handleInputChange("otherExpenses", e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="mt-4 p-3 bg-primary/5 border border-primary/20 rounded-lg flex items-start gap-2">
                    <Lightbulb className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <p className="text-sm text-foreground">
                      <strong>Consejo:</strong> Estos datos te ayudarán a calcular costos más precisos por plato y
                      establecer precios competitivos.
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
                    <span className="font-semibold">GastroMetrics (recomendado)</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Seis rubros (renta, servicios, marketing, operación, personal, ganancia neta) calculados sobre el
                    costo de producción de cada receta, más un solo redondeo al final. Más detallado, ideal si
                    quieres ver de dónde sale cada parte del precio.
                  </p>
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
                    <span className="font-semibold">Food Cost % (estándar de industria)</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Precio = Costo de producción ÷ % de food cost objetivo (típico: 28-35%). Un solo número, más
                    simple, común en restaurantes que ya trabajan con este indicador.
                  </p>
                </button>
              </div>

              {pricingMethod === "food_cost" && (
                <div className="space-y-2">
                  <Label htmlFor="targetFoodCostPercent">Food cost objetivo (%)</Label>
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

              <p className="text-xs text-muted-foreground">
                Puedes cambiar esto después desde cada ficha técnica, o venir a ajustarlo aquí más adelante, este es
                solo el punto de partida por defecto para las recetas nuevas de este negocio.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-4 border-t shrink-0">
          {step > 1 && (
            <Button variant="outline" onClick={handleBack} className="w-full sm:w-auto bg-transparent">
              Atrás
            </Button>
          )}

          {step < 3 ? (
            <Button onClick={handleNext} className="w-full sm:w-auto">
              Siguiente
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={loading} className="w-full sm:w-auto">
              {loading ? "Creando..." : "Crear Negocio"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
