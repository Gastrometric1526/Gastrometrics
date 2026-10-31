"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { v4 as uuidv4 } from "uuid"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { DateField } from "@/components/ui/date-field"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Trash2, Plus, Minus, Search, Copy, Users, Info, Star } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/contexts/auth-context"
import { useLanguage } from "@/contexts/language-context"
import { logActivity } from "@/lib/services/activity-log"
import { formatCurrency } from "@/lib/currency"
import { addSalesImport, updateSalesImport } from "@/lib/storage/sales-imports"
import { getMenuUnitPriceAndCost } from "@/lib/menus"
import {
  PAYMENT_METHODS,
  SALES_CHANNELS,
  addItem,
  buildImportLines,
  draftTicketsFromImport,
  emptyTicket,
  knownTablesAndWaiters,
  normalizeSearch,
  ticketDiscount,
  ticketLabel,
  ticketsCount,
  ticketSubtotal,
  ticketTotal,
  ticketsToSave,
  topSoldRefs,
  type DraftTicket,
} from "@/lib/manual-sales"
import type { Recipe } from "@/types/recipe"
import type { Menu } from "@/lib/types/menus"
import type { PaymentMethod, SalesChannel, SalesImport } from "@/types/sales-import"
import { formatDate, toIsoDate } from "@/lib/date-format"
import { cn } from "@/lib/utils"

interface ManualSalesEntryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  businessId: string
  recipes: Recipe[]
  menus: Menu[]
  onSaved: (salesImport: SalesImport) => void
  /** Presente = editando este registro ya guardado en vez de crear uno nuevo. */
  editingImport?: SalesImport | null
  /** Registros manuales ya guardados: día repetido, mesas y meseros usados, lo más vendido (docs/215). */
  existingImports?: SalesImport[]
}

/** Un plato o menú que se puede vender, con su precio y costo de hoy. */
interface Sellable {
  sourceType: "recipe" | "menu"
  refId: string
  name: string
  price: number
  cost: number
  search: string
}

const NONE = "__none__"

// Fecha local, no UTC (docs/187): en Honduras, después de las 6 p. m. el UTC ya es mañana.
function todayIso(): string {
  return toIsoDate(new Date())
}

function nowTime(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}

// Día local del registro: periodStart es la medianoche local en ISO (UTC); cortar el texto
// daba el día anterior en husos por delante de UTC (Dinamarca, Francia, China).
const localDay = (iso: string) => toIsoDate(new Date(iso))

const num = (v: string) => {
  const n = Number.parseFloat(v)
  return Number.isFinite(n) ? n : 0
}

/**
 * Registro manual de ventas para negocios sin sistema de POS (docs/90), por cuentas y mesas
 * desde docs/215. Mismo destino de datos que la importación de POS (`addSalesImport`), así que
 * alimenta igual Finanzas, el historial y el stock teórico. Cada día tiene sus cuentas (mesa,
 * canal, comensales, hora, mesero, pago, descuento y propina) y cada cuenta sus platos o menús.
 * La lógica pura vive en lib/manual-sales.ts.
 */
