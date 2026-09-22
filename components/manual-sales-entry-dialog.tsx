"use client"

import { useEffect, useMemo, useState } from "react"
import { v4 as uuidv4 } from "uuid"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Trash2, Plus, ChefHat, UtensilsCrossed } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/contexts/auth-context"
import { useLanguage } from "@/contexts/language-context"
import { logActivity } from "@/lib/services/activity-log"
import { formatCurrency } from "@/lib/currency"
import { addSalesImport, updateSalesImport } from "@/lib/storage/sales-imports"
import { getMenuUnitPriceAndCost } from "@/lib/menus"
import { EMAIL_DATE_LOCALES, normalizeEmailLang } from "@/lib/i18n/email-labels"
import type { Recipe } from "@/types/recipe"
import type { Menu } from "@/lib/types/menus"
import type { SalesImport, SalesImportLine } from "@/types/sales-import"

interface ManualSalesEntryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  businessId: string
  recipes: Recipe[]
  menus: Menu[]
  onSaved: (salesImport: SalesImport) => void
  /** Presente = editando este registro ya guardado en vez de crear uno nuevo. */
  editingImport?: SalesImport | null
}

interface DraftLine {
  id: string
  sourceType: "recipe" | "menu"
  refId: string
  name: string
  quantity: number
  unitPrice: number
  unitCost: number
}

const NONE_VALUE = "__none__"

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Registro manual de ventas para negocios sin sistema de POS (docs/90) — mismo
 * destino de datos que la importación de POS (`addSalesImport`/`SalesImport`, ver
 * lib/storage/sales-imports.ts), así que alimenta exactamente el mismo panel de
 * Finanzas sin ningún cambio en esa lógica. A diferencia del asistente de POS (que
 * lee un archivo y adivina columnas), acá el usuario elige directamente una receta o
 * un menú completo ya creado y la cantidad vendida — no hay archivo que mapear.
 */
