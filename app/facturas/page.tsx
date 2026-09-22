"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { v4 as uuidv4 } from "uuid"
import { ArrowLeft, Plus, Receipt, Search, Trash2, Pencil, Download, DollarSign, FileText, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NumericInput } from "@/components/ui/numeric-input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Sidebar } from "@/components/sidebar"
import { AuthGuard } from "@/components/auth-guard"
import { useLanguage } from "@/contexts/language-context"
import { useToast } from "@/hooks/use-toast"
import { formatCurrency } from "@/lib/currency"
import { hasFeatureAccess, useFeatureAccess, getAccessBlockReason } from "@/lib/plan-access"
import { FeatureLockedPage } from "@/components/feature-locked"
import { AdminRestrictedPage } from "@/components/admin-restricted"
import { getBusinessById } from "@/lib/storage/businesses"
import { getRecipes, ensureRecipesLoaded } from "@/lib/storage/recipes"
import { getMenus, ensureMenusLoaded, getMenuUnitPriceAndCost } from "@/lib/menus"
import {
  useInvoices,
  ensureInvoicesLoaded,
  addInvoice,
  updateInvoice,
  deleteInvoice,
  getNextInvoiceNumber,
} from "@/lib/storage/invoices"
import { downloadInvoicePDF } from "@/lib/pdf/invoice-pdf-generator"
import { addSalesImport, updateSalesImport, deleteSalesImport } from "@/lib/storage/sales-imports"
import type { Invoice, InvoiceLineItem } from "@/types/invoice"
import type { Recipe } from "@/types/recipe"
import type { Menu } from "@/lib/types/menus"
import type { SalesImport, SalesImportLine } from "@/types/sales-import"

const NONE_VALUE = "__none__"

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

interface DraftItem {
  id: string
  description: string
  quantity: string
  unitPrice: string
  sourceId?: string | null
}

function emptyDraftItem(): DraftItem {
  return { id: uuidv4(), description: "", quantity: "1", unitPrice: "0" }
}

// Facturación a clientes — pedido explícito del dueño del proyecto tras la pregunta
// real de un usuario ("how do I make an invoice, is that external?"). Mismo patrón de
// página que app/menus.tsx / components/purchase-order-page.tsx (lista + diálogo de
// alta/edición + descarga de PDF), pero de cara al CLIENTE del negocio, no a un
// proveedor — reusa los precios ya cargados en Ficha Técnica/Menús en vez de pedirlos
// de nuevo, y el nombre/logo del negocio (types/business.ts#logo, ya usado en el resto
// de los PDF) para que la factura se vea real.
// BUG CORREGIDO: useSearchParams() (para leer ?business=) exige un límite de Suspense
// por encima para poder pre-renderizarse estáticamente — sin él, `next build` fallaba
// (mismo problema ya corregido en app/signup/page.tsx y components/sidebar.tsx).
export default function FacturasPage() {
  return (
    <Suspense fallback={null}>
      <FacturasPageInner />
    </Suspense>
  )
}

