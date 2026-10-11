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

// Desde docs/156 (decisión del dueño) el método por defecto es Food Cost %: es el número
// que entiende un chef y el estándar de la industria. Los 6 rubros quedan como opción.
export const DEFAULT_PRICING_METHOD: PricingMethod = "food_cost"
// Recetas guardadas antes de que existiera el campo pricingMethod se costearon con los 6
// rubros (y así las leen el PDF y los correos): al abrirlas se respeta eso, para que su
// precio no cambie solo por haber cambiado el default.
export const LEGACY_PRICING_METHOD: PricingMethod = "gastrometrics"
export const DEFAULT_TARGET_FOOD_COST_PERCENT = 30

export interface Business {
  id: string
  // uid real del dueño de este negocio (columna owner_id de la tabla businesses,
  // ver rowToBusiness en lib/storage/businesses.ts). Opcional porque objetos Business
  // construidos localmente antes de guardarse (ver add-business-dialog.tsx) no lo
  // traen todavía — solo está garantizado en lo que devuelve Supabase. Se usa para
  // distinguir "este negocio es mío" de "me lo compartió su dueño" (ver lib/plan-access.ts).
  ownerId?: string
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
