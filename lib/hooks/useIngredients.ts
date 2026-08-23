"use client"

import { useEffect, useState } from "react"
import type { Ingredient } from "@/types/ingredient"
import { getDashboardData } from "@/utils/dashboard-data"

export function useIngredients(): Ingredient[] {
  const [ingredients, setIngredients] = useState<Ingredient[]>([])

  useEffect(() => {
    if (typeof window === "undefined") return // evitar SSR

    const data = getDashboardData("ingredients")

    if (data && Array.isArray(data)) {
      // Asegurarse de que cada ingrediente tenga la estructura correcta
      const processedData = data.map((ing: any) => {
        // Asegurarse de que el precio esté disponible en la estructura esperada
        if (!ing.purchasePrice && ing.pricing && ing.pricing.purchasePrice) {
          return {
            ...ing,
            purchasePrice: ing.pricing.purchasePrice,
          }
        }
        return ing
      })

      setIngredients(processedData)
      console.log(`✅ Loaded ${processedData.length} ingredients from getDashboardData in the hook`)
    } else {
      console.error("❌ No ingredients loaded from getDashboardData")
      setIngredients([])
    }
  }, [])

  return ingredients
}
