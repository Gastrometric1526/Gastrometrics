"use client"

import { useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"

// Unificación de Órdenes de Compra — ver documento de continuidad. Esta pantalla
// duplicaba (con menos funciones) lo que ya hace /business/{id}/ordenes-compra
// (PurchaseOrderPage). Se le agregaron a esa pantalla las funciones que le
// faltaban para tener paridad completa (duplicar orden, filtro de estado) antes
// de convertir esta en un simple redirect, así no se pierde nada.
export default function MenuYComprasRedirectPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const businessId = searchParams.get("business") || "main"

  useEffect(() => {
    router.replace(`/business/${businessId}/ordenes-compra`)
  }, [businessId, router])

  return null
}
