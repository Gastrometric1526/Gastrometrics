"use client"

import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { Sidebar } from "@/components/sidebar"
import { useAuth } from "@/contexts/auth-context"
import { useLanguage } from "@/contexts/language-context"
import { PdfOrderProcessor } from "@/components/pdf-order-processor"
import { ProcesarOrdenesTour } from "@/components/page-tours"

export default function ProcesarOrdenesPage() {
  const searchParams = useSearchParams()
  const businessId = searchParams.get("business")
  const { isLoggedIn } = useAuth()
  const { t } = useLanguage()

  if (!isLoggedIn) {
    return null
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 p-8">
        <div className="max-w-[1200px] mx-auto">
          <ProcesarOrdenesTour />
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <Link href={businessId ? `/business/${businessId}` : "/dashboard"}>
                <Button variant="ghost" size="sm" className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  {t("common_back")}
                </Button>
              </Link>
              <div data-tour="procesar-header">
                <h1 className="text-3xl font-bold">{t("procesar_title")}</h1>
                <p className="text-muted-foreground">{t("procesar_subtitle")}</p>
              </div>
            </div>
            <Link href={`/menu-y-compras?business=${businessId || ""}`}>
              <Button variant="outline">{t("procesar_view_orders")}</Button>
            </Link>
          </div>

          <PdfOrderProcessor businessId={businessId || undefined} />
        </div>
      </div>
    </div>
  )
}
