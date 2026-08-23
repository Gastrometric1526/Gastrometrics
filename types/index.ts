export interface User {
  id: string
  name: string
  email: string
  image?: string
}

export interface Business {
  id: string
  name: string
  hasCustomizedCosts: boolean
  expenses?: BusinessExpenses
  estimatedMonthlyPlates?: number
  netProfitPercentage: number
  createdAt: string
}

export interface BusinessExpenses {
  rent: number
  utilities: number
  operationalCosts: number
  marketing: number
  laborCosts: number
  otherExpenses: number
}

export interface Recipe {
  id: string
  name: string
  classification: Classification
  plate: string
  yield: number
  ingredients: RecipeIngredient[]
  procedure: string[]
  totalCost: number
  unitCost: number
  unitProfit: number
  customUnitProfit?: number
  unitPrice: number
  totalPrice: number
  netProfit: number
  contributionMargin: number
  createdAt: string
  image?: string
  unit?: string
}

export interface RecipeIngredient {
  id: number
  ingredientId: string | null
  quantity: number
  category: string
  name: string
  measure: string
  unitCost: number
  costPerMeasure: number
  extension: number
}

export interface Ingredient {
  id: string
  name: string
  category: string
  unit: string
  purchasePrice: number
  netContent: number
  pricePerUnit: number
  supplier: string
  isSubRecipe?: boolean
  subRecipeId?: string
  subRecipeYield?: number
}

export const classifications = [
  "Barismo",
  "Bebidas Generales",
  "Chocolatería",
  "Cocina Fría",
  "Cocina Caliente",
  "Coctelería",
  "Sub Receta",
  "Cocina Molecular",
  "Heladería",
  "Panadería",
  "Pastelería",
  "Repostería",
  "Salsas",
  "Fermentos",
] as const

export type Classification = (typeof classifications)[number]

export const categories = [
  "ACEITES",
  "ALCOHOL",
  "AVES",
  "BEBIDAS",
  "CAFÉ",
  "CERDO",
  "CHOCOLATE",
  "GAME",
  "DESECHABLES",
  "DULCE",
  "EMBUTIDO",
  "ESENCIA",
  "ESPECIAS",
  "FIDEOS",
  "FLORES",
  "FRUTA",
  "GRANOS",
  "GRASAS",
  "GUARNICIÓN",
  "HARINA",
  "HIERBAS",
  "LÁCTEOS Y DERIVADOS",
  "LEVADURA",
  "MARISCOS",
  "MASA",
  "MOLECULAR",
  "NUECES",
  "OTROS",
  "PESCADO",
  "REPOSTERÍA",
  "RES",
  "SAL",
  "SECOS Y ABARROTES",
  "SIROPES",
  "VEGETAL",
] as const

export const units = ["KILOGRAMO", "LITRO", "UNIDAD"] as const

export interface PurchaseOrderItem {
  id: string
  name: string
  quantity: number
  measure: string
  costPerMeasure: number
  purchaseCost: number
  quantityToBuy: number
  supplier: string
}

export interface PurchaseOrder {
  id: string
  name: string
  number: number
  date: string
  items: PurchaseOrderItem[]
  total: number
}
