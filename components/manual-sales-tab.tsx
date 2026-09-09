"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Trash2, Receipt, Plus } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useLanguage } from "@/contexts/language-context"
import { formatCurrency } from "@/lib/currency"
import { getRecipes, ensureRecipesLoaded } from "@/lib/storage/recipes"
import { getMenus, ensureMenusLoaded } from "@/lib/menus"
import { getSalesImports, deleteSalesImport, ensureSalesImportsLoaded } from "@/lib/storage/sales-imports"
import { ManualSalesEntryDialog } from "@/components/manual-sales-entry-dialog"
import type { SalesImport } from "@/types/sales-import"

interface ManualSalesTabProps {
  businessId: string
}

/**
 * Pestaña "Ventas" de Estadísticas (docs/90) — registro manual de ventas para
 * negocios sin POS, gateada por su propia función ("manual_sales", desde Chef de
 * Partie), separada a propósito de la pestaña Finanzas completa ("stats_finance",
 * Sous Chef+) donde vive la importación de POS y todo el análisis (Food Cost real,
 * Prime Cost, Menu Engineering, P&L) — acá solo se registra y se lista lo cargado,
 * sin ese análisis, que sigue exclusivo de Finanzas.
 */
export function ManualSalesTab({ businessId }: ManualSalesTabProps) {
  const { toast } = useToast()
  const { t } = useLanguage()

  const [salesImports, setSalesImports] = useState<SalesImport[]>([])
  const [refreshKey, setRefreshKey] = useState(0)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    ensureSalesImportsLoaded(businessId).then(() => {
      if (!cancelled) setSalesImports(getSalesImports(businessId))
    })
    return () => {
      cancelled = true
    }
  }, [businessId, refreshKey])

  useEffect(() => {
    let cancelled = false
    Promise.all([ensureRecipesLoaded(businessId), ensureMenusLoaded(businessId)]).then(() => {
      if (!cancelled) setRefreshKey((k) => k + 1)
    })
    return () => {
      cancelled = true
    }
  }, [businessId])

  const recipes = useMemo(() => getRecipes(businessId), [businessId, refreshKey])
  const menus = useMemo(() => getMenus(businessId), [businessId, refreshKey])
  const manualEntries = useMemo(
    () => salesImports.filter((imp) => imp.source === "manual").sort((a, b) => b.importedAt.localeCompare(a.importedAt)),
    [salesImports],
  )

  const handleSaved = () => {
    setSalesImports(getSalesImports(businessId))
  }

  const handleDelete = async (id: string) => {
    await deleteSalesImport(id, businessId)
    setSalesImports(getSalesImports(businessId))
    toast({ title: t("manual_sales_toast_deleted_title") })
  }

  return (
    <div className="space-y-6">
      <Card data-tour="ventas-register-card">
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="text-base">{t("manual_sales_tab_title")}</CardTitle>
            <CardDescription>{t("manual_sales_tab_desc")}</CardDescription>
          </div>
          <Button onClick={() => setIsDialogOpen(true)} className="gap-2 shrink-0" data-tour="ventas-register-button">
            <Plus className="h-4 w-4" />
            {t("manual_sales_register_button")}
          </Button>
        </CardHeader>
        <CardContent>
          {manualEntries.length === 0 ? (
            <div className="text-center py-10 space-y-3">
              <Receipt className="h-10 w-10 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">{t("manual_sales_empty_state")}</p>
              <Button onClick={() => setIsDialogOpen(true)} variant="outline" className="gap-2">
                <Plus className="h-4 w-4" />
                {t("manual_sales_register_button")}
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {manualEntries.map((imp) => (
                <div key={imp.id} className="flex items-center justify-between text-sm bg-muted/20 rounded-lg px-3 py-2">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{imp.fileName}</p>
                    <p className="text-xs text-muted-foreground">
                      {imp.lineCount} {t("manual_sales_lines_suffix")} · {formatCurrency(imp.totalRevenue)}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(imp.id)} className="shrink-0">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ManualSalesEntryDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        businessId={businessId}
        recipes={recipes}
        menus={menus}
        onSaved={handleSaved}
      />
    </div>
  )
}
