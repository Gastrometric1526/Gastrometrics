"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import type { Ingredient } from "@/types/ingredient"
import { getDashboardData } from "@/utils/dashboard"

export function useBusinessIngredients(): Ingredient[] {
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const searchParams = useSearchParams()
  const businessId = searchParams.get("business")

  useEffect(() => {
    const data = getDashboardData<Ingredient[]>("ingredients", businessId || undefined) || []
    setIngredients(data)
  }, [businessId])

  return ingredients
}