export function ManualSalesEntryDialog({
  open,
  onOpenChange,
  businessId,
  recipes,
  menus,
  onSaved,
  editingImport = null,
  existingImports = [],
}: ManualSalesEntryDialogProps) {
  const { toast } = useToast()
  const { user } = useAuth()
  const { t } = useLanguage()

  const [saleDate, setSaleDate] = useState(todayIso)
  // Registro que se está editando: el que vino por props o el del mismo día al que se
  // decidió sumar las cuentas («Agregar a ese día»).
  const [baseImport, setBaseImport] = useState<SalesImport | null>(null)
  const [tickets, setTickets] = useState<DraftTicket[]>([])
  const [activeId, setActiveId] = useState<string>("")
  const [query, setQuery] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  const newTicket = (overrides: Partial<DraftTicket> = {}) =>
    emptyTicket(uuidv4(), { time: saleDate === todayIso() ? nowTime() : null, ...overrides })

  // Al abrir: precarga el registro a editar, o empieza con una cuenta vacía.
  useEffect(() => {
    if (!open) return
    setQuery("")
    if (editingImport) {
      const drafts = draftTicketsFromImport(editingImport, uuidv4)
      setBaseImport(editingImport)
      setSaleDate(editingImport.periodStart ? localDay(editingImport.periodStart) : todayIso())
      setTickets(drafts)
      setActiveId(drafts[0]?.id ?? "")
    } else {
      const first = emptyTicket(uuidv4(), { time: nowTime() })
      setBaseImport(null)
      setSaleDate(todayIso())
      setTickets([first])
      setActiveId(first.id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editingImport])

  const sellables = useMemo<Sellable[]>(() => {
    const fromRecipes = recipes.map((r) => ({ sourceType: "recipe" as const, refId: r.id, name: r.name, price: r.unitPrice ?? 0, cost: r.costPerServing ?? 0, search: normalizeSearch(r.name) }))
    const fromMenus = menus.map((m) => {
      const pc = getMenuUnitPriceAndCost(m, recipes)
      return { sourceType: "menu" as const, refId: m.id, name: m.name, price: pc.price, cost: pc.cost, search: normalizeSearch(m.name) }
    })
    return [...fromRecipes, ...fromMenus].sort((a, b) => a.name.localeCompare(b.name))
  }, [recipes, menus])

  const others = useMemo(() => existingImports.filter((imp) => imp.source === "manual" && imp.id !== baseImport?.id), [existingImports, baseImport])
  const known = useMemo(() => knownTablesAndWaiters(existingImports), [existingImports])
  const topSold = useMemo(() => {
    const byKey = new Map(sellables.map((s) => [`${s.sourceType}:${s.refId}`, s]))
    return topSoldRefs(existingImports)
      .map((r) => byKey.get(`${r.sourceType}:${r.refId}`))
      .filter((s): s is Sellable => !!s)
  }, [existingImports, sellables])

  const results = useMemo(() => {
    const q = normalizeSearch(query)
    if (!q) return []
    return sellables.filter((s) => s.search.includes(q)).slice(0, 8)
  }, [query, sellables])

  // Ya hay un registro manual de ese día: se ofrece sumar las cuentas a ese registro.
  const sameDay = useMemo(
    () => (baseImport ? null : others.find((imp) => !!imp.periodStart && localDay(imp.periodStart) === saleDate) ?? null),
    [baseImport, others, saleDate],
  )

  const active = tickets.find((tk) => tk.id === activeId) ?? tickets[0]
  const updateActive = (patch: Partial<DraftTicket> | ((tk: DraftTicket) => DraftTicket)) => {
    if (!active) return
    setTickets((prev) => prev.map((tk) => (tk.id === active.id ? (typeof patch === "function" ? patch(tk) : { ...tk, ...patch }) : tk)))
  }

  const addSellable = (s: Sellable) => {
    updateActive((tk) => addItem(tk, { id: uuidv4(), sourceType: s.sourceType, refId: s.refId, name: s.name, quantity: 1, unitPrice: s.price, unitCost: s.cost }))
    setQuery("")
    searchRef.current?.focus()
  }

  const setItem = (itemId: string, patch: { quantity?: number; unitPrice?: number }) =>
    updateActive((tk) => ({
      ...tk,
      items: tk.items
        .map((i) => (i.id === itemId ? { ...i, ...patch } : i))
        .filter((i) => i.quantity > 0),
    }))

  const addTicket = () => {
    const tk = newTicket()
    setTickets((prev) => [...prev, tk])
    setActiveId(tk.id)
  }

  // Repetir una cuenta (mismos platos, otra mesa): útil cuando varias mesas piden lo mismo.
  const duplicateTicket = () => {
    if (!active) return
    const tk: DraftTicket = { ...active, id: uuidv4(), table: null, tip: 0, discount: 0, items: active.items.map((i) => ({ ...i, id: uuidv4() })) }
    setTickets((prev) => [...prev, tk])
    setActiveId(tk.id)
  }

  const removeTicket = () => {
    if (!active || tickets.length === 1) return
    const rest = tickets.filter((tk) => tk.id !== active.id)
    setTickets(rest)
    setActiveId(rest[rest.length - 1].id)
  }

  const joinSameDay = () => {
    if (!sameDay) return
    const existing = draftTicketsFromImport(sameDay, uuidv4)
    const mine = tickets.filter((tk) => tk.items.length > 0)
    setBaseImport(sameDay)
    setTickets([...existing, ...(mine.length ? mine : [newTicket()])])
    setActiveId((mine[0] ?? existing[0]).id)
  }

  const summary = useMemo(() => {
    const withItems = tickets.filter((tk) => tk.items.length > 0)
    const revenue = withItems.reduce((s, tk) => s + ticketTotal(tk), 0)
    const cost = withItems.reduce((s, tk) => s + tk.items.reduce((c, i) => c + i.quantity * i.unitCost, 0), 0)
    const guests = withItems.reduce((s, tk) => s + (tk.guests || 0), 0)
    const units = withItems.reduce((s, tk) => s + tk.items.reduce((u, i) => u + i.quantity, 0), 0)
    return {
      tickets: withItems.length,
      units,
      guests,
      revenue,
      tips: withItems.reduce((s, tk) => s + (tk.tip || 0), 0),
      avgTicket: withItems.length ? revenue / withItems.length : 0,
      margin: revenue > 0 ? ((revenue - cost) / revenue) * 100 : 0,
    }
  }, [tickets])

  const close = () => onOpenChange(false)

  const handleSave = async () => {
    if (summary.tickets === 0) return
    setIsSaving(true)
    const saleDateObj = new Date(`${saleDate}T00:00:00`)
    const isoDate = saleDateObj.toISOString()
    const toSave = tickets.filter((tk) => tk.items.length > 0)
    const lines = buildImportLines(toSave, isoDate)
    const salesImport: SalesImport = {
      id: baseImport?.id ?? uuidv4(),
      businessId,
      fileName: `${t("manual_sales_entry_label")} — ${formatDate(saleDateObj)}`,
      importedAt: baseImport?.importedAt ?? new Date().toISOString(),
      periodStart: isoDate,
      periodEnd: isoDate,
      totalRevenue: lines.reduce((s, l) => s + l.revenue, 0),
      totalTheoreticalCost: lines.reduce((s, l) => s + l.theoreticalCost, 0),
      lineCount: lines.length,
      unmatchedDishNames: [],
      lines,
      tickets: ticketsToSave(toSave),
      source: "manual",
    }
    try {
      if (baseImport) await updateSalesImport(salesImport, businessId)
      else await addSalesImport(salesImport, businessId)
    } catch (error) {
      console.error("[manual-sales] No se pudo guardar:", error)
      toast({ title: t("manual_sales_save_error"), variant: "destructive" })
      setIsSaving(false)
      return
    }
    onSaved(salesImport)
    if (user) {
      logActivity({
        user,
        businessId: businessId && businessId !== "main" ? businessId : null,
        module: "estadisticas",
        action: baseImport ? "updated" : "imported",
        metadata: { count: lines.length, tickets: toSave.length },
      })
    }
    toast(
      baseImport
        ? { title: t("manual_sales_toast_updated_title"), description: t("manual_sales_toast_updated_desc").replace("{revenue}", formatCurrency(salesImport.totalRevenue)) }
        : {
            title: t("manual_sales_toast_saved_title"),
            description: t("ventas_toast_saved_tickets").replace("{count}", String(toSave.length)).replace("{revenue}", formatCurrency(salesImport.totalRevenue)),
          },
    )
    setIsSaving(false)
    close()
  }

  const tableChips = known.tables.length ? known.tables.slice(0, 16) : Array.from({ length: 10 }, (_, i) => String(i + 1))
  const usedTables = new Set(tickets.filter((tk) => tk.id !== active?.id).map((tk) => tk.table).filter(Boolean))
  const quickPicks = topSold.length ? topSold : sellables.slice(0, 8)
  const editing = !!baseImport

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? t("manual_sales_dialog_title_edit") : t("manual_sales_dialog_title")}</DialogTitle>
          <DialogDescription>{t("ventas_dialog_desc_tables")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="manual-sale-date">{t("manual_sales_date_label")}</Label>
              <DateField id="manual-sale-date" value={saleDate} max={todayIso()} onChange={(v) => setSaleDate(v)} className="w-48" />
            </div>
            {sameDay && (
              <div className="flex w-full flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm sm:w-auto sm:flex-1" role="status">
                <Info className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 basis-48">{t("ventas_same_day_notice").replace("{date}", formatDate(new Date(`${saleDate}T00:00:00`)))}</span>
                <Button size="sm" variant="outline" onClick={joinSameDay}>
                  {t("ventas_same_day_join")}
                </Button>
              </div>
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-[230px_minmax(0,1fr)]">
            {/* Cuentas del día */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">{t("ventas_tickets_title")}</p>
              <div className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
                {tickets.map((tk) => (
                  <button
                    key={tk.id}
                    type="button"
                    onClick={() => setActiveId(tk.id)}
                    className={cn(
                      "shrink-0 rounded-lg border px-3 py-2 text-left text-sm transition-colors min-w-[150px]",
                      tk.id === active?.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/60",
                    )}
                    aria-pressed={tk.id === active?.id}
                  >
                    <span className="block font-medium text-foreground truncate">{ticketLabel(tk, t as (k: string) => string)}</span>
                    <span className="block text-xs text-muted-foreground tabular-nums">
                      {tk.guests ? `${tk.guests} ${t("ventas_guests_short")} · ` : ""}
                      {tk.items.length ? formatCurrency(ticketTotal(tk)) : t("ventas_ticket_empty")}
                    </span>
                  </button>
                ))}
                <Button type="button" variant="outline" onClick={addTicket} className="shrink-0 gap-2 lg:w-full">
                  <Plus className="h-4 w-4" />
                  {t("ventas_ticket_add")}
                </Button>
              </div>
            </div>

            {/* Cuenta seleccionada */}
            {active && (
              <div className="space-y-4 rounded-lg border border-border p-3 sm:p-4 min-w-0">
                <div className="flex flex-wrap gap-2">
                  {SALES_CHANNELS.map((ch: SalesChannel) => (
                    <Button
                      key={ch}
                      type="button"
                      size="sm"
                      variant={active.channel === ch ? "default" : "outline"}
                      onClick={() => updateActive({ channel: ch, table: ch === "takeaway" || ch === "delivery" ? null : active.table })}
                    >
                      {t(`ventas_channel_${ch}` as never)}
                    </Button>
                  ))}
                </div>

                {(active.channel === "dine_in" || active.channel === "bar") && (
                  <div className="space-y-1.5">
                    <Label htmlFor="ticket-table">{t("ventas_table_label")}</Label>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Input
                        id="ticket-table"
                        value={active.table ?? ""}
                        onChange={(e) => updateActive({ table: e.target.value.trimStart() || null })}
                        placeholder={t("ventas_table_placeholder")}
                        className="w-32"
                        maxLength={20}
                      />
                      {tableChips.map((tb) => (
                        <button
                          key={tb}
                          type="button"
                          onClick={() => updateActive({ table: tb })}
                          className={cn(
                            "h-8 min-w-8 rounded-md border px-2 text-sm tabular-nums transition-colors",
                            active.table === tb ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted",
                            usedTables.has(tb) && active.table !== tb && "text-muted-foreground",
                          )}
                        >
                          {tb}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="space-y-1.5">
                    <Label>{t("ventas_guests_label")}</Label>
                    <div className="flex items-center gap-1">
                      <Button type="button" size="icon" variant="outline" className="h-9 w-9 shrink-0" aria-label={t("ventas_less")} onClick={() => updateActive({ guests: Math.max((active.guests || 0) - 1, 0) || null })}>
                        <Minus className="h-3.5 w-3.5" />
                      </Button>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        value={active.guests ?? ""}
                        onChange={(e) => updateActive({ guests: Math.max(Math.round(num(e.target.value)), 0) || null })}
                        className="w-14 text-center px-1"
                        aria-label={t("ventas_guests_label")}
                      />
                      <Button type="button" size="icon" variant="outline" className="h-9 w-9 shrink-0" aria-label={t("ventas_more")} onClick={() => updateActive({ guests: (active.guests || 0) + 1 })}>
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ticket-time">{t("ventas_time_label")}</Label>
                    <Input id="ticket-time" type="time" value={active.time ?? ""} onChange={(e) => updateActive({ time: e.target.value || null })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ticket-waiter">{t("ventas_waiter_label")}</Label>
                    <Input
                      id="ticket-waiter"
                      list="ventas-waiters"
                      value={active.waiter ?? ""}
                      onChange={(e) => updateActive({ waiter: e.target.value.trimStart() || null })}
                      placeholder={t("ventas_optional")}
                      maxLength={40}
                    />
                    <datalist id="ventas-waiters">
                      {known.waiters.map((w) => (
                        <option key={w} value={w} />
                      ))}
                    </datalist>
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("ventas_payment_label")}</Label>
                    <Select value={active.payment ?? NONE} onValueChange={(v) => updateActive({ payment: v === NONE ? null : (v as PaymentMethod) })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>{t("ventas_payment_none")}</SelectItem>
                        {PAYMENT_METHODS.map((p) => (
                          <SelectItem key={p} value={p}>
                            {t(`ventas_payment_${p}` as never)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Platos de la cuenta */}
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      ref={searchRef}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && results[0]) {
                          e.preventDefault()
                          addSellable(results[0])
                        }
                      }}
                      placeholder={t("ventas_search_placeholder")}
                      className="pl-9"
                      aria-label={t("ventas_search_placeholder")}
                    />
                  </div>
                  {query ? (
                    results.length ? (
                      <ul className="divide-y divide-border rounded-lg border border-border">
                        {results.map((s) => (
                          <li key={`${s.sourceType}:${s.refId}`}>
                            <button type="button" onClick={() => addSellable(s)} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted/60">
                              <span className="flex min-w-0 items-center gap-2">
                                <span className="truncate">{s.name}</span>
                                {s.sourceType === "menu" && (
                                  <Badge variant="outline" className="text-[10px] shrink-0">
                                    {t("manual_sales_type_menu")}
                                  </Badge>
                                )}
                              </span>
                              <span className="shrink-0 tabular-nums text-muted-foreground">{formatCurrency(s.price)}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground">{t("ventas_search_empty")}</p>
                    )
                  ) : (
                    quickPicks.length > 0 && (
                      <div className="space-y-1">
                        <p className="flex items-center gap-1 text-xs text-muted-foreground">
                          {topSold.length > 0 && <Star className="h-3 w-3" />}
                          {topSold.length > 0 ? t("ventas_top_sold") : t("ventas_quick_add")}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {quickPicks.map((s) => (
                            <button
                              key={`${s.sourceType}:${s.refId}`}
                              type="button"
                              onClick={() => addSellable(s)}
                              className="rounded-full border border-border px-3 py-1 text-sm hover:border-primary hover:bg-primary/5"
                            >
                              + {s.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  )}
                  {sellables.length === 0 && <p className="text-sm text-muted-foreground">{t("ventas_no_recipes")}</p>}

                  {active.items.length > 0 && (
                    <div className="divide-y divide-border rounded-lg border border-border">
                      {active.items.map((i) => (
                        <div key={i.id} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-2 gap-y-1.5 px-3 py-2 text-sm sm:flex sm:flex-wrap">
                          <div className="min-w-0 sm:flex-1 sm:basis-40">
                            <p className="truncate font-medium text-foreground">{i.name}</p>
                            {i.sourceType === "menu" && <p className="text-xs text-muted-foreground">{t("manual_sales_type_menu")}</p>}
                          </div>
                          <span className="text-right font-medium tabular-nums sm:order-last sm:w-24">{formatCurrency(i.quantity * i.unitPrice)}</span>
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 sm:order-last" aria-label={t("common_delete")} onClick={() => setItem(i.id, { quantity: 0 })}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                          <div className="col-span-3 flex items-center gap-1">
                            <Button type="button" size="icon" variant="outline" className="h-8 w-8" aria-label={t("ventas_less")} onClick={() => setItem(i.id, { quantity: i.quantity - 1 })}>
                              <Minus className="h-3.5 w-3.5" />
                            </Button>
                            <Input
                              type="number"
                              min="0"
                              step="1"
                              value={i.quantity}
                              onChange={(e) => setItem(i.id, { quantity: Math.max(num(e.target.value), 0) })}
                              className="h-8 w-14 text-center px-1"
                              aria-label={t("manual_sales_quantity_label")}
                            />
                            <Button type="button" size="icon" variant="outline" className="h-8 w-8" aria-label={t("ventas_more")} onClick={() => setItem(i.id, { quantity: i.quantity + 1 })}>
                              <Plus className="h-3.5 w-3.5" />
                            </Button>
                            <span className="px-1 text-muted-foreground">×</span>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={i.unitPrice}
                              onChange={(e) => setItem(i.id, { unitPrice: Math.max(num(e.target.value), 0) })}
                              className="h-8 w-24"
                              aria-label={t("manual_sales_unit_price_label")}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(2,minmax(0,8rem))_minmax(0,1fr)]">
                  <div className="space-y-1.5">
                    <Label htmlFor="ticket-discount">{t("ventas_discount_label")}</Label>
                    <Input id="ticket-discount" type="number" min="0" step="0.01" value={active.discount || ""} onChange={(e) => updateActive({ discount: Math.max(num(e.target.value), 0) })} placeholder="0" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ticket-tip">{t("ventas_tip_label")}</Label>
                    <Input id="ticket-tip" type="number" min="0" step="0.01" value={active.tip || ""} onChange={(e) => updateActive({ tip: Math.max(num(e.target.value), 0) })} placeholder="0" />
                  </div>
                  <div className="col-span-2 space-y-1.5 sm:col-span-1">
                    <Label htmlFor="ticket-note">{t("ventas_note_label")}</Label>
                    <Input id="ticket-note" value={active.note ?? ""} onChange={(e) => updateActive({ note: e.target.value || null })} placeholder={t("ventas_optional")} maxLength={140} />
                  </div>
                </div>

                <div className="flex flex-wrap items-end justify-between gap-3 border-t border-border pt-3">
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={duplicateTicket} disabled={active.items.length === 0}>
                      <Copy className="h-4 w-4" />
                      {t("ventas_ticket_duplicate")}
                    </Button>
                    {tickets.length > 1 && (
                      <Button type="button" variant="ghost" size="sm" className="gap-1.5 text-destructive" onClick={removeTicket}>
                        <Trash2 className="h-4 w-4" />
                        {t("ventas_ticket_remove")}
                      </Button>
                    )}
                  </div>
                  <dl className="grid grid-cols-[auto_auto] gap-x-4 text-sm tabular-nums">
                    <dt className="text-muted-foreground">{t("ventas_subtotal")}</dt>
                    <dd className="text-right">{formatCurrency(ticketSubtotal(active))}</dd>
                    {ticketDiscount(active) > 0 && (
                      <>
                        <dt className="text-muted-foreground">{t("ventas_discount_label")}</dt>
                        <dd className="text-right">− {formatCurrency(ticketDiscount(active))}</dd>
                      </>
                    )}
                    <dt className="font-semibold text-foreground">{t("ventas_ticket_total")}</dt>
                    <dd className="text-right font-semibold text-foreground">{formatCurrency(ticketTotal(active))}</dd>
                    {active.tip > 0 && (
                      <>
                        <dt className="text-muted-foreground">{t("ventas_tip_label")}</dt>
                        <dd className="text-right text-muted-foreground">{formatCurrency(active.tip)}</dd>
                      </>
                    )}
                  </dl>
                </div>
              </div>
            )}
          </div>

          {summary.tickets > 0 && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-muted p-3 text-sm">
              <span>{ticketsCount(summary.tickets, t as (k: string) => string)}</span>
              {summary.guests > 0 && (
                <span className="inline-flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  {summary.guests}
                </span>
              )}
              <span>
                {summary.units} {t("manual_sales_summary_units")}
              </span>
              <Badge variant="outline">{formatCurrency(summary.revenue)}</Badge>
              <span className="text-muted-foreground">
                {t("ventas_avg_ticket")}: {formatCurrency(summary.avgTicket)}
              </span>
              <span className="text-muted-foreground">
                {t("manual_sales_summary_margin")}: {summary.margin.toFixed(1)}%
              </span>
              {summary.tips > 0 && (
                <span className="text-muted-foreground">
                  {t("ventas_tips_total")}: {formatCurrency(summary.tips)}
                </span>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={close}>
            {t("common_cancel")}
          </Button>
          <Button onClick={handleSave} disabled={summary.tickets === 0 || isSaving}>
            {isSaving ? t("manual_sales_saving") : editing ? t("equipo_save_changes_button") : t("manual_sales_save_button")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
