"use client"

/**
 * Dónde se guarda el método de valoración del inventario (docs/313).
 *
 * - Un negocio: en el negocio (`Business.inventoryValuationMethod`), igual en todos los
 *   aparatos y para su equipo.
 * - El espacio principal («main», que no es una fila de `businesses`): en los metadatos de la
 *   cuenta (`inventory_valuation_main`).
 *
 * Sin elegir = «último precio de compra», lo de siempre.
 */

import { useCallback, useEffect, useState } from "react"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { getBusinessById, updateBusiness } from "@/lib/storage/businesses"
import { DEFAULT_VALUATION_METHOD, isValuationMethod, type ValuationMethod } from "@/lib/inventory-valuation"

const MAIN_KEY = "inventory_valuation_main"
const EVENT = "gm:valuation-method-changed"

function readMain(meta: Record<string, unknown> | undefined): ValuationMethod {
  const v = meta?.[MAIN_KEY]
  return isValuationMethod(v) ? v : DEFAULT_VALUATION_METHOD
}

export function valuationMethodFor(businessId: string | null | undefined, userMetadata?: Record<string, unknown>): ValuationMethod {
  if (!businessId || businessId === "main") return readMain(userMetadata)
  const v = getBusinessById(businessId)?.inventoryValuationMethod
  return isValuationMethod(v) ? v : DEFAULT_VALUATION_METHOD
}

export async function saveValuationMethod(businessId: string | null | undefined, method: ValuationMethod): Promise<boolean> {
  let ok: boolean
  if (!businessId || businessId === "main") {
    const { error } = await getSupabaseBrowserClient().auth.updateUser({ data: { [MAIN_KEY]: method } })
    ok = !error
  } else {
    ok = await updateBusiness(businessId, { inventoryValuationMethod: method })
  }
  if (ok && typeof window !== "undefined") window.dispatchEvent(new CustomEvent(EVENT, { detail: { businessId, method } }))
  return ok
}

/** Método vigente y cómo cambiarlo, al día en todas las pantallas abiertas. */
export function useValuationMethod(
  businessId: string | null | undefined,
  userMetadata?: Record<string, unknown>,
): [ValuationMethod, (m: ValuationMethod) => Promise<boolean>] {
  const [method, setMethod] = useState<ValuationMethod>(() => valuationMethodFor(businessId, userMetadata))
  useEffect(() => {
    setMethod(valuationMethodFor(businessId, userMetadata))
    const onChange = (e: Event) => {
      const d = (e as CustomEvent<{ businessId: string | null | undefined; method: ValuationMethod }>).detail
      if ((d.businessId || "main") === (businessId || "main")) setMethod(d.method)
    }
    window.addEventListener(EVENT, onChange)
    return () => window.removeEventListener(EVENT, onChange)
  }, [businessId, userMetadata])
  const save = useCallback(
    async (m: ValuationMethod) => {
      setMethod(m)
      return saveValuationMethod(businessId, m)
    },
    [businessId],
  )
  return [method, save]
}
