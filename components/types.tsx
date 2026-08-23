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
