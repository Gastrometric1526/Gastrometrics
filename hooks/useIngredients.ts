"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { getDashboardData } from "@/utils/dashboard-data"
import type { Ingredient } from "@/types/ingredient"

export function useIngredients(): Ingredient[] {
  const [ingredients, setIngredients] = useState<Ingredient[]>([])

  const loadIngredients = useCallback(() => {
    const data = getDashboardData("ingredients")

    if (data && Array.isArray(data)) {
      setIngredients(data)
    } else {
      setIngredients([])
    }
  }, [])

  useEffect(() => {
    loadIngredients()

    const handleIngredientsUpdate = () => {
      loadIngredients()
    }

    window.addEventListener("ingredientsUpdated", handleIngredientsUpdate)
    return () => {
      window.removeEventListener("ingredientsUpdated", handleIngredientsUpdate)
    }
  }, [loadIngredients])

  return useMemo(() => ingredients, [ingredients])
}
