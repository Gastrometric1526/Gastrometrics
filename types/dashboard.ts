import type { BusinessExpenses } from "./business"
import type { Ingredient } from "./ingredient"
import type { Recipe } from "./recipe"

export interface DashboardData {
  ingredients: Ingredient[]
  recipes: Recipe[]
  percentages: {
    publicServices: number
    branding: number
    operativeCosts: number
    laborCosts: number
    ivs: number
    netProfit: number
  }
}

export interface DashboardStore {
  main: DashboardData
  businesses: {
    [businessId: string]: DashboardData
  }
}

export const DEFAULT_PERCENTAGES = {
  publicServices: 0.1,
  branding: 0.15,
  operativeCosts: 0.3,
  laborCosts: 0.25,
  ivs: 0,
  netProfit: 0.3,
}

export function initializeDashboardData(): DashboardData {
  return {
    ingredients: [],
    recipes: [],
    percentages: { ...DEFAULT_PERCENTAGES },
  }
}

export function getBusinessPercentagesFromExpenses(expenses: BusinessExpenses) {
  const total = Object.values(expenses).reduce((sum, value) => sum + value, 0)
  return {
    publicServices: expenses.utilities / total,
    branding: expenses.marketing / total,
    operativeCosts: expenses.operationalCosts / total,
    laborCosts: expenses.laborCosts / total,
    ivs: 0,
    netProfit: 0.35,
  }
}
