"use client"

import { useState, useEffect } from "react"

interface DashboardStats {
  totalRecipes: number
  totalIngredients: number
  totalBusinesses: number
  recentActivity: Array<{
    action: string
    time: string
    type: string
  }>
  isLoading: boolean
}

export function useDashboard(): DashboardStats {
  const [stats, setStats] = useState<DashboardStats>({
    totalRecipes: 0,
    totalIngredients: 0,
    totalBusinesses: 0,
    recentActivity: [],
    isLoading: true,
  })

  useEffect(() => {
    const loadDashboardData = () => {
      try {
        // Simular carga de datos
        setTimeout(() => {
          const recipes = JSON.parse(localStorage.getItem("recipes") || "[]")
          const ingredients = JSON.parse(localStorage.getItem("ingredients") || "[]")
          const businesses = JSON.parse(localStorage.getItem("businesses") || "[]")

          const recentActivity = [
            { action: "Nueva receta creada: Pasta Carbonara", time: "Hace 2 horas", type: "Receta" },
            { action: "Ingrediente actualizado: Queso Parmesano", time: "Hace 4 horas", type: "Ingrediente" },
            { action: "Orden de compra generada", time: "Ayer", type: "Compra" },
          ]

          setStats({
            totalRecipes: recipes.length,
            totalIngredients: ingredients.length,
            totalBusinesses: businesses.length,
            recentActivity,
            isLoading: false,
          })
        }, 500)
      } catch (error) {
        console.error("Error loading dashboard data:", error)
        setStats((prev) => ({ ...prev, isLoading: false }))
      }
    }

    loadDashboardData()
  }, [])

  return stats
}
