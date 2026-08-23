export const classifications = [
  "Línea caliente (Cuisine chaude)",
  "Línea fría (Garde-manger / Cuisine froide)",
  "Salsas y fondos (Saucier)",
  "Pescados (Poissonnier)",
  "Carnes y asados (Rôtisseur)",
  "Parrilla (Grillardin)",
  "Frituras (Friturier)",
  "Vegetales y guarniciones (Entremetier)",
  "Panadería (Boulangerie)",
  "Bollería (Viennoiserie)",
  "Pastelería (Pâtisserie)",
  "Chocolatería/Confitería (Chocolaterie/Confiserie)",
  "Heladería (Glacerie)",
  "Charcutería y curados (Charcuterie/Salaison)",
  "Fermentación y conservas (Fermentation/Conserverie)",
  "Sub Receta / produccion (Mise en place)",
  "I+D (R&D)",
] as const

export type Classification = (typeof classifications)[number]

export const SUBRECIPE_CLASSIFICATION = "Sub Receta / produccion (Mise en place)"

export const recipeSteps = [
  "Bienvenida",
  "Amuse-bouche",
  "Pan y mantequilla",
  "Entrada",
  "Entrada fría",
  "Entrada caliente",
  "Sopa",
  "Consomé",
  "Intermedio vegetal",
  "Pasta",
  "Arroz",
  "Plato intermedio",
  "Pescado",
  "Mariscos",
  "Carne blanca",
  "Carne roja",
  "Vegetariano",
  "Vegano",
  "Limpieza de paladar",
  "Plato fuerte",
  "Plato compartido",
  "Quesos",
  "Prepostre",
  "Postre",
  "Postre de chocolate",
  "Petit fours",
  "Café",
  "Té",
  "Infusión",
  "Digestivo",
  "Maridaje de cierre",
  "Pan dulce",
  "Degustación especial",
  "Menú infantil",
  "Cierre de experiencia",
] as const

export type RecipeStep = (typeof recipeSteps)[number]

export const plateTypes = ["INDIVIDUAL", "FAMILIAR", "BUFFET", "CATERING", "DEGUSTACIÓN", "OTROS"] as const

export type PlateType = (typeof plateTypes)[number]

export interface PricingConfig {
  publicServices: number // %
  marketing: number // %
  operationalCosts: number // %
  laborCosts: number // %
  netProfit: number // %
  isv: number // %
  isDefault?: boolean // Whether this is saved as default
}

// Default pricing configuration
export const defaultPricingConfig: PricingConfig = {
  publicServices: 10,
  marketing: 10,
  operationalCosts: 30,
  laborCosts: 35,
  netProfit: 25,
  isv: 0,
  isDefault: true,
}

export interface RecipeIngredient {
  id: string
  ingredientId: string | null
  name: string
  category: string
  quantity: number
  unit: string
  measure: string
  cost: number
  unitCost: number
  costPerMeasure: number
  extension?: number
  originalIndex?: number
  notes?: string
}

export interface RecipeMetadata {
  createdAt: string
  updatedAt: string
  version: number
  copiedFrom?: string
  migratedFrom?: string
  migratedAt?: string
  exportedAt?: string // Added for PDF export tracking
  lastExportType?: string // Track last export type
}

export interface RecipeOriginalCosts {
  totalCost: number
  costPerServing: number
  ingredientsCost: number
  timestamp: string | number
}

export interface Recipe {
  // Basic Info
  id: string
  name: string
  classification: string
  plate: string
  step?: string // Added step field for course/step in menu

  // Yield/Servings
  servings: number
  yieldAmount: number
  yieldUnit: string
  yieldByWeight?: number // Calculated from total ingredient quantities (rendimiento en peso)
  yieldPerGram?: number // Deprecated, use yieldByWeight

  // Ingredients & Procedure
  ingredients: RecipeIngredient[]
  procedure: string[]
  observations?: string[]

  // Costs
  totalCost: number
  costPerServing: number
  ingredientsCost?: number
  originalCosts?: RecipeOriginalCosts

  // Pricing (optional)
  unitPrice?: number
  totalPrice?: number
  netProfit?: number
  contributionMargin?: number
  customUnitProfit?: number
  // El precio de venta calculado es siempre una sugerencia — si el usuario lo edita
  // directamente, ese valor manda y se guarda aquí; si nunca lo toca, se guarda el
  // sugerido tal cual (ver components/technical-sheet/index.tsx).
  customUnitPrice?: number

  pricingConfig?: PricingConfig
  publicServices?: number
  marketing?: number
  operationalCosts?: number
  laborCosts?: number
  isv?: number
  // Método de costeo elegido para esta receta puntual — si no está definido, se usa el
  // método por defecto del negocio (Business.pricingMethod). Ver types/business.ts.
  pricingMethod?: "gastrometrics" | "food_cost"
  targetFoodCostPercent?: number

  // Business & Metadata
  businessId: string
  metadata: RecipeMetadata

  // Additional fields
  image?: string
  notes?: string
  isSubRecipe?: boolean
  subRecipeId?: string
  presentation?: string // Added presentation field for subrecipes

  // Legacy support
  createdAt?: string | number
  updatedAt?: string | number
  migratedAt?: string | number
  originalBusinessId?: string

  // Sub-recipes
  subRecipes?: any[]

  // Rendimiento e ingredientes tal como estaban ANTES de guardar la receta con un
  // Modificador de PAX activo — permite el botón "Restaurar receta original" en
  // Ficha Técnica. Se guarda una sola vez (la primera vez que se persiste una
  // versión escalada) y no se vuelve a sobreescribir en guardados posteriores,
  // para que siempre apunte al original real, no a un estado intermedio ya escalado.
  originalSnapshot?: {
    yieldAmount: number
    ingredients: RecipeIngredient[]
  }
}

export interface RecipeData {
  basicInfo: {
    name: string
    classification: string
    plate: string
    step?: string // Added step
    yieldAmount: number
    yieldUnit: string
    lastRevision: string
    contributionMargin?: number
    customUnitProfit?: number
    image?: string
    presentation?: string // For subrecipes
  }
  ingredients: RecipeIngredient[]
  procedures: string[]
  paxModifier: number | null
  originalIngredients: RecipeIngredient[]
  pricingConfig?: PricingConfig // Added pricing config
}

export type PDFExportType = "administrative" | "employee" | "normal"

export interface PDFExportOptions {
  type: PDFExportType
  includeImage?: boolean
  includeCosts?: boolean
  includePricing?: boolean
  includeNotes?: boolean
  businessName?: string
  businessLogo?: string
}
