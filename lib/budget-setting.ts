"use client"

/**
 * Dónde se guarda el presupuesto del mes (docs/322), con el mismo criterio que la valoración
 * del inventario (lib/inventory-valuation-setting.ts):
 * - un negocio: en el negocio (`Business.budget`);
 * - el espacio principal: en los metadatos de la cuenta (`budget_main`).
 */

import { useCallback, useEffect, useState } from "react"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { getBusinessById, updateBusiness } from "@/lib/storage/businesses"
import { isMonthlyBudget, type MonthlyBudget } from "@/lib/forecast"

const MAIN_KEY = "budget_main"
const EVENT = "gm:budget-changed"

export function budgetFor(businessId: string | null | undefined, userMetadata?: Record<string, unknown>): MonthlyBudget | null {
  const v = !businessId || businessId === "main" ? userMetadata?.[MAIN_KEY] : getBusinessById(businessId)?.budget
  return isMonthlyBudget(v) ? v : null
}

export async function saveBudget(businessId: string | null | undefined, budget: MonthlyBudget): Promise<boolean> {
  const ok =
    !businessId || businessId === "main"
      ? !(await getSupabaseBrowserClient().auth.updateUser({ data: { [MAIN_KEY]: budget } })).error
      : await updateBusiness(businessId, { budget })
  if (ok && typeof window !== "undefined") window.dispatchEvent(new CustomEvent(EVENT, { detail: { businessId: businessId || "main", budget } }))
  return ok
}

export function useBudget(businessId: string | null | undefined, userMetadata?: Record<string, unknown>): [MonthlyBudget | null, (b: MonthlyBudget) => Promise<boolean>] {
  const [budget, setBudget] = useState<MonthlyBudget | null>(() => budgetFor(businessId, userMetadata))
  useEffect(() => {
    setBudget(budgetFor(businessId, userMetadata))
    const onChange = (e: Event) => {
      const d = (e as CustomEvent<{ businessId: string; budget: MonthlyBudget }>).detail
      if (d.businessId === (businessId || "main")) setBudget(d.budget)
    }
    window.addEventListener(EVENT, onChange)
    return () => window.removeEventListener(EVENT, onChange)
  }, [businessId, userMetadata])
  const save = useCallback(
    async (b: MonthlyBudget) => {
      setBudget(b)
      return saveBudget(businessId, b)
    },
    [businessId],
  )
  return [budget, save]
}
