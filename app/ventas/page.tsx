"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, ShoppingBag, UploadCloud, Receipt as ReceiptIcon, ClipboardList } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Sidebar } from "@/components/sidebar"
import { AuthGuard } from "@/components/auth-guard"
import { useLanguage } from "@/contexts/language-context"
import { useFeatureAccess, getAccessBlockReason } from "@/lib/plan-access"
import { FeatureLockedPage } from "@/components/feature-locked"
import { AdminRestrictedPage } from "@/components/admin-restricted"
import { ManualSalesTab } from "@/components/manual-sales-tab"
import { POSSalesImportDialog } from "@/components/pos-sales-import-dialog"
import { SalesHistoryBreakdown } from "@/components/sales-history-breakdown"
import { FacturasPanel } from "@/components/facturas-panel"
import { getRecipes, ensureRecipesLoaded } from "@/lib/storage/recipes"
import { getMenus, ensureMenusLoaded } from "@/lib/menus"
import { getSalesImports, ensureSalesImportsLoaded } from "@/lib/storage/sales-imports"
import type { Recipe } from "@/types/recipe"
import type { Menu } from "@/lib/types/menus"
import type { SalesImport } from "@/types/sales-import"

// Ventas como módulo propio — pedido explícito del dueño del proyecto: "lo de pos
// manual y importacion pueden ser su propio boton y modulo propio" (en vez de vivir
// como una pestaña más adentro de Estadísticas). Desde esta sesión, Facturas
// (components/facturas-panel.tsx, antes su propia página `/facturas`) también vive
// acá como pestaña — pedido explícito posterior del dueño del proyecto: "creo que lo
// de invoice debería estar en lo de ventas, creo que eso tendría más sentido" (ambas
// son formas de registrar una venta real). El ANÁLISIS (food cost real, Menu
// Engineering, P&L) sigue viviendo en Estadísticas → Finanzas a propósito, no se
// duplica: esta página es donde se CARGA una venta (manual, POS o factura), esa es
// donde se LEE qué significa.
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
  const canAccessInvoices = useFeatureAccess("invoices")

  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [menus, setMenus] = useState<Menu[]>([])
  const [salesImports, setSalesImports] = useState<SalesImport[]>([])
  const [isImportOpen, setIsImportOpen] = useState(false)

  useEffect(() => {
    ensureRecipesLoaded(businessId).then(() => setRecipes(getRecipes(businessId)))
    ensureMenusLoaded(businessId).then(() => setMenus(getMenus(businessId)))
    ensureSalesImportsLoaded(businessId).then(() => setSalesImports(getSalesImports(businessId)))
  }, [businessId])

  const handleImported = (imp: SalesImport) => {
    setIsImportOpen(false)
    setSalesImports((prev) => [imp, ...prev])
  }

  if (canAccessManualSales === null || canAccessFinance === null || canAccessInvoices === null) {
    return null
  }

  if (!canAccessManualSales && !canAccessFinance && !canAccessInvoices) {
    return getAccessBlockReason("invoices") === "admin" ? (
      <AdminRestrictedPage sectionName={t("nav_ventas")} />
    ) : (
      <FeatureLockedPage
        feature="invoices"
        title={t("estadisticas_ventas_locked_title")}
        description={t("estadisticas_ventas_locked_desc")}
      />
    )
  }

  // Si el registro/importación de ventas está bloqueado pero Facturas no, entra
  // directo a esa pestaña — una cuenta Home Cook (solo "invoices") nunca vería nada
  // útil si el default fuera "registrar". El query param ?tab= (usado por el enlace
  // desde Finanzas y por la redirección de /facturas) siempre gana sobre esto.
  const defaultTab =
    ["registrar", "facturas"].includes(searchParams.get("tab") || "")
      ? searchParams.get("tab")!
      : canAccessManualSales || canAccessFinance
        ? "registrar"
        : "facturas"

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

              <Tabs defaultValue={defaultTab} className="w-full">
                <TabsList className="bg-card border border-border">
                  <TabsTrigger id="ventas-tab-registrar" value="registrar" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                    <ClipboardList className="h-4 w-4" />
                    {t("ventas_tab_registrar")}
                  </TabsTrigger>
                  <TabsTrigger id="ventas-tab-facturas" value="facturas" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                    <ReceiptIcon className="h-4 w-4" />
                    {t("nav_facturas")}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="registrar" className="space-y-6 mt-4">
                  {canAccessManualSales || canAccessFinance ? (
                    <>
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

                      {canAccessManualSales && <ManualSalesTab businessId={businessId} onSalesChanged={setSalesImports} />}

                      <SalesHistoryBreakdown salesImports={salesImports} recipes={recipes} menus={menus} businessId={businessId} />
                    </>
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
                </TabsContent>

                <TabsContent value="facturas" className="mt-4">
                  <FacturasPanel businessId={businessId} />
                </TabsContent>
              </Tabs>
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
