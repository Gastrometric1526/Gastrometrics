"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Trash2, Receipt, Plus, Pencil, ChevronDown, ChevronUp, DollarSign, Package, ListOrdered } from "lucide-react"
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
  // Notifica al padre cada vez que la lista de ventas manuales cambia (carga inicial,
  // guardado, edición o borrado) — sin esto, el desglose/historial por día de
  // app/ventas/page.tsx (que carga su propia copia de sales_imports una sola vez al
  // montar) no se enteraría de una venta manual nueva hasta recargar la página.
  onSalesChanged?: (imports: SalesImport[]) => void
}

/**
 * Pestaña "Ventas" de Estadísticas (docs/90) — registro manual de ventas para
 * negocios sin POS, gateada por su propia función ("manual_sales", desde Chef de
 * Partie), separada a propósito de la pestaña Finanzas completa ("stats_finance",
 * Sous Chef+) donde vive la importación de POS y todo el análisis (Food Cost real,
 * Prime Cost, Menu Engineering, P&L) — acá solo se registra y se lista lo cargado,
 * sin ese análisis, que sigue exclusivo de Finanzas.
 */
export function ManualSalesTab({ businessId, onSalesChanged }: ManualSalesTabProps) {
  const { toast } = useToast()
  const { t } = useLanguage()

  const [salesImports, setSalesImportsState] = useState<SalesImport[]>([])
  const setSalesImports = (imports: SalesImport[]) => {
    setSalesImportsState(imports)
    onSalesChanged?.(imports)
  }
  const [refreshKey, setRefreshKey] = useState(0)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingImport, setEditingImport] = useState<SalesImport | null>(null)
  // Pedido explícito: "que el usuario pueda verlo todo" — antes solo se veía el nombre
  // del registro, el conteo de líneas y el ingreso total; para ver QUÉ se vendió había
  // que abrir el diálogo de edición. Ahora cada registro se puede expandir en la misma
  // lista, sin entrar a editar.
  const [expandedId, setExpandedId] = useState<string | null>(null)
  // BUG CORREGIDO: eliminar borraba de inmediato al primer clic, sin confirmación — a
  // diferencia de todo el resto de la app (recetas, ingredientes, negocios), donde
  // borrar algo siempre pide confirmar primero. Un clic accidental perdía el registro
  // de ventas de un día completo sin aviso ni forma de deshacerlo.
  const [entryToDelete, setEntryToDelete] = useState<SalesImport | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

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

  // Resumen a simple vista — antes había que sumar cada registro a mano para saber
  // cuánto se había vendido en total.
  const summary = useMemo(() => {
    const totalRevenue = manualEntries.reduce((sum, imp) => sum + imp.totalRevenue, 0)
    const totalUnits = manualEntries.reduce(
      (sum, imp) => sum + imp.lines.reduce((lineSum, line) => lineSum + line.quantity, 0),
      0,
    )
    return { totalRevenue, totalUnits, count: manualEntries.length }
  }, [manualEntries])

  const handleSaved = () => {
    setSalesImports(getSalesImports(businessId))
    setEditingImport(null)
  }

  const handleOpenNew = () => {
    setEditingImport(null)
    setIsDialogOpen(true)
  }

  const handleOpenEdit = (imp: SalesImport) => {
    setEditingImport(imp)
    setIsDialogOpen(true)
  }

  const toggleExpanded = (id: string) => {
    setExpandedId((current) => (current === id ? null : id))
  }

  const confirmDelete = async () => {
    if (!entryToDelete) return
    setIsDeleting(true)
    await deleteSalesImport(entryToDelete.id, businessId)
    setSalesImports(getSalesImports(businessId))
    toast({ title: t("manual_sales_toast_deleted_title") })
    setIsDeleting(false)
    setEntryToDelete(null)
  }

  return (
    <div className="space-y-6">
      {manualEntries.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card className="border-border bg-card">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-success-soft shrink-0">
                <DollarSign className="h-5 w-5 text-success" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide truncate">
                  {t("manual_sales_overview_revenue")}
                </p>
                <p className="text-xl font-bold text-foreground tabular-nums truncate">{formatCurrency(summary.totalRevenue)}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 shrink-0">
                <Package className="h-5 w-5 text-info" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide truncate">
                  {t("manual_sales_overview_units")}
                </p>
                <p className="text-xl font-bold text-foreground tabular-nums truncate">{summary.totalUnits}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-purple-50 dark:bg-purple-950/40 shrink-0">
                <ListOrdered className="h-5 w-5 text-purple-600 dark:text-purple-300" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide truncate">
                  {t("manual_sales_overview_entries")}
                </p>
                <p className="text-xl font-bold text-foreground tabular-nums truncate">{summary.count}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card data-tour="ventas-register-card">
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="text-base">{t("manual_sales_tab_title")}</CardTitle>
            <CardDescription>{t("manual_sales_tab_desc")}</CardDescription>
          </div>
          <Button onClick={handleOpenNew} className="gap-2 shrink-0" data-tour="ventas-register-button">
            <Plus className="h-4 w-4" />
            {t("manual_sales_register_button")}
          </Button>
        </CardHeader>
        <CardContent>
          {manualEntries.length === 0 ? (
            <div className="text-center py-10 space-y-3">
              <Receipt className="h-10 w-10 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">{t("manual_sales_empty_state")}</p>
              <Button onClick={handleOpenNew} variant="outline" className="gap-2">
                <Plus className="h-4 w-4" />
                {t("manual_sales_register_button")}
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {manualEntries.map((imp) => {
                const isExpanded = expandedId === imp.id
                return (
                  <div key={imp.id} className="rounded-lg border border-hairline bg-muted/20 overflow-hidden">
                    <div className="flex items-center justify-between text-sm px-3 py-2 gap-2">
                      <button
                        type="button"
                        onClick={() => toggleExpanded(imp.id)}
                        className="min-w-0 flex-1 flex items-center gap-2 text-left"
                        aria-expanded={isExpanded}
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                        )}
                        <div className="min-w-0">
                          <p className="font-medium truncate">{imp.fileName}</p>
                          <p className="text-xs text-muted-foreground">
                            {imp.lineCount} {t("manual_sales_lines_suffix")} · {formatCurrency(imp.totalRevenue)}
                          </p>
                        </div>
                      </button>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(imp)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setEntryToDelete(imp)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="border-t border-hairline divide-y divide-hairline bg-card">
                        {imp.lines.map((line) => (
                          <div key={line.id} className="flex items-center justify-between px-3 py-2 text-xs gap-2">
                            <span className="truncate text-foreground">{line.rawDishName}</span>
                            <span className="text-muted-foreground shrink-0">
                              {line.quantity} × {formatCurrency(line.unitPrice ?? 0)} = {formatCurrency(line.revenue)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <ManualSalesEntryDialog
        open={isDialogOpen}
        onOpenChange={(next) => {
          setIsDialogOpen(next)
          if (!next) setEditingImport(null)
        }}
        businessId={businessId}
        recipes={recipes}
        menus={menus}
        onSaved={handleSaved}
        editingImport={editingImport}
      />

      <Dialog open={!!entryToDelete} onOpenChange={(next) => !next && setEntryToDelete(null)}>
        <DialogContent className="bg-card border-border max-w-md mx-4">
          <DialogHeader>
            <DialogTitle className="text-destructive dark:text-red-300 flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              {t("manual_sales_delete_dialog_title")}
            </DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm md:text-base">
            {t("manual_sales_delete_confirm_prefix")} <strong>"{entryToDelete?.fileName}"</strong>
            {t("manual_sales_delete_confirm_suffix")}
          </p>
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setEntryToDelete(null)}
              className="border-border w-full sm:w-auto"
              disabled={isDeleting}
            >
              {t("common_cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700 w-full sm:w-auto"
              disabled={isDeleting}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {isDeleting ? t("manual_sales_saving") : t("common_delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
