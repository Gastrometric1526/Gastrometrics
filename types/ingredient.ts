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
  "HUEVO",
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
  "Sub Receta / produccion (Mise en place)", // Updated from "SUB RECETA" to match new classification
  "VEGETAL",
] as const

export type Category = (typeof categories)[number]

export const units = [
  "gramos",
  "kilogramos",
  "mililitros",
  "litros",
  "onzas",
  "onzas líquidas",
  "libras",
  "galones",
  "unidad",
] as const

// Mapeo de unidades a sus abreviaturas
export const unitAbbreviations: Record<string, string> = {
  gramos: "g",
  kilogramos: "kg",
  mililitros: "ml",
  litros: "L",
  onzas: "oz",
  "onzas líquidas": "fl oz",
  libras: "lb",
  galones: "gal",
  unidad: "un",
}

export type Unit = (typeof units)[number]

export const presentations = [
  "Lata",
  "Botella",
  "Frasco",
  "Caja",
  "Bolsa",
  "Bote",
  "Paquete",
  "Envase plástico",
  "Saco",
  "Tarrina",
  "Tetra Pak",
  "Ampolla",
  "Sobre",
  "Granel",
] as const

export type Presentation = (typeof presentations)[number]

export interface IngredientPrice {
  purchasePrice: number
  netContent: number
  pricePerUnit: number
  lastUpdated: string
  // Costo promedio ponderado por cantidad comprada (método de costo móvil), acumulado
  // a través de cada "Nueva Compra" registrada en Inventario. pricePerUnit refleja solo
  // la última compra (usado para el costeo de recetas, ver lib/recalculate.ts); estos dos
  // campos son un dato adicional de valuación de inventario, no reemplazan ese costeo.
  weightedAverageCost?: number
  weightedAverageQuantity?: number
}

export interface IngredientMetadata {
  createdAt: string
  updatedAt: string
  version: number
  // Presentes solo en ingredientes creados por una migración entre negocios
  // (ver lib/subrecipe/migration.ts) — de qué negocio vino y cuándo.
  migratedFrom?: string
  migratedAt?: string
}

// Add this interface for recipe data linking
export interface RecipeDataLink {
  originalRecipeId: string
  recipeName: string
  recipeClassification: string
  recipePlate?: string
  recipeYield: number
  recipeTotalCost: number
  recipeUnitCost: number
  recipeUnitProfit: number
  recipeContributionMargin: number
  recipeIngredients: any[]
  recipeProcedures: string[]
  recipeImage?: string
  lastSyncedAt: string
}

// Update the Ingredient interface to include recipe linking
export interface Ingredient {
  id: string
  name: string
  category: Category
  unit: Unit
  pricing: IngredientPrice
  supplier: string
  metadata: IngredientMetadata
  notes?: string
  alternativeIds?: string[]
  businessId?: string
  presentation?: Presentation
  previousUnit?: Unit // Añadimos campo para almacenar la unidad anterior
  originalNetContent?: number // Para preservar el contenido neto original
  // Estado real de merma de este ingrediente — usado por components/merma-management-dialog.tsx
  // e ingredients-table.tsx. Campo declarado aquí por primera vez: existía en tiempo de
  // ejecución desde antes, pero faltaba en el tipo (ver docs/38, hallazgo de auditoría).
  merma?: {
    enabled: boolean
    useGlobal: boolean
    globalPercentage: number
    customType: "percentage" | "quantity"
    customPercentage: number
    customValue: number
  }
  // Enhanced recipe linking properties
  recipeId?: string // Links to the original recipe ID
  recipeData?: RecipeDataLink // Complete recipe data for sub-recipes
  unitLocked?: boolean
}
