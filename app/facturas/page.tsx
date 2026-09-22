"use client"

import { Suspense, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"

// Facturas dejó de ser su propia página — pedido explícito del dueño del proyecto:
// "creo que lo de invoice debería estar en lo de ventas, creo que eso tendría más
// sentido" (ambas son formas de registrar una venta real, ver components/ventas y
// components/facturas-panel.tsx, ahora una pestaña de /ventas). Esta ruta se deja como
// un redirect permanente — no un 404 — para no romper enlaces/marcadores/correos
// viejos que ya apuntaban a /facturas (incluye la propia insignia "Invoice" del
// historial de Finanzas antes de actualizarse, y cualquier bookmark real de un
// usuario). Conserva ?business= si venía.
export default function FacturasPage() {
  return (
    <Suspense fallback={null}>
      <FacturasRedirect />
    </Suspense>
  )
}

function FacturasRedirect() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const business = searchParams.get("business")
    const target = business ? `/ventas?tab=facturas&business=${business}` : "/ventas?tab=facturas"
    router.replace(target)
  }, [router, searchParams])

  return null
}
