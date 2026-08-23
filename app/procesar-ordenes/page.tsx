"use client"

import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { Sidebar } from "@/components/sidebar"
import { useAuth } from "@/contexts/auth-context"
import { PdfOrderProcessor } from "@/components/pdf-order-processor"

export default function ProcesarOrdenesPage() {
  const searchParams = useSearchParams()
  const businessId = searchParams.get("business")
  const { isLoggedIn } = useAuth()

  if (!isLoggedIn) {
    return null
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 p-8">
        <div className="max-w-[1200px] mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <Link href={businessId ? `/business/${businessId}` : "/dashboard"}>
                <Button variant="ghost" size="sm" className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Volver
                </Button>
              </Link>
              <div>
                <h1 className="text-3xl font-bold">Procesador de Órdenes de Compra</h1>
                <p className="text-muted-foreground">Extrae información de órdenes de compra desde archivos PDF</p>
              </div>
            </div>
            <Link href={`/menu-y-compras?business=${businessId || ""}`}>
              <Button variant="outline">Ver Órdenes de Compra</Button>
            </Link>
          </div>

          <PdfOrderProcessor businessId={businessId || undefined} />
        </div>
      </div>
    </div>
  )
}
