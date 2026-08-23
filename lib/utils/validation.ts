import * as z from "zod"
import type { Classification } from "@/types/recipe"
import { classifications } from "@/types/recipe"
import type { Category, Unit } from "@/types/ingredient"
import { categories, units } from "@/types/ingredient"

// Recipe Validation Schemas
export const recipeIngredientSchema = z.object({
  id: z.number(),
  ingredientId: z.string().nullable(),
  quantity: z.number().min(0),
  category: z.string(),
  name: z.string().min(1),
  measure: z.string(),
  unitCost: z.number().min(0),
  costPerMeasure: z.number().min(0),
  extension: z.number().min(0),
})

export const recipeProcedureSchema = z.object({
  id: z.number(),
  step: z.string().min(1),
  time: z.number().optional(),
  temperature: z.number().optional(),
  notes: z.string().optional(),
})

export const recipeImageSchema = z.object({
  url: z.string().url(),
  alt: z.string(),
  width: z.number().positive(),
  height: z.number().positive(),
})

export const recipeCostsSchema = z.object({
  productionCost: z.number().min(0),
  unitCost: z.number().min(0),
  unitProfit: z.number().min(0),
  customUnitProfit: z.number().optional(),
  unitPrice: z.number().min(0),
  totalPrice: z.number().min(0),
  netProfit: z.number(),
  contributionMargin: z.number(),
})

export const recipeMetadataSchema = z.object({
  createdAt: z.string(),
  updatedAt: z.string(),
  lastCalculatedAt: z.string(),
  version: z.number().positive(),
})

export const recipeSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  classification: z.enum(classifications),
  plate: z.string(),
  yield: z.number().positive(),
  ingredients: z.array(recipeIngredientSchema),
  procedure: z.array(recipeProcedureSchema),
  costs: recipeCostsSchema,
  metadata: recipeMetadataSchema,
  image: recipeImageSchema.optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
  businessId: z.string().optional(),
})

// Ingredient Validation Schemas
export const ingredientPriceSchema = z.object({
  purchasePrice: z.number().min(0),
  netContent: z.number().positive(),
  pricePerUnit: z.number().min(0),
  lastUpdated: z.string(),
})

export const ingredientMetadataSchema = z.object({
  createdAt: z.string(),
  updatedAt: z.string(),
  version: z.number().positive(),
})

export const ingredientSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  category: z.enum(categories),
  unit: z.enum(units),
  pricing: ingredientPriceSchema,
  supplier: z.string(),
  metadata: ingredientMetadataSchema,
  notes: z.string().optional(),
  alternativeIds: z.array(z.string()).optional(),
  businessId: z.string().optional(),
})

// Business Validation Schemas
export const businessExpensesSchema = z.object({
  rent: z.number().min(0),
  utilities: z.number().min(0),
  operationalCosts: z.number().min(0),
  marketing: z.number().min(0),
  laborCosts: z.number().min(0),
  otherExpenses: z.number().min(0),
})

export const businessSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  hasCustomizedCosts: z.boolean(),
  expenses: businessExpensesSchema.optional(),
  estimatedMonthlyPlates: z.number().optional(),
  netProfitPercentage: z.number(),
  createdAt: z.string(),
})

// Type Guards
export function isValidClassification(value: string): value is Classification {
  return classifications.includes(value as Classification)
}

export function isValidCategory(value: string): value is Category {
  return categories.includes(value as Category)
}

export function isValidUnit(value: string): value is Unit {
  return units.includes(value as Unit)
}

// Validation Functions
export function validateRecipe(data: unknown) {
  return recipeSchema.parse(data)
}

export function validateIngredient(data: unknown) {
  return ingredientSchema.parse(data)
}

export function validateBusiness(data: unknown) {
  return businessSchema.parse(data)
}