function FacturasPageInner() {
  const searchParams = useSearchParams()
  const businessId = searchParams.get("business") || "main"
  const { t, language } = useLanguage()
  const { toast } = useToast()
  const canAccessInvoices = useFeatureAccess("invoices")

  const invoices = useInvoices(businessId)
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [menus, setMenus] = useState<Menu[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null)
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Draft del diálogo
  const [draftNumber, setDraftNumber] = useState("")
  const [draftIssueDate, setDraftIssueDate] = useState(todayIso)
  const [draftClientName, setDraftClientName] = useState("")
  const [draftClientTaxId, setDraftClientTaxId] = useState("")
  const [draftClientEmail, setDraftClientEmail] = useState("")
  const [draftClientAddress, setDraftClientAddress] = useState("")
  const [draftItems, setDraftItems] = useState<DraftItem[]>([emptyDraftItem()])
  const [draftTaxPercent, setDraftTaxPercent] = useState("0")
  const [draftNotes, setDraftNotes] = useState("")
  const [draftError, setDraftError] = useState<string | null>(null)

  useEffect(() => {
    ensureInvoicesLoaded(businessId)
    Promise.all([ensureRecipesLoaded(businessId), ensureMenusLoaded(businessId)]).then(() => {
      setRecipes(getRecipes(businessId))
      setMenus(getMenus(businessId))
    })
  }, [businessId])

  const sourceOptions = useMemo(
    () => [
      ...recipes.map((r) => ({ id: `recipe:${r.id}`, name: r.name, price: r.unitPrice || 0 })),
      ...menus.map((m) => {
        const priceAndCost = getMenuUnitPriceAndCost(m, recipes)
        return { id: `menu:${m.id}`, name: m.name, price: priceAndCost?.price || 0 }
      }),
    ],
    [recipes, menus],
  )

  const filteredInvoices = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    const sorted = [...invoices].sort((a, b) => b.number.localeCompare(a.number))
    if (!term) return sorted
    return sorted.filter(
      (inv) => inv.clientName.toLowerCase().includes(term) || inv.number.toLowerCase().includes(term),
    )
  }, [invoices, searchTerm])

  const totalInvoiced = useMemo(() => invoices.reduce((sum, inv) => sum + inv.total, 0), [invoices])

  const resetDraft = () => {
    setDraftNumber(getNextInvoiceNumber(businessId))
    setDraftIssueDate(todayIso())
    setDraftClientName("")
    setDraftClientTaxId("")
    setDraftClientEmail("")
    setDraftClientAddress("")
    setDraftItems([emptyDraftItem()])
    setDraftTaxPercent("0")
    setDraftNotes("")
    setDraftError(null)
  }

  const openNewDialog = () => {
    setEditingInvoice(null)
    resetDraft()
    setIsDialogOpen(true)
  }

  const openEditDialog = (invoice: Invoice) => {
    setEditingInvoice(invoice)
    setDraftNumber(invoice.number)
    setDraftIssueDate(invoice.issueDate.slice(0, 10))
    setDraftClientName(invoice.clientName)
    setDraftClientTaxId(invoice.clientTaxId || "")
    setDraftClientEmail(invoice.clientEmail || "")
    setDraftClientAddress(invoice.clientAddress || "")
    setDraftItems(
      invoice.items.length
        ? invoice.items.map((item) => ({
            id: item.id,
            description: item.description,
            quantity: String(item.quantity),
            unitPrice: item.unitPrice.toFixed(2),
            sourceId: item.sourceId,
          }))
        : [emptyDraftItem()],
    )
    setDraftTaxPercent(String(invoice.taxPercent))
    setDraftNotes(invoice.notes || "")
    setDraftError(null)
    setIsDialogOpen(true)
  }

  const updateDraftItem = (id: string, patch: Partial<DraftItem>) => {
    setDraftItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }

  const addDraftItem = () => setDraftItems((prev) => [...prev, emptyDraftItem()])

  const removeDraftItem = (id: string) => {
    setDraftItems((prev) => (prev.length > 1 ? prev.filter((item) => item.id !== id) : prev))
  }

  const applySourceToItem = (itemId: string, sourceId: string) => {
    if (sourceId === NONE_VALUE) {
      updateDraftItem(itemId, { sourceId: null })
      return
    }
    const source = sourceOptions.find((s) => s.id === sourceId)
    if (!source) return
    updateDraftItem(itemId, {
      description: source.name,
      unitPrice: source.price > 0 ? source.price.toFixed(2) : "0",
      sourceId,
    })
  }

  const draftTotals = useMemo(() => {
    const subtotal = draftItems.reduce((sum, item) => {
      const qty = Number.parseFloat(item.quantity)
      const price = Number.parseFloat(item.unitPrice)
      if (!Number.isFinite(qty) || !Number.isFinite(price)) return sum
      return sum + qty * price
    }, 0)
    const taxPercent = Number.parseFloat(draftTaxPercent) || 0
    const taxAmount = subtotal * (taxPercent / 100)
    return { subtotal, taxPercent, taxAmount, total: subtotal + taxAmount }
  }, [draftItems, draftTaxPercent])

  // Una factura ES una venta — pedido explícito del dueño del proyecto tras el
  // análisis de docs/123 (Fase 1): sin esto, facturar un catering quedaba invisible
  // para Estadísticas → Finanzas/Menu Engineering/food cost real vs. teórico, porque
  // esos paneles solo leen de sales_imports, nunca de invoices. id determinístico
  // ("invoice_" + id de la factura) para que editar/borrar la factura actualice/borre
  // la MISMA fila de venta en vez de ir acumulando duplicados. totalRevenue usa el
  // SUBTOTAL, nunca el total con impuesto — el impuesto es plata del cliente para el
  // fisco, no ingreso real del negocio, y mezclarlo infla el food cost % de mentira.
  const buildSalesImportFromInvoice = (invoice: Invoice): SalesImport => {
    const invoiceIsoDate = new Date(`${invoice.issueDate}T00:00:00`).toISOString()
    const lines: SalesImportLine[] = invoice.items.map((item) => {
      const recipeId = item.sourceId?.startsWith("recipe:") ? item.sourceId.slice("recipe:".length) : null
      const menuId = item.sourceId?.startsWith("menu:") ? item.sourceId.slice("menu:".length) : null
      const recipe = recipeId ? recipes.find((r) => r.id === recipeId) : undefined
      const menu = menuId ? menus.find((m) => m.id === menuId) : undefined
      const unitCost = recipe
        ? recipe.costPerServing || 0
        : menu
          ? getMenuUnitPriceAndCost(menu, recipes)?.cost || 0
          : 0
      return {
        id: item.id,
        rawDishName: item.description,
        recipeId,
        menuId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        revenue: item.amount,
        theoreticalCost: item.quantity * unitCost,
        date: invoiceIsoDate,
      }
    })
    const isoDate = invoiceIsoDate
    return {
      id: `invoice_${invoice.id}`,
      businessId,
      fileName: `${t("facturas_header_title")} #${invoice.number} — ${invoice.clientName}`,
      importedAt: invoice.metadata.createdAt,
      periodStart: isoDate,
      periodEnd: isoDate,
      totalRevenue: invoice.subtotal,
      totalTheoreticalCost: lines.reduce((sum, l) => sum + l.theoreticalCost, 0),
      lineCount: lines.length,
      unmatchedDishNames: lines.filter((l) => !l.recipeId && !l.menuId).map((l) => l.rawDishName),
      lines,
      source: "invoice",
      invoiceId: invoice.id,
    }
  }

  const syncSalesImportForInvoice = async (invoice: Invoice, isNew: boolean) => {
    try {
      const salesImport = buildSalesImportFromInvoice(invoice)
      if (isNew) {
        await addSalesImport(salesImport, businessId)
      } else {
        await updateSalesImport(salesImport, businessId)
      }
    } catch (error) {
      // Best-effort: nunca debe deshacer o bloquear el guardado de la factura, que ya
      // se confirmó. Un miembro de equipo con "invoices" pero sin "stats_finance"
      // puede caer acá (RLS de sales_imports, ver 0011_team_write_access.sql) — la
      // factura igual queda guardada, solo no se refleja en Finanzas hasta que el
      // dueño la abra y la vuelva a guardar.
      console.error("[Facturas] Error sincronizando la venta en Estadísticas:", error)
    }
  }

  const handleSave = async () => {
    setDraftError(null)
    if (!draftClientName.trim()) {
      setDraftError(t("facturas_validation_client_name"))
      return
    }
    const items: InvoiceLineItem[] = draftItems
      .map((item) => {
        const quantity = Number.parseFloat(item.quantity)
        const unitPrice = Number.parseFloat(item.unitPrice)
        if (!item.description.trim() || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0) {
          return null
        }
        return {
          id: item.id,
          description: item.description.trim(),
          quantity,
          unitPrice,
          amount: quantity * unitPrice,
          sourceId: item.sourceId,
        }
      })
      .filter((item): item is InvoiceLineItem => item !== null)

    if (items.length === 0) {
      setDraftError(t("facturas_validation_items"))
      return
    }

    const subtotal = items.reduce((sum, item) => sum + item.amount, 0)
    const taxPercent = Number.parseFloat(draftTaxPercent) || 0
    const taxAmount = subtotal * (taxPercent / 100)

    const now = new Date().toISOString()
    const invoice: Invoice = {
      id: editingInvoice?.id || uuidv4(),
      businessId,
      number: draftNumber.trim() || getNextInvoiceNumber(businessId),
      status: editingInvoice?.status || "issued",
      issueDate: draftIssueDate,
      clientName: draftClientName.trim(),
      clientTaxId: draftClientTaxId.trim() || undefined,
      clientEmail: draftClientEmail.trim() || undefined,
      clientAddress: draftClientAddress.trim() || undefined,
      items,
      taxPercent,
      notes: draftNotes.trim() || undefined,
      subtotal,
      taxAmount,
      total: subtotal + taxAmount,
      metadata: {
        createdAt: editingInvoice?.metadata.createdAt || now,
        updatedAt: now,
        version: (editingInvoice?.metadata.version || 0) + 1,
      },
    }

    setIsSaving(true)
    try {
      if (editingInvoice) {
        await updateInvoice(businessId, editingInvoice.id, invoice)
      } else {
        await addInvoice(businessId, invoice)
      }
      await syncSalesImportForInvoice(invoice, !editingInvoice)
      toast({ title: t("facturas_toast_saved_title"), description: t("facturas_toast_saved_desc") })
      setIsDialogOpen(false)
    } catch (error) {
      console.error("[Facturas] Error guardando factura:", error)
      toast({
        title: t("facturas_toast_error_title"),
        description: t("facturas_toast_error_desc"),
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!invoiceToDelete) return
    await deleteInvoice(businessId, invoiceToDelete.id)
    try {
      await deleteSalesImport(`invoice_${invoiceToDelete.id}`, businessId)
    } catch (error) {
      console.error("[Facturas] Error borrando la venta vinculada en Estadísticas:", error)
    }
    toast({ title: t("facturas_toast_deleted_title") })
    setInvoiceToDelete(null)
  }

  const handleDownload = (invoice: Invoice) => {
    const business = getBusinessById(businessId)
    downloadInvoicePDF(invoice, { businessName: business?.name, businessLogo: business?.logo, businessId })
  }

  if (canAccessInvoices === null) {
    return null
  }

  if (!canAccessInvoices) {
    return getAccessBlockReason("invoices") === "admin" ? (
      <AdminRestrictedPage sectionName={t("facturas_header_title")} />
    ) : (
      <FeatureLockedPage feature="invoices" title={t("facturas_locked_title")} description={t("facturas_locked_desc")} />
    )
  }

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <div className="flex-1 overflow-hidden">
          <div className="h-full overflow-y-auto">
            <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 space-y-6">
              {/* Header */}
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-2 md:gap-4">
                  <Link href={businessId !== "main" ? `/business/${businessId}` : "/dashboard"}>
                    <Button variant="outline" size="sm" className="gap-2 hover:bg-accent bg-transparent">
                      <ArrowLeft className="h-4 w-4" />
                      <span className="hidden sm:inline">{t("mi_plan_back_to_dashboard")}</span>
                    </Button>
                  </Link>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-chart-6/10 rounded-lg flex items-center justify-center">
                      <Receipt className="h-6 w-6 text-chart-6" />
                    </div>
                    <div>
                      <h1 className="text-2xl md:text-3xl font-bold text-foreground">{t("facturas_header_title")}</h1>
                      <p className="text-sm md:text-base text-muted-foreground">{t("facturas_header_subtitle")}</p>
                    </div>
                  </div>
                </div>
                <Button size="lg" className="gap-2" onClick={openNewDialog}>
                  <Plus className="h-4 w-4" />
                  {t("facturas_new_button")}
                </Button>
              </div>

              {/* Aviso legal real: este documento es un cobro al cliente, no una factura
                  fiscal oficial de ningún país (sin CAI/CUFE/folio fiscal ni integración
                  con ninguna autoridad tributaria) — pedido explícito del dueño del
                  proyecto, para no generar una expectativa que el producto no cumple.
                  Mismo aviso, más corto, se imprime en el propio PDF (ver
                  lib/pdf/invoice-pdf-generator.ts). */}
              <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground">
                <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>{t("facturas_not_fiscal_notice")}</span>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">{t("facturas_stat_total_label")}</p>
                      <p className="text-xl font-bold text-foreground">{invoices.length}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-chart-2/10 flex items-center justify-center shrink-0">
                      <DollarSign className="h-5 w-5 text-chart-2" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">{t("facturas_stat_amount_label")}</p>
                      <p className="text-xl font-bold text-foreground">{formatCurrency(totalInvoiced)}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Search */}
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={t("facturas_search_placeholder")}
                  className="pl-9"
                />
              </div>

              {/* Lista */}
              {filteredInvoices.length === 0 ? (
                <Card>
                  <CardContent className="py-16 text-center space-y-4">
                    <Receipt className="h-10 w-10 text-muted-foreground mx-auto" />
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">{t("facturas_empty_title")}</h3>
                      <p className="text-sm text-muted-foreground mt-1">{t("facturas_empty_desc")}</p>
                    </div>
                    <Button onClick={openNewDialog} className="gap-2">
                      <Plus className="h-4 w-4" />
                      {t("facturas_empty_cta")}
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="p-0 overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("facturas_col_number")}</TableHead>
                          <TableHead>{t("facturas_col_client")}</TableHead>
                          <TableHead>{t("facturas_col_date")}</TableHead>
                          <TableHead className="text-right">{t("facturas_col_total")}</TableHead>
                          <TableHead className="text-right">{t("facturas_col_actions")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredInvoices.map((invoice) => (
                          <TableRow key={invoice.id}>
                            <TableCell className="font-medium">{invoice.number}</TableCell>
                            <TableCell>{invoice.clientName}</TableCell>
                            <TableCell className="text-muted-foreground">
                              {new Date(invoice.issueDate).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="text-right font-medium tabular-nums">
                              {formatCurrency(invoice.total)}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center justify-end gap-1">
                                <Button variant="ghost" size="icon" onClick={() => handleDownload(invoice)} title={t("facturas_download_pdf")}>
                                  <Download className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => openEditDialog(invoice)} title={t("facturas_edit_button")}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setInvoiceToDelete(invoice)}
                                  title={t("facturas_delete_button")}
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Diálogo de alta/edición */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingInvoice ? t("facturas_dialog_title_edit") : t("facturas_dialog_title_new")}</DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{t("facturas_field_number")}</Label>
                <Input value={draftNumber} onChange={(e) => setDraftNumber(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("facturas_field_issue_date")}</Label>
                <Input type="date" value={draftIssueDate} onChange={(e) => setDraftIssueDate(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>{t("facturas_field_client_name")}</Label>
              <Input
                value={draftClientName}
                onChange={(e) => setDraftClientName(e.target.value)}
                placeholder={t("facturas_field_client_name_placeholder")}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>{t("facturas_field_client_tax_id")}</Label>
                <Input value={draftClientTaxId} onChange={(e) => setDraftClientTaxId(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("facturas_field_client_email")}</Label>
                <Input type="email" value={draftClientEmail} onChange={(e) => setDraftClientEmail(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("facturas_field_client_address")}</Label>
                <Input value={draftClientAddress} onChange={(e) => setDraftClientAddress(e.target.value)} />
              </div>
            </div>

            <div className="space-y-3">
              <Label>{t("facturas_items_title")}</Label>
              <div className="space-y-3">
                {draftItems.map((item) => (
                  <div key={item.id} className="border border-hairline rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Select value={item.sourceId || NONE_VALUE} onValueChange={(value) => applySourceToItem(item.id, value)}>
                        <SelectTrigger className="h-9 flex-1">
                          <SelectValue placeholder={t("facturas_item_source_placeholder")} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE_VALUE}>{t("facturas_item_source_placeholder")}</SelectItem>
                          {sourceOptions.map((source) => (
                            <SelectItem key={source.id} value={source.id}>
                              {source.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeDraftItem(item.id)}
                        disabled={draftItems.length <= 1}
                        className="text-muted-foreground hover:text-destructive shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <Input
                      value={item.description}
                      onChange={(e) => updateDraftItem(item.id, { description: e.target.value })}
                      placeholder={t("facturas_item_description_placeholder")}
                    />
                    <div className="grid grid-cols-3 gap-2 items-end">
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          {t("ficha_tecnica_col_quantity")}
                        </Label>
                        <NumericInput
                          value={Number.parseFloat(item.quantity) || 0}
                          onChange={(value) => updateDraftItem(item.id, { quantity: String(value) })}
                          decimalPlaces={2}
                          className="h-8"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          {t("landing_calc_unit_price_placeholder")}
                        </Label>
                        <NumericInput
                          value={Number.parseFloat(item.unitPrice) || 0}
                          onChange={(value) => updateDraftItem(item.id, { unitPrice: String(value) })}
                          decimalPlaces={2}
                          className="h-8"
                        />
                      </div>
                      <p className="text-sm font-medium text-right tabular-nums pb-1.5">
                        {formatCurrency((Number.parseFloat(item.quantity) || 0) * (Number.parseFloat(item.unitPrice) || 0))}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addDraftItem} className="gap-2">
                <Plus className="h-3.5 w-3.5" />
                {t("facturas_add_item")}
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{t("facturas_tax_label")}</Label>
                <NumericInput
                  value={Number.parseFloat(draftTaxPercent) || 0}
                  onChange={(value) => setDraftTaxPercent(String(value))}
                  decimalPlaces={2}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("inventario_register_notes_label")}</Label>
                <Input value={draftNotes} onChange={(e) => setDraftNotes(e.target.value)} />
              </div>
            </div>

            <div className="border-t border-hairline pt-4 space-y-1.5 max-w-xs ml-auto text-right">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>{t("facturas_subtotal_label")}</span>
                <span className="tabular-nums">{formatCurrency(draftTotals.subtotal)}</span>
              </div>
              {draftTotals.taxPercent > 0 && (
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>
                    {t("facturas_tax_label")} ({draftTotals.taxPercent}%)
                  </span>
                  <span className="tabular-nums">{formatCurrency(draftTotals.taxAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-semibold text-foreground">
                <span>{t("facturas_total_label")}</span>
                <span className="tabular-nums">{formatCurrency(draftTotals.total)}</span>
              </div>
            </div>

            {draftError && <p className="text-sm text-destructive text-center">{draftError}</p>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              {t("facturas_cancel_button")}
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {t("facturas_save_button")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmar borrado */}
      <AlertDialog open={!!invoiceToDelete} onOpenChange={(open) => !open && setInvoiceToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("facturas_delete_confirm_title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("facturas_delete_confirm_desc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("facturas_cancel_button")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t("facturas_delete_button")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AuthGuard>
  )
}
