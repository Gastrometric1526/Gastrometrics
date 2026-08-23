"use client"

import { useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"

// Redirige a la ruta real con contexto de negocio (ver 09-sesion-continuidad.md).
// Antes esta página leía ?business= pero nunca se lo pasaba a PurchaseOrderPage (que
// no acepta props, solo lee el negocio desde el segmento de ruta [id]), así que la
// tarjeta "Órdenes de Compra" del dashboard principal llevaba a una pantalla que nunca
// podía mostrar órdenes reales. Se usa "main" como fallback cuando no hay negocio en la
// URL, igual que ya hacen Menús/Ingredientes/etc. (getMenus(businessId || "main")).
export default function PurchaseOrdersRedirectPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const businessId = searchParams.get("business") || "main"

  useEffect(() => {
    router.replace(`/business/${businessId}/ordenes-compra`)
  }, [businessId, router])

  return null
}
