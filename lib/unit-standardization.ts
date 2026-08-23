import type { Unit } from "@/types/ingredient"

export interface UnitConversion {
  from: Unit
  to: Unit
  factor: number
}

export interface StandardizationConfig {
  defaultUnit: Unit
  conversions: UnitConversion[]
  forceStandardization: boolean
}

// Default standardization configuration
export const DEFAULT_STANDARDIZATION_CONFIG: StandardizationConfig = {
  defaultUnit: "gramos",
  forceStandardization: true,
  conversions: [
    { from: "kilogramos", to: "gramos", factor: 1000 },
    { from: "litros", to: "mililitros", factor: 1000 },
    { from: "onzas", to: "gramos", factor: 28.3495 },
    { from: "libras", to: "gramos", factor: 453.592 },
    { from: "onzas líquidas", to: "mililitros", factor: 29.5735 },
    { from: "galones", to: "mililitros", factor: 3785.41 },
  ],
}

/**
 * Standardizes units for sub-recipe ingredients
 */
export function standardizeUnit(
  originalUnit: Unit,
  config: StandardizationConfig = DEFAULT_STANDARDIZATION_CONFIG,
): { unit: Unit; conversionFactor: number } {
  if (!config.forceStandardization) {
    return { unit: originalUnit, conversionFactor: 1 }
  }

  // Check if conversion is needed
  const conversion = config.conversions.find((conv) => conv.from === originalUnit)

  if (conversion) {
    return {
      unit: conversion.to,
      conversionFactor: conversion.factor,
    }
  }

  // If no conversion found, return original or default
  if (originalUnit === "unidad") {
    return { unit: "unidad", conversionFactor: 1 }
  }

  // For liquids, prefer ml
  if (["mililitros", "litros", "onzas líquidas", "galones"].includes(originalUnit)) {
    return { unit: "mililitros", conversionFactor: 1 }
  }

  // For solids, prefer grams
  return { unit: config.defaultUnit, conversionFactor: 1 }
}

/**
 * Validates unit compatibility for sub-recipes
 */
export function validateUnitCompatibility(
  recipeIngredients: any[],
  targetUnit: Unit,
): { isCompatible: boolean; issues: string[] } {
  const issues: string[] = []

  // Check for mixed unit types that might be problematic
  const liquidUnits = ["mililitros", "litros", "onzas líquidas", "galones"]
  const solidUnits = ["gramos", "kilogramos", "onzas", "libras"]

  const hasLiquids = recipeIngredients.some((ing) => liquidUnits.includes(ing.measure))
  const hasSolids = recipeIngredients.some((ing) => solidUnits.includes(ing.measure))
  const hasUnits = recipeIngredients.some((ing) => ing.measure === "unidad")

  if (targetUnit === "gramos" && hasLiquids && !hasSolids) {
    issues.push("Recipe contains only liquids but target unit is grams")
  }

  if (targetUnit === "mililitros" && hasSolids && !hasLiquids) {
    issues.push("Recipe contains only solids but target unit is milliliters")
  }

  if (targetUnit === "unidad" && (hasLiquids || hasSolids) && !hasUnits) {
    issues.push("Recipe contains measured ingredients but target unit is units")
  }

  return {
    isCompatible: issues.length === 0,
    issues,
  }
}

/**
 * Suggests the best unit for a sub-recipe based on its ingredients
 */
export function suggestOptimalUnit(recipeIngredients: any[]): {
  suggestedUnit: Unit
  confidence: number
  reasoning: string
} {
  if (!recipeIngredients || recipeIngredients.length === 0) {
    return {
      suggestedUnit: "gramos",
      confidence: 0.5,
      reasoning: "No ingredients to analyze, defaulting to grams",
    }
  }

  const liquidUnits = ["mililitros", "litros", "onzas líquidas", "galones"]
  const solidUnits = ["gramos", "kilogramos", "onzas", "libras"]

  const liquidCount = recipeIngredients.filter((ing) => liquidUnits.includes(ing.measure)).length
  const solidCount = recipeIngredients.filter((ing) => solidUnits.includes(ing.measure)).length
  const unitCount = recipeIngredients.filter((ing) => ing.measure === "unidad").length

  const total = recipeIngredients.length

  if (liquidCount > solidCount && liquidCount > unitCount) {
    return {
      suggestedUnit: "mililitros",
      confidence: liquidCount / total,
      reasoning: `${liquidCount}/${total} ingredients are liquids`,
    }
  }

  if (unitCount > liquidCount && unitCount > solidCount) {
    return {
      suggestedUnit: "unidad",
      confidence: unitCount / total,
      reasoning: `${unitCount}/${total} ingredients are counted by units`,
    }
  }

  return {
    suggestedUnit: "gramos",
    confidence: Math.max(solidCount / total, 0.6),
    reasoning:
      solidCount > 0
        ? `${solidCount}/${total} ingredients are solids`
        : "Default to grams for mixed or unclear ingredient types",
  }
}