export function ManualSalesEntryDialog({
  open,
  onOpenChange,
  businessId,
  recipes,
  menus,
  onSaved,
  editingImport = null,
}: ManualSalesEntryDialogProps) {
  const { toast } = useToast()
  const { user } = useAuth()
  const { t, language } = useLanguage()

  const [saleDate, setSaleDate] = useState(todayIso)
  const [lines, setLines] = useState<DraftLine[]>([])
  const [draftType, setDraftType] = useState<"recipe" | "menu">("recipe")
  const [draftRefId, setDraftRefId] = useState(NONE_VALUE)
  const [draftQuantity, setDraftQuantity] = useState("1")
  const [draftUnitPrice, setDraftUnitPrice] = useState("0")
  const [isSaving, setIsSaving] = useState(false)

  const selectedRecipe = draftType === "recipe" ? recipes.find((r) => r.id === draftRefId) : undefined
  const selectedMenu = draftType === "menu" ? menus.find((m) => m.id === draftRefId) : undefined
  const menuPriceAndCost = selectedMenu ? getMenuUnitPriceAndCost(selectedMenu, recipes) : null
  const selectedUnitCost = selectedRecipe?.costPerServing ?? menuPriceAndCost?.cost ?? 0

  // Al elegir una receta/menú nuevo, precarga el precio sugerido — el usuario lo
  // puede sobreescribir a mano antes de agregar la línea (pedido explícito: "precio
  // unitario pre-llenado con el precio de la receta, editable").
  useEffect(() => {
    const suggested = selectedRecipe?.unitPrice ?? menuPriceAndCost?.price ?? 0
    setDraftUnitPrice(suggested > 0 ? suggested.toFixed(2) : "0")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftRefId, draftType])

  // Al abrir el diálogo para editar un registro ya guardado, precarga sus líneas y
  // fecha — sin esto, "Editar" abriría el mismo formulario vacío que "Registrar
  // ventas" y quien lo use pensaría que no hizo nada. Al abrir para uno nuevo (o
  // cerrar), vuelve todo a blanco.
  useEffect(() => {
    if (!open) return
    if (editingImport) {
      setSaleDate(editingImport.periodStart ? editingImport.periodStart.slice(0, 10) : todayIso())
      setLines(
        editingImport.lines.map((l) => {
          const sourceType: "recipe" | "menu" = l.menuId ? "menu" : "recipe"
          const quantity = l.quantity
          return {
            id: l.id,
            sourceType,
            refId: (sourceType === "menu" ? l.menuId : l.recipeId) || "",
            name: l.rawDishName,
            quantity,
            unitPrice: l.unitPrice ?? 0,
            unitCost: quantity > 0 ? l.theoreticalCost / quantity : 0,
          }
        }),
      )
    } else {
      setSaleDate(todayIso())
      setLines([])
    }
    setDraftRefId(NONE_VALUE)
    setDraftQuantity("1")
    setDraftUnitPrice("0")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editingImport])

  const handleAddLine = () => {
    if (draftRefId === NONE_VALUE) return
    const quantity = Number.parseFloat(draftQuantity)
    const unitPrice = Number.parseFloat(draftUnitPrice)
    if (!Number.isFinite(quantity) || quantity <= 0) return
    if (!Number.isFinite(unitPrice) || unitPrice < 0) return

    const name = selectedRecipe?.name || selectedMenu?.name || ""
    setLines((prev) => [
      ...prev,
      { id: uuidv4(), sourceType: draftType, refId: draftRefId, name, quantity, unitPrice, unitCost: selectedUnitCost },
    ])
    setDraftRefId(NONE_VALUE)
    setDraftQuantity("1")
    setDraftUnitPrice("0")
  }

  const handleRemoveLine = (id: string) => {
    setLines((prev) => prev.filter((l) => l.id !== id))
  }

  const summary = useMemo(() => {
    const units = lines.reduce((sum, l) => sum + l.quantity, 0)
    const revenue = lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0)
    const cost = lines.reduce((sum, l) => sum + l.quantity * l.unitCost, 0)
    const margin = revenue > 0 ? ((revenue - cost) / revenue) * 100 : 0
    return { units, revenue, cost, margin }
  }, [lines])

  const resetAndClose = () => {
    setLines([])
    setDraftRefId(NONE_VALUE)
    setDraftQuantity("1")
    setDraftUnitPrice("0")
    setSaleDate(todayIso())
    onOpenChange(false)
  }

  const handleSave = async () => {
    if (lines.length === 0) return
    setIsSaving(true)

    const saleDateObj = new Date(`${saleDate}T00:00:00`)
    const isoDate = saleDateObj.toISOString()

    const importLines: SalesImportLine[] = lines.map((l) => ({
      id: l.id,
      rawDishName: l.name,
      recipeId: l.sourceType === "recipe" ? l.refId : null,
      menuId: l.sourceType === "menu" ? l.refId : null,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      revenue: l.quantity * l.unitPrice,
      theoreticalCost: l.quantity * l.unitCost,
      date: isoDate,
    }))
    const displayDate = saleDateObj.toLocaleDateString(EMAIL_DATE_LOCALES[normalizeEmailLang(language)], {
      day: "numeric",
      month: "short",
      year: "numeric",
    })

    const salesImport: SalesImport = {
      id: editingImport?.id ?? uuidv4(),
      businessId,
      fileName: `${t("manual_sales_entry_label")} — ${displayDate}`,
      importedAt: editingImport?.importedAt ?? new Date().toISOString(),
      periodStart: isoDate,
      periodEnd: isoDate,
      totalRevenue: importLines.reduce((sum, l) => sum + l.revenue, 0),
      totalTheoreticalCost: importLines.reduce((sum, l) => sum + l.theoreticalCost, 0),
      lineCount: importLines.length,
      unmatchedDishNames: [],
      lines: importLines,
      source: "manual",
    }

    if (editingImport) {
      await updateSalesImport(salesImport, businessId)
    } else {
      await addSalesImport(salesImport, businessId)
    }
    onSaved(salesImport)

    if (user) {
      logActivity({
        user,
        businessId: businessId && businessId !== "main" ? businessId : null,
        module: "estadisticas",
        action: editingImport ? "updated" : "imported",
        metadata: { count: importLines.length },
      })
    }

    toast(
      editingImport
        ? {
            title: t("manual_sales_toast_updated_title"),
            description: t("manual_sales_toast_updated_desc").replace("{revenue}", formatCurrency(salesImport.totalRevenue)),
          }
        : {
            title: t("manual_sales_toast_saved_title"),
            description: t("manual_sales_toast_saved_desc")
              .replace("{count}", String(importLines.length))
              .replace("{revenue}", formatCurrency(salesImport.totalRevenue)),
          },
    )

    setIsSaving(false)
    resetAndClose()
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && resetAndClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingImport ? t("manual_sales_dialog_title_edit") : t("manual_sales_dialog_title")}</DialogTitle>
          <DialogDescription>{editingImport ? t("manual_sales_dialog_desc_edit") : t("manual_sales_dialog_desc")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="manual-sale-date">{t("manual_sales_date_label")}</Label>
            <Input
              id="manual-sale-date"
              type="date"
              value={saleDate}
              max={todayIso()}
              onChange={(e) => setSaleDate(e.target.value)}
              className="w-48"
            />
          </div>

          <div className="rounded-lg border p-3 space-y-3">
            <div className="flex gap-2">
              <Button
                type="button"
                variant={draftType === "recipe" ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setDraftType("recipe")
                  setDraftRefId(NONE_VALUE)
                }}
                className="gap-2"
              >
                <ChefHat className="h-4 w-4" />
                {t("manual_sales_type_recipe")}
              </Button>
              <Button
                type="button"
                variant={draftType === "menu" ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setDraftType("menu")
                  setDraftRefId(NONE_VALUE)
                }}
                className="gap-2"
              >
                <UtensilsCrossed className="h-4 w-4" />
                {t("manual_sales_type_menu")}
              </Button>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
              <div className="flex-1 space-y-1">
                <Label>{draftType === "recipe" ? t("manual_sales_pick_recipe") : t("manual_sales_pick_menu")}</Label>
                <Select value={draftRefId} onValueChange={setDraftRefId}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("manual_sales_pick_placeholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {(draftType === "recipe" ? recipes : menus).map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-full sm:w-20 space-y-1">
                <Label>{t("manual_sales_quantity_label")}</Label>
                <Input type="number" min="0" step="1" value={draftQuantity} onChange={(e) => setDraftQuantity(e.target.value)} />
              </div>
              <div className="w-full sm:w-28 space-y-1">
                <Label>{t("manual_sales_unit_price_label")}</Label>
                <Input type="number" min="0" step="0.01" value={draftUnitPrice} onChange={(e) => setDraftUnitPrice(e.target.value)} />
              </div>
              <Button type="button" onClick={handleAddLine} disabled={draftRefId === NONE_VALUE} className="gap-2 shrink-0">
                <Plus className="h-4 w-4" />
                {t("manual_sales_add_line")}
              </Button>
            </div>
          </div>

          {lines.length > 0 && (
            <ScrollArea className="max-h-52 rounded-lg border">
              <div className="divide-y">
                {lines.map((l) => (
                  <div key={l.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <div className="min-w-0">
                      {/* BUG CORREGIDO: era un <p> envolviendo un <Badge> (que
                      renderiza un <div>) — <div> dentro de <p> es HTML invalido,
                      mismo error de hidratacion ya corregido en
                      estadisticas-finanzas-tab.tsx para esta misma fila. */}
                      <div className="font-medium truncate flex items-center gap-2">
                        {l.name}
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {l.sourceType === "menu" ? t("manual_sales_type_menu") : t("manual_sales_type_recipe")}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {l.quantity} × {formatCurrency(l.unitPrice)} = {formatCurrency(l.quantity * l.unitPrice)}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => handleRemoveLine(l.id)} className="shrink-0">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}

          {lines.length > 0 && (
            <div className="rounded-lg bg-muted p-3 text-sm flex flex-wrap items-center gap-x-4 gap-y-1">
              <span>
                {summary.units} {t("manual_sales_summary_units")}
              </span>
              <Badge variant="outline">{formatCurrency(summary.revenue)}</Badge>
              <span className="text-muted-foreground">
                {t("manual_sales_summary_margin")}: {summary.margin.toFixed(1)}%
              </span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={resetAndClose}>
            {t("common_cancel")}
          </Button>
          <Button onClick={handleSave} disabled={lines.length === 0 || isSaving}>
            {isSaving
              ? t("manual_sales_saving")
              : editingImport
                ? t("equipo_save_changes_button")
                : t("manual_sales_save_button")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
