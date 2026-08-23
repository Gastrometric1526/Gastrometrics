export interface BusinessExpenses {
  rent: number
  utilities: number
  operationalCosts: number
  marketing: number
  laborCosts: number
  otherExpenses: number
}

// Los dos métodos de costeo que puede usar un negocio para llegar al precio de venta.
// "gastrometrics": el método actual del sistema — seis rubros (renta, servicios, marketing,
// operación, personal, ganancia neta) como % sobre el costo de producción, sumados y
// redondeados al 5 más alto. Conservador: separa cada gasto real del negocio.
// "food_cost": el método estándar de la industria — Precio = Costo de Producción / Food Cost %
// objetivo (ej. costo objetivo 30% → precio = costo / 0.30). Más simple, un solo número.
export type PricingMethod = "gastrometrics" | "food_cost"

export const DEFAULT_PRICING_METHOD: PricingMethod = "gastrometrics"
export const DEFAULT_TARGET_FOOD_COST_PERCENT = 30

export interface Business {
  id: string
  name: string
  description?: string
  type?: string
  hasCustomizedCosts: boolean
  // Si el negocio tiene datos financieros propios configurados (renta, servicios, etc.)
  // vs. usando los valores por defecto — ver components/add-business-dialog.tsx.
  hasFinancialData?: boolean
  // Logo del negocio como data URI (PNG, comprimido en el navegador antes de guardar —
  // ver lib/utils/logo-compress.ts). Se usa en el encabezado de los PDFs que ya lo
  // soportan (Ficha Técnica, Orden de Compra); localStorage no tiene subida de archivos
  // real, por eso se guarda como texto en vez de una referencia a un archivo.
  logo?: string
  expenses?: BusinessExpenses
  estimatedMonthlyPlates?: number
  netProfitPercentage: number
  createdAt: string
  // Un negocio desactivado se conserva con todos sus datos (recetas, inventario, etc.)
  // pero se saca del conteo de "Negocios Activos" y queda marcado como archivado en
  // /negocios — no borra nada, es reversible. undefined/true = activo (default).
  isActive?: boolean
  // Método de costeo de este negocio. Si no está definido, se usa DEFAULT_PRICING_METHOD
  // (fallback) — así los negocios creados antes de este campo existir siguen funcionando
  // igual que siempre, sin migración de datos.
  pricingMethod?: PricingMethod
  // Solo aplica cuando pricingMethod === "food_cost". % de costo de producción objetivo
  // sobre el precio de venta final (estándar de industria: 28-35%).
  targetFoodCostPercent?: number
}

export const calculateTotalMonthlyExpenses = (expenses: BusinessExpenses): number => {
  return (
    expenses.rent +
    expenses.utilities +
    expenses.operationalCosts +
    expenses.marketing +
    expenses.laborCosts +
    expenses.otherExpenses
  )
}

export const calculateExpensePercentages = (expenses: BusinessExpenses): BusinessExpenses => {
  const total = calculateTotalMonthlyExpenses(expenses)
  return {
    rent: (expenses.rent / total) * 100,
    utilities: (expenses.utilities / total) * 100,
    operationalCosts: (expenses.operationalCosts / total) * 100,
    marketing: (expenses.marketing / total) * 100,
    laborCosts: (expenses.laborCosts / total) * 100,
    otherExpenses: (expenses.otherExpenses / total) * 100,
  }
}

export const roundToNextHundred = (value: number): number => {
  return Math.ceil(value / 100) * 100
}
