"use client"

import { useState, useEffect, useCallback } from "react"
import type { Business, BusinessExpenses } from "@/types/business"
import { useToast } from "@/hooks/use-toast"

export function useBusiness(businessId?: string) {
  const [business, setBusiness] = useState<Business | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const { toast } = useToast()

  // Load business
  useEffect(() => {
    const loadBusiness = () => {
      try {
        if (!businessId) {
          setBusiness(null)
          return
        }

        const businesses = JSON.parse(localStorage.getItem("businesses") || "[]")
        const found = businesses.find((b: Business) => b.id === businessId)
        setBusiness(found || null)
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Failed to load business"))
        toast({
          title: "Error",
          description: "No se pudo cargar la información del negocio",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    loadBusiness()
  }, [businessId, toast])

  // Update business expenses
  const updateBusinessExpenses = useCallback(
    async (expenses: BusinessExpenses) => {
      try {
        if (!businessId || !business) {
          throw new Error("Business not found")
        }

        const businesses = JSON.parse(localStorage.getItem("businesses") || "[]")
        const updated = businesses.map((b: Business) => {
          if (b.id === businessId) {
            return {
              ...b,
              expenses,
              hasCustomizedCosts: true,
            }
          }
          return b
        })

        localStorage.setItem("businesses", JSON.stringify(updated))
        setBusiness((prev) => (prev ? { ...prev, expenses, hasCustomizedCosts: true } : null))

        toast({
          title: "Éxito",
          description: "Gastos del negocio actualizados correctamente",
        })
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Failed to update business expenses")
        setError(error)
        toast({
          title: "Error",
          description: "No se pudieron actualizar los gastos del negocio",
          variant: "destructive",
        })
        throw error
      }
    },
    [businessId, business, toast],
  )

  // Update business settings
  const updateBusinessSettings = useCallback(
    async (updates: Partial<Business>) => {
      try {
        if (!businessId || !business) {
          throw new Error("Business not found")
        }

        const businesses = JSON.parse(localStorage.getItem("businesses") || "[]")
        const updated = businesses.map((b: Business) => {
          if (b.id === businessId) {
            return { ...b, ...updates }
          }
          return b
        })

        localStorage.setItem("businesses", JSON.stringify(updated))
        setBusiness((prev) => (prev ? { ...prev, ...updates } : null))

        toast({
          title: "Éxito",
          description: "Configuración del negocio actualizada correctamente",
        })
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Failed to update business settings")
        setError(error)
        toast({
          title: "Error",
          description: "No se pudo actualizar la configuración del negocio",
          variant: "destructive",
        })
        throw error
      }
    },
    [businessId, business, toast],
  )

  return {
    business,
    isLoading,
    error,
    updateBusinessExpenses,
    updateBusinessSettings,
  }
}
