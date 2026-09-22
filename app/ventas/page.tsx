"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, ShoppingBag, UploadCloud } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Sidebar } from "@/components/sidebar"
import { AuthGuard } from "@/components/auth-guard"
import { useLanguage } from "@/contexts/language-context"
import { useFeatureAccess, getAccessBlockReason } from "@/lib/plan-access"
import { FeatureLockedPage } from "@/components/feature-locked"
import { AdminRestrictedPage } from "@/components/admin-restricted"
import { ManualSalesTab } from "@/components/manual-sales-tab"
import { POSSalesImportDialog } from "@/components/pos-sales-import-dialog"
import { getRecipes, ensureRecipesLoaded } from "@/lib/storage/recipes"
import type { Recipe } from "@/types/recipe"
import type { SalesImport } from "@/types/sales-import"

// Ventas como módulo propio — pedido explícito del dueño del proyecto: "lo de pos
// manual y importacion pueden ser su propio boton y modulo propio" (en vez de vivir
// como una pestaña más adentro de Estadísticas). El registro manual
// (components/manual-sales-tab.tsx) y la importación de POS
// (components/pos-sales-import-dialog.tsx) ya eran componentes autocontenidos — se
// reusan tal cual acá, solo se les da su propia página y su propia entrada en el
// sidebar. El ANÁLISIS (food cost real, Menu Engineering, P&L) sigue viviendo en
// Estadísticas → Finanzas a propósito, no se duplica: esta página es donde se CARGA
// una venta, esa es donde se LEE qué significa.
export default function VentasPage() {
  return (
    <Suspense fallback={null}>
      <VentasPageInner />
    </Suspense>
  )
}

function VentasPageInner() {
  const searchParams = useSearchParams()
  const businessId = searchParams.get("business") || "main"
  const { t } = useLanguage()
  const canAccessManualSales = useFeatureAccess("manual_sales")
  const canAccessFinance = useFeatureAccess("stats_finance")

  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [isImportOpen, setIsImportOpen] = useState(false)

  useEffect(() => {
    ensureRecipesLoaded(businessId).then(() => setRecipes(getRecipes(businessId)))
  }, [businessId])

  const handleImported = (_imp: SalesImport) => {
    setIsImportOpen(false)
  }

  if (canAccessManualSales === null || canAccessFinance === null) {
    return null
  }

  if (!canAccessManualSales && !canAccessFinance) {
    return getAccessBlockReason("manual_sales") === "admin" ? (
      <AdminRestrictedPage sectionName={t("nav_ventas")} />
    ) : (
      <FeatureLockedPage
        feature="manual_sales"
        title={t("estadisticas_ventas_locked_title")}
        description={t("estadisticas_ventas_locked_desc")}
      />
    )
  }

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <div className="flex-1 overflow-hidden">
          <div className="h-full overflow-y-auto">
            <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 space-y-6">
              <div className="flex items-center gap-2 md:gap-4">
                <Link href={businessId !== "main" ? `/business/${businessId}` : "/dashboard"}>
                  <Button variant="outline" size="sm" className="gap-2 hover:bg-accent bg-transparent">
                    <ArrowLeft className="h-4 w-4" />
                    <span className="hidden sm:inline">{t("mi_plan_back_to_dashboard")}</span>
                  </Button>
                </Link>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-chart-3/10 rounded-lg flex items-center justify-center">
                    <ShoppingBag className="h-6 w-6 text-chart-3" />
                  </div>
                  <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-foreground">{t("nav_ventas")}</h1>
                    <p className="text-sm md:text-base text-muted-foreground">{t("nav_ventas_desc")}</p>
                  </div>
                </div>
              </div>

              {canAccessFinance && (
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
                    <div>
                      <CardTitle className="text-base">{t("ventas_pos_section_title")}</CardTitle>
                      <CardDescription>{t("ventas_pos_section_desc")}</CardDescription>
                    </div>
                    <Button onClick={() => setIsImportOpen(true)} className="gap-2 shrink-0">
                      <UploadCloud className="h-4 w-4" />
                      {t("finanzas_import_button")}
                    </Button>
                  </CardHeader>
                </Card>
              )}

              {canAccessManualSales ? (
                <ManualSalesTab businessId={businessId} />
              ) : (
                getAccessBlockReason("manual_sales") !== "admin" && (
                  <Card>
                    <CardContent className="py-10 text-center space-y-2">
                      <p className="font-medium text-foreground">{t("estadisticas_ventas_locked_title")}</p>
                      <p className="text-sm text-muted-foreground">{t("estadisticas_ventas_locked_desc")}</p>
                    </CardContent>
                  </Card>
                )
              )}
            </div>
          </div>
        </div>
      </div>

      <POSSalesImportDialog
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        businessId={businessId}
        recipes={recipes}
        onImported={handleImported}
      />
    </AuthGuard>
  )
}
