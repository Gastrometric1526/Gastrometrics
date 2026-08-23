// Mapping of categories to their shrinkage percentages
export const mermaPorCategoria: Record<string, number> = {
  ACEITES: 0,
  ALCOHOL: 0,
  AVES: 27,
  BEBIDAS: 2,
  CAFÉ: 0,
  CERDO: 32,
  CHOCOLATE: 0,
  GAME: 38,
  DESECHABLES: 0,
  DULCE: 6,
  EMBUTIDO: 12,
  ESENCIA: 0,
  ESPECIAS: 9,
  FIDEOS: 3,
  FLORES: 15,
  FRUTA: 24,
  GRANOS: 6,
  GRASAS: 0,
  GUARNICIÓN: 11,
  HARINA: 1,
  HIERBAS: 22,
  HUEVO: 12,
  "LÁCTEOS Y DERIVADOS": 12, // Ensure dairy products have 12% waste
  LEVADURA: 0,
  MARISCOS: 63,
  MASA: 0,
  MOLECULAR: 0,
  NUECES: 5,
  OTROS: 0,
  PESCADO: 52,
  REPOSTERÍA: 9,
  RES: 33,
  SAL: 0,
  "SECOS Y ABARROTES": 3,
  SIROPES: 0,
  VEGETAL: 21,
}

// Merma categories with their default percentages (keeping both for compatibility)
export const MERMA_CATEGORIES = {
  ACEITES: 0,
  ALCOHOL: 0,
  AVES: 27,
  BEBIDAS: 2,
  CAFÉ: 0,
  CERDO: 32,
  CHOCOLATE: 0,
  GAME: 38,
  DESECHABLES: 0,
  DULCE: 6,
  EMBUTIDO: 12,
  ESENCIA: 0,
  ESPECIAS: 9,
  FIDEOS: 3,
  FLORES: 15,
  FRUTA: 24,
  GRANOS: 6,
  GRASAS: 0,
  GUARNICIÓN: 11,
  HARINA: 1,
  HIERBAS: 22,
  HUEVO: 12,
  "LÁCTEOS Y DERIVADOS": 12,
  LEVADURA: 0,
  MARISCOS: 63,
  MASA: 0,
  MOLECULAR: 0,
  NUECES: 5,
  OTROS: 0,
  PESCADO: 52,
  REPOSTERÍA: 9,
  RES: 33,
  SAL: 0,
  "SECOS Y ABARROTES": 3,
  SIROPES: 0,
  VEGETAL: 21,
} as const

// Get the shrinkage percentage for a specific category with validation
export function getCategoryMermaPercentage(category: string): number {
  // Normalize category name to handle case variations
  const normalizedCategory = category.toUpperCase().trim()

  // Check for exact match first
  if (mermaPorCategoria[normalizedCategory] !== undefined) {
    return mermaPorCategoria[normalizedCategory]
  }

  // Check for partial matches for dairy products
  if (normalizedCategory.includes("LÁCTEO") || normalizedCategory.includes("LACTEO")) {
    return 12
  }

  // Default to 0 if category not found
  console.warn(`Category "${category}" not found in merma categories, defaulting to 0%`)
  return 0
}

// Calculate the adjusted content based on category shrinkage with validation
export function calculateCategoryMerma(originalContent: number, category: string): number {
  if (originalContent <= 0) {
    console.warn(`Invalid original content: ${originalContent}`)
    return originalContent
  }

  const percentage = getCategoryMermaPercentage(category)
  if (percentage <= 0) return originalContent

  const adjustedContent = originalContent * (1 - percentage / 100)

  // Ensure the result is positive and reasonable
  if (adjustedContent <= 0) {
    console.warn(`Calculated adjusted content is invalid: ${adjustedContent} for category ${category}`)
    return originalContent * 0.01 // Return 1% of original as minimum
  }

  return adjustedContent
}

// Get shrinkage level description
export function getMermaLevel(percentage: number): string {
  if (percentage === 0) return "Ninguna"
  if (percentage <= 10) return "Baja"
  if (percentage <= 25) return "Media"
  if (percentage <= 40) return "Alta"
  return "Muy Alta"
}

// Get yield factor (inverse of shrinkage)
export function getYieldFactor(percentage: number): number {
  return 1 - percentage / 100
}

export function getAllMermaCategories() {
  return Object.entries(MERMA_CATEGORIES).map(([category, percentage]) => ({
    category,
    percentage,
  }))
}
