"use client"

/**
 * Salón — POS propio de GastroMetrics (pedido del dueño, docs/268): «el sistema POS lo
 * podríamos hacer para crear un mapa del salón, colocar números de sillas, que se pueda ver
 * la receta o plato vía foto seleccionable y poder agregar o seleccionar extras».
 *
 * Tres pestañas: Salón (plano y pedidos), Cocina (lo que hay que preparar) y Ajustes (plano,
 * extras y carta). Los datos son compartidos entre aparatos (lib/storage/pos.ts) y la
 * pantalla relee cada pocos segundos. Al cobrar, la cuenta se suma al registro manual de
 * ventas del día (lib/pos.ts → mergeSaleIntoDay). Desde Sous Chef. No emite facturas
 * fiscales.
 */

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Armchair, Building2, ChefHat, LayoutGrid, RefreshCw, Settings2, ShoppingBag, WifiOff } from "lucide-react"
import { PosBusinessPicker, rememberPosBusiness } from "@/components/pos/pos-business-picker"
import { useAllBusinesses } from "@/lib/storage/businesses"
import { v4 as uuidv4 } from "uuid"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Sidebar } from "@/components/sidebar"
import { AuthGuard } from "@/components/auth-guard"
import { FeatureLockedPage } from "@/components/feature-locked"
import { AdminRestrictedPage } from "@/components/admin-restricted"
import { SalonTour } from "@/components/page-tours"
import { FloorMap } from "@/components/pos/floor-map"
import { OrderPanel } from "@/components/pos/order-panel"
import { DishPicker, type PosSellable } from "@/components/pos/dish-picker"
import { buildCartas } from "@/lib/pos-carta"
import { getClassificationLabel } from "@/lib/classification-labels"
import { CheckoutDialog } from "@/components/pos/checkout-dialog"
import { KitchenBoard } from "@/components/pos/kitchen-board"
import { PosSettings } from "@/components/pos/pos-settings"
import { useToast } from "@/hooks/use-toast"
import { useLanguage } from "@/contexts/language-context"
import { useFeatureAccess, getAccessBlockReason } from "@/lib/plan-access"
import { getRecipes, ensureRecipesLoaded } from "@/lib/storage/recipes"
import { getMenus, ensureMenusLoaded } from "@/lib/menus"
import { ensureSalesImportsLoaded } from "@/lib/storage/sales-imports"
import {
  fetchPosData,
  fetchPosOrder,
  saveFloorPlan,
  savePosConfig,
  savePosOrderVersioned,
  deletePosOrder,
  isConnectionError,
  PosConflictError,
  type PosData,
} from "@/lib/storage/pos"
import { dequeueOrder, enqueueOrder, overlayQueued, readQueue } from "@/lib/pos-queue"
import { savePosSaleToDay } from "@/lib/storage/sales-imports"
import { toIsoDate, formatDate } from "@/lib/date-format"
import { formatCurrency } from "@/lib/currency"
import {
  addOrderItem,
  buildPosSale,
  defaultFloorPlan,
  emptyConfig,
  mergeSaleIntoDay,
  kitchenQueue,
  mergeOrderEdit,
  orderTotal,
  posTicketId,
  voidItem,
  sendToKitchen,
  serviceSummary,
  setItemQuantity,
  setItemStatus,
} from "@/lib/pos"
import type { FloorPlan, PosConfig, PosOrder, PosOrderExtra, PosPayment, PosVoidReason } from "@/types/pos"
import type { Recipe } from "@/types/recipe"
import type { Menu } from "@/lib/types/menus"

const POLL_MS = 5000

const WAITER_KEY = "gm_pos_waiter"

// Resumen del servicio (docs/273): mismos colores que el plano.
const SUMMARY_STYLE = { free: "border-border bg-card", busy: "border-primary/30 bg-primary/5", ready: "border-success/40 bg-success-soft", bill: "border-warning/40 bg-warning-soft" } as const
const SUMMARY_DOT = { free: "bg-card border-border", busy: "bg-primary/15 border-primary", ready: "bg-success/20 border-success", bill: "bg-warning/20 border-warning" } as const

function TabBadge({ n, label, tone }: { n: number; label: string; tone: "success" | "info" }) {
  return (
    <span
      aria-label={label}
      title={label}
      className={`ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums ${tone === "success" ? "bg-success-soft text-success" : "bg-info-soft text-info"}`}
    >
      {n}
    </span>
  )
}

export default function SalonPage() {
  return (
    <Suspense fallback={null}>
      <SalonRouter />
    </Suspense>
  )
}

/**
 * El POS trabaja siempre dentro de un negocio (docs/276). Sin negocio en la dirección, se
 * elige uno (PosBusinessPicker). El espacio principal solo se abre para cerrar cuentas que
 * quedaron de antes (`?business=main&legacy=1`).
 */
function SalonRouter() {
  const searchParams = useSearchParams()
  const business = searchParams.get("business")
  const legacy = searchParams.get("legacy") === "1"
  const canAccess = useFeatureAccess("pos")
  const { t } = useLanguage()
  if (canAccess === null) return null
  if (!canAccess) {
    return getAccessBlockReason("pos") === "admin" ? (
      <AdminRestrictedPage sectionName={t("nav_salon")} />
    ) : (
      <FeatureLockedPage feature="pos" title={t("pos_locked_title")} description={t("pos_locked_desc")} />
    )
  }
  if (!business || (business === "main" && !legacy)) {
    return (
      <AuthGuard>
        <PosBusinessPicker />
      </AuthGuard>
    )
  }
  return <SalonPageInner businessId={business} legacy={business === "main"} />
}

function SalonPageInner({ businessId, legacy }: { businessId: string; legacy: boolean }) {
  const { t, language } = useLanguage()
  const businesses = useAllBusinesses()
  const currentBusiness = businesses.find((b) => b.id === businessId) ?? null
  useEffect(() => {
    if (!legacy) rememberPosBusiness(businessId)
  }, [businessId, legacy])
  // Plano y extras del espacio principal (POS de antes de docs/276), para traerlos a este negocio.
  const [mainPos, setMainPos] = useState<PosData | null>(null)
  useEffect(() => {
    if (legacy) return
    fetchPosData("main").then(setMainPos).catch(() => {})
  }, [legacy])
  const { toast } = useToast()
  const canAccess = useFeatureAccess("pos")

  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [menus, setMenus] = useState<Menu[]>([])
  const [data, setData] = useState<PosData | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [areaId, setAreaId] = useState<string | null>(null)
  const [openKey, setOpenKey] = useState<string | null>(null) // tableId o id de pedido para llevar
  const [draft, setDraft] = useState<PosOrder | null>(null)
  const [seat, setSeat] = useState(1)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const busy = useRef(0)
  // Cambios que no se pudieron guardar por la conexión (docs/275).
  const [queued, setQueued] = useState(0)
  const flushing = useRef(false)
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  useEffect(() => {
    ensureRecipesLoaded(businessId).then(() => setRecipes(getRecipes(businessId)))
    ensureMenusLoaded(businessId).then(() => setMenus(getMenus(businessId)))
    ensureSalesImportsLoaded(businessId).catch(() => {})
  }, [businessId])

  const reload = useCallback(async () => {
    if (busy.current > 0) return
    try {
      const fresh = await fetchPosData(businessId)
      if (busy.current > 0) return
      setLoadError(false)
      const queue = readQueue(businessId)
      setQueued(Object.keys(queue).length)
      setData({ ...fresh, orders: overlayQueued(fresh.orders, queue) })
    } catch (error) {
      console.error("[salon] No se pudo leer:", error)
      setLoadError(true)
    }
  }, [businessId])

  useEffect(() => {
    if (!canAccess) return
    reload()
    const id = setInterval(() => {
      if (document.visibilityState === "visible") reload()
    }, POLL_MS)
    const onVis = () => document.visibilityState === "visible" && reload()
    document.addEventListener("visibilitychange", onVis)
    return () => {
      clearInterval(id)
      document.removeEventListener("visibilitychange", onVis)
    }
  }, [canAccess, reload])

  // Primera vez: se guarda un plano de inicio para que todos los aparatos usen las mismas mesas.
  useEffect(() => {
    if (!data || data.missingTable || data.floor) return
    const plan = defaultFloorPlan(t("ventas_channel_dine_in"), uuidv4)
    setData({ ...data, floor: plan })
    saveFloorPlan(plan, businessId).catch((e) => console.error("[salon] plano inicial:", e))
  }, [data, businessId, t])

  const floor = data?.floor ?? null
  const config = data?.config ?? emptyConfig()
  const orders = data?.orders ?? []
  const area = floor?.areas.find((a) => a.id === areaId) ?? floor?.areas[0] ?? null
  const areaTables = useMemo(() => (floor && area ? floor.tables.filter((tb) => tb.areaId === area.id) : []), [floor, area])
  const byTable = useMemo(() => new Map(orders.filter((o) => o.tableId).map((o) => [o.tableId as string, o])), [orders])
  const takeaways = orders.filter((o) => !o.tableId)
  // Resumen del servicio y avisos de las pestañas (docs/273).
  const summary = useMemo(() => serviceSummary(areaTables, byTable, takeaways), [areaTables, byTable, takeaways])
  const kitchenWaiting = useMemo(() => kitchenQueue(orders).filter((g) => g.items.some((i) => i.status === "sent")).length, [orders])
  const readyTables = useMemo(() => orders.filter((o) => o.items.some((i) => i.status === "ready")).length, [orders])

  // Cartas del POS (docs/271): cada menú creado y «Mis Recetas».
  const cartas = useMemo(
    () =>
      buildCartas(menus, recipes, {
        recipes: t("pos_carta_all_recipes"),
        other: t("pos_category_other"),
        wholeMenu: t("pos_carta_whole_menu"),
        classification: (c) => getClassificationLabel(c as never, language),
      }),
    [recipes, menus, t, language],
  )

  // ---------- pedido abierto ----------
  const openTable = floor?.tables.find((tb) => tb.id === openKey) ?? null
  const openOrder: PosOrder | null = openKey ? (byTable.get(openKey) ?? orders.find((o) => o.id === openKey) ?? (draft && (draft.tableId === openKey || draft.id === openKey) ? draft : null)) : null
  const openSeats = openTable?.seats ?? 0

  const newOrder = (tableId: string | null, label: string, areaName: string | null, channel: PosOrder["channel"]): PosOrder => {
    const now = new Date().toISOString()
    // El mesero del aparato se recuerda (docs/273): no hay que escribirlo en cada mesa.
    let waiter: string | null = null
    try {
      waiter = localStorage.getItem(WAITER_KEY) || null
    } catch {}
    return { id: uuidv4(), tableId, tableLabel: label, areaName, channel, guests: null, waiter, openedAt: now, status: "open", items: [], updatedAt: now }
  }

  /**
   * Guarda con versión (docs/275): si otro aparato cambió la mesa en el medio, se juntan los dos
   * cambios (`mergeOrderEdit`) y se vuelve a intentar. Devuelve null si el pedido ya no existe
   * (se cobró o se liberó en otro aparato).
   */
  const saveWithMerge = async (base: PosOrder | null, mine: PosOrder): Promise<{ saved: PosOrder | null; merged: boolean }> => {
    let candidate = mine
    let fromRev: number | null = base ? base.rev ?? null : null
    let merged = false
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        return { saved: await savePosOrderVersioned(candidate, businessId, fromRev), merged }
      } catch (error) {
        if (!(error instanceof PosConflictError)) throw error
        const theirs = await fetchPosOrder(mine.id)
        if (!theirs) return { saved: null, merged }
        candidate = mergeOrderEdit(base, mine, theirs)
        fromRev = theirs.rev ?? null
        merged = true
      }
    }
    throw new PosConflictError()
  }

  const putOrderInState = (order: PosOrder, onlyIf?: PosOrder) =>
    setData((d) => {
      if (!d) return d
      const exists = d.orders.some((o) => o.id === order.id)
      if (onlyIf && exists && d.orders.find((o) => o.id === order.id) !== onlyIf) return d // ya hay un cambio más nuevo en pantalla
      return { ...d, orders: exists ? d.orders.map((o) => (o.id === order.id ? order : o)) : [...d.orders, order] }
    })

  /** Guarda un pedido (optimista): con versión, juntando cambios y con cola sin conexión. */
  const persistOrder = async (next: PosOrder) => {
    const base = data?.orders.find((o) => o.id === next.id) ?? null
    putOrderInState(next)
    setDraft(null)
    if (readQueue(businessId)[next.id]) {
      // Ya hay cambios sin guardar de esta mesa: este se suma a la cola y se guarda todo junto.
      enqueueOrder(businessId, base, next)
      void flushQueue()
      return
    }
    busy.current++
    try {
      const { saved, merged } = await saveWithMerge(base, next)
      if (!saved) {
        setData((d) => (d ? { ...d, orders: d.orders.filter((o) => o.id !== next.id) } : d))
        toast({ title: t("pos_order_gone_title"), description: t("pos_order_gone_desc") })
        return
      }
      putOrderInState(saved, next)
      if (merged) {
        putOrderInState(saved)
        toast({ title: t("pos_merged_title"), description: t("pos_merged_desc") })
      }
    } catch (error) {
      if (isConnectionError(error)) {
        enqueueOrder(businessId, base, next)
        setQueued(Object.keys(readQueue(businessId)).length)
      } else {
        console.error("[salon] No se pudo guardar el pedido:", error)
        toast({ title: t("pos_save_error"), variant: "destructive" })
      }
    } finally {
      busy.current--
    }
  }

  /** Guarda lo que quedó en cola al volver la conexión (docs/275). */
  const flushQueue = async () => {
    if (flushing.current) return
    flushing.current = true
    busy.current++
    try {
      for (const q of Object.values(readQueue(businessId))) {
        try {
          const { saved } = await saveWithMerge(q.base, q.mine)
          dequeueOrder(businessId, q.mine.id)
          if (!saved) toast({ title: t("pos_order_gone_title"), description: t("pos_order_gone_desc") })
        } catch (error) {
          if (isConnectionError(error)) break
          console.error("[salon] No se pudo guardar un cambio en cola:", error)
          dequeueOrder(businessId, q.mine.id)
          toast({ title: t("pos_save_error"), variant: "destructive" })
        }
      }
    } finally {
      busy.current--
      flushing.current = false
      setQueued(Object.keys(readQueue(businessId)).length)
      void reload()
    }
  }

  useEffect(() => {
    const onOnline = () => void flushQueue()
    window.addEventListener("online", onOnline)
    const id = setInterval(() => {
      if (Object.keys(readQueue(businessId)).length) void flushQueue()
    }, 15000)
    return () => {
      window.removeEventListener("online", onOnline)
      clearInterval(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId])

  const removeOrder = async (id: string) => {
    busy.current++
    setData((d) => (d ? { ...d, orders: d.orders.filter((o) => o.id !== id) } : d))
    try {
      await deletePosOrder(id)
    } catch (error) {
      console.error("[salon] No se pudo liberar:", error)
      toast({ title: t("pos_save_error"), variant: "destructive" })
    } finally {
      busy.current--
    }
  }

  const ensureOrder = (): PosOrder | null => {
    if (openOrder) return openOrder
    if (!openTable) return null
    return newOrder(openTable.id, t("ventas_ticket_table_label").replace("{table}", openTable.label), area?.name ?? null, "dine_in")
  }

  const onSelectTable = (tableId: string) => {
    setOpenKey(tableId)
    setSeat(1)
    setDraft(null)
  }

  const addTakeaway = () => {
    const n = takeaways.length + 1
    const order = newOrder(null, `${t("ventas_channel_takeaway")} ${n}`, null, "takeaway")
    setDraft(order)
    setOpenKey(order.id)
    setSeat(0)
  }

  const onAddDish = (s: PosSellable, quantity: number, extras: PosOrderExtra[], note: string | null) => {
    const order = ensureOrder()
    if (!order) return
    const next = addOrderItem(order, {
      id: uuidv4(),
      sourceType: s.sourceType,
      refId: s.refId,
      name: s.name,
      seat: seat === 0 ? null : seat,
      quantity,
      unitPrice: s.price,
      unitCost: s.cost,
      extras,
      note,
      status: "new",
      sentAt: null,
      readyAt: null,
    })
    persistOrder(next)
    // La carta queda abierta para seguir pidiendo; ella misma avisa lo agregado (docs/273).
  }

  const onCheckout = async (pay: PosPayment) => {
    if (!openOrder) return
    if (readQueue(businessId)[openOrder.id]) {
      // Con cambios sin guardar, primero se guardan: se cobra lo que de verdad está en la mesa.
      toast({ title: t("pos_checkout_wait_sync_title"), description: t("pos_checkout_wait_sync_desc"), variant: "destructive" })
      void flushQueue()
      return
    }
    setSaving(true)
    busy.current++
    try {
      const order = openOrder
      const today = toIsoDate(new Date())
      const dayStart = new Date(`${today}T00:00:00`)
      const isoDate = dayStart.toISOString()
      // Id fijo por versión del pedido: un cobro repetido no suma la venta dos veces (docs/275).
      const sale = buildPosSale(order, pay, recipes, isoDate, posTicketId(order))
      const newDayId = `pos-day-${businessId || "main"}-${today}`
      const { already } = await savePosSaleToDay(
        businessId,
        (list) => list.find((imp) => imp.source === "manual" && !!imp.periodStart && toIsoDate(new Date(imp.periodStart)) === today) ?? null,
        (day) => mergeSaleIntoDay(day, sale, { id: newDayId, businessId, isoDate, fileName: `${t("manual_sales_entry_label")} — ${formatDate(dayStart)}` }),
        newDayId,
      )
      const charged = sale.lines.reduce((s, l) => s + l.revenue, 0) + pay.tip
      if (sale.remaining.length) await persistOrder({ ...order, items: sale.remaining, voids: [], status: "open", updatedAt: new Date().toISOString() })
      else {
        await removeOrder(order.id)
        setOpenKey(null)
      }
      setCheckoutOpen(false)
      toast(
        already
          ? { title: t("pos_paid_already_title"), description: t("pos_paid_already_desc") }
          : { title: t("pos_paid_toast").replace("{total}", formatCurrency(charged)), description: t("pos_paid_toast_desc") },
      )
    } catch (error) {
      console.error("[salon] No se pudo cobrar:", error)
      toast({ title: t("pos_checkout_error"), description: t("pos_checkout_error_safe"), variant: "destructive" })
    } finally {
      busy.current--
      setSaving(false)
    }
  }

  const onKitchenStatus = (orderId: string, itemId: string, status: "sent" | "ready") => {
    const order = orders.find((o) => o.id === orderId)
    if (order) persistOrder(setItemStatus(order, itemId, status))
  }

  // ---------- ajustes (se guardan medio segundo después del último cambio) ----------
  const debounced = (key: string, fn: () => Promise<void>) => {
    if (timers.current[key]) clearTimeout(timers.current[key])
    else busy.current++
    timers.current[key] = setTimeout(async () => {
      delete timers.current[key]
      try {
        await fn()
      } catch (error) {
        console.error("[salon] No se pudieron guardar los ajustes:", error)
        toast({ title: t("pos_save_error"), variant: "destructive" })
      } finally {
        busy.current = Math.max(0, busy.current - 1)
      }
    }, 600)
  }
  const onPlan = (plan: FloorPlan) => {
    setData((d) => (d ? { ...d, floor: plan } : d))
    debounced("floor", () => saveFloorPlan(plan, businessId))
  }
  const onConfig = (next: PosConfig) => {
    setData((d) => (d ? { ...d, config: next } : d))
    debounced("config", () => savePosConfig(next, businessId))
  }

  const seatLabel = seat === 0 ? t("pos_seat_table") : t("pos_seat_n").replace("{n}", String(seat))

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <div className="flex-1 overflow-hidden">
          <div className="h-full overflow-y-auto">
            <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 space-y-6">
              <div className="flex items-center gap-2 md:gap-4" data-tour="salon-header">
                <Link href={!legacy ? `/business/${businessId}` : "/dashboard"}>
                  <Button variant="outline" size="sm" className="gap-2 hover:bg-accent bg-transparent">
                    <ArrowLeft className="h-4 w-4" />
                    <span className="hidden sm:inline">{t("mi_plan_back_to_dashboard")}</span>
                  </Button>
                </Link>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-chart-6/10 rounded-lg flex items-center justify-center">
                    <Armchair className="h-6 w-6 text-chart-6" />
                  </div>
                  <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-foreground">{t("nav_salon")}</h1>
                    <p className="text-sm md:text-base text-muted-foreground">
                      {legacy ? t("pos_legacy_space") : currentBusiness ? t("pos_working_in").replace("{name}", currentBusiness.name) : t("nav_salon_desc")}
                    </p>
                  </div>
                </div>
              </div>

              {(legacy || businesses.length > 1) && (
                <div className="flex flex-wrap items-center gap-2">
                  {legacy && <p className="flex-1 text-sm text-warning">{t("pos_legacy_banner")}</p>}
                  <Link href="/salon">
                    <Button size="sm" variant="outline" className="gap-2">
                      <Building2 className="h-3.5 w-3.5" />
                      {t("pos_change_business")}
                    </Button>
                  </Link>
                </div>
              )}

              {queued > 0 && (
                <div role="status" className="flex flex-col gap-2 rounded-lg border border-warning/40 bg-warning-soft p-3 text-sm text-warning sm:flex-row sm:items-center sm:justify-between">
                  <span className="flex items-center gap-2">
                    <WifiOff className="h-4 w-4 shrink-0" />
                    {t("pos_queue_banner").replace("{n}", String(queued))}
                  </span>
                  <Button size="sm" variant="outline" className="gap-2 self-start sm:self-auto" onClick={() => void flushQueue()}>
                    <RefreshCw className="h-3.5 w-3.5" />
                    {t("pos_queue_retry")}
                  </Button>
                </div>
              )}

              {data?.missingTable ? (
                <Card>
                  <CardContent className="py-10 text-center space-y-2">
                    <p className="font-medium">{t("pos_not_ready_title")}</p>
                    <p className="text-sm text-muted-foreground">{t("pos_not_ready_desc")}</p>
                  </CardContent>
                </Card>
              ) : !data || !floor ? (
                <Card>
                  <CardContent className="py-10 text-center text-sm text-muted-foreground">{loadError ? t("pos_load_error") : t("pos_loading")}</CardContent>
                </Card>
              ) : (
                <Tabs defaultValue="salon" className="w-full">
                  <TabsList className="bg-card border border-border">
                    <TabsTrigger id="salon-tab-salon" value="salon" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                      <LayoutGrid className="h-4 w-4" />
                      {t("pos_tab_floor")}
                      {readyTables > 0 && <TabBadge tone="success" n={readyTables} label={t("pos_badge_ready").replace("{n}", String(readyTables))} />}
                    </TabsTrigger>
                    <TabsTrigger id="salon-tab-cocina" value="cocina" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                      <ChefHat className="h-4 w-4" />
                      {t("pos_tab_kitchen")}
                      {kitchenWaiting > 0 && <TabBadge tone="info" n={kitchenWaiting} label={t("pos_badge_kitchen").replace("{n}", String(kitchenWaiting))} />}
                    </TabsTrigger>
                    <TabsTrigger id="salon-tab-ajustes" value="ajustes" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                      <Settings2 className="h-4 w-4" />
                      {t("pos_tab_settings")}
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="salon" className="space-y-4 mt-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap gap-2">
                        {floor.areas.map((a) => (
                          <Button key={a.id} size="sm" variant={a.id === area?.id ? "default" : "outline"} onClick={() => setAreaId(a.id)}>
                            {a.name}
                          </Button>
                        ))}
                      </div>
                      <Button size="sm" variant="outline" className="gap-2" onClick={addTakeaway} data-tour="salon-takeaway">
                        <ShoppingBag className="h-4 w-4" />
                        {t("pos_new_takeaway")}
                      </Button>
                    </div>
                    {takeaways.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {takeaways.map((o) => (
                          <Button key={o.id} size="sm" variant="secondary" onClick={() => { setOpenKey(o.id); setSeat(0) }} className="gap-2">
                            {o.tableLabel}
                            <span className="tabular-nums text-muted-foreground">{formatCurrency(orderTotal(o))}</span>
                          </Button>
                        ))}
                      </div>
                    )}
                    {areaTables.length > 0 && (
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5" data-tour="salon-summary">
                        {(["free", "busy", "ready", "bill"] as const).map((s) => (
                          <div key={s} className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${SUMMARY_STYLE[s]}`}>
                            <span className={`h-3 w-3 shrink-0 rounded-sm border ${SUMMARY_DOT[s]}`} />
                            <span className="min-w-0 flex-1 truncate text-xs">{t(`pos_status_${s}` as "pos_status_free")}</span>
                            <span className="text-base font-semibold tabular-nums">{summary[s]}</span>
                          </div>
                        ))}
                        <div className="col-span-2 flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2 sm:col-span-1">
                          <span className="text-xs text-muted-foreground">{t("pos_summary_open_total")}</span>
                          <span className="text-base font-semibold tabular-nums">{formatCurrency(summary.openTotal)}</span>
                        </div>
                      </div>
                    )}
                    <div data-tour="salon-map">
                      {areaTables.length === 0 ? (
                        <Card>
                          <CardContent className="py-10 text-center text-sm text-muted-foreground">{t("pos_area_empty")}</CardContent>
                        </Card>
                      ) : (
                        <FloorMap tables={areaTables} orders={byTable} mode="service" selectedId={openKey} onSelect={onSelectTable} showLegend={false} />
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="cocina" className="mt-4" data-tour="salon-kitchen-tab">
                    <KitchenBoard orders={orders} onStatus={onKitchenStatus} />
                  </TabsContent>

                  <TabsContent value="ajustes" className="mt-4" data-tour="salon-settings">
                    <PosSettings
                      plan={floor}
                      config={config}
                      recipes={recipes.filter((r) => !!r.id)}
                      areaId={area?.id ?? floor.areas[0]?.id}
                      onArea={setAreaId}
                      onPlan={onPlan}
                      onConfig={onConfig}
                      mainFloor={!legacy ? mainPos?.floor ?? null : null}
                      mainExtras={!legacy ? mainPos?.config?.extras ?? [] : []}
                    />
                  </TabsContent>
                </Tabs>
              )}
              {floor && <SalonTour />}
            </div>
          </div>
        </div>
      </div>

      <OrderPanel
        open={!!openKey && (!!openTable || !!openOrder)}
        onOpenChange={(o) => {
          if (!o) {
            setOpenKey(null)
            setDraft(null)
          }
        }}
        title={openTable ? t("ventas_ticket_table_label").replace("{table}", openTable.label) : (openOrder?.tableLabel ?? "")}
        subtitle={openTable ? (area?.name ?? null) : null}
        seats={openSeats}
        order={openOrder}
        seat={seat}
        onSeat={setSeat}
        onAddDish={() => setPickerOpen(true)}
        onQuantity={(itemId, q) => openOrder && persistOrder(setItemQuantity(openOrder, itemId, q))}
        onServed={(itemId) => openOrder && persistOrder(setItemStatus(openOrder, itemId, "served"))}
        onVoid={(itemId: string, reason: PosVoidReason) => openOrder && persistOrder(voidItem(openOrder, itemId, reason, recipes, uuidv4))}
        onPatch={(patch) => {
          if ("waiter" in patch) {
            try {
              if (patch.waiter) localStorage.setItem(WAITER_KEY, patch.waiter)
              else localStorage.removeItem(WAITER_KEY)
            } catch {}
          }
          const order = ensureOrder()
          if (order) persistOrder({ ...order, ...patch, updatedAt: new Date().toISOString() })
        }}
        onSend={() => {
          if (!openOrder) return
          persistOrder(sendToKitchen(openOrder))
          toast({ title: t("pos_sent_toast") })
        }}
        onBill={() => openOrder && persistOrder({ ...openOrder, status: "bill", updatedAt: new Date().toISOString() })}
        onCheckout={() => setCheckoutOpen(true)}
        onRelease={() => {
          if (openOrder) removeOrder(openOrder.id)
          setOpenKey(null)
        }}
      />

      <DishPicker open={pickerOpen} onOpenChange={setPickerOpen} cartas={cartas} config={config} seatLabel={seatLabel} onAdd={onAddDish} />
      <CheckoutDialog open={checkoutOpen} onOpenChange={setCheckoutOpen} order={openOrder} saving={saving} onConfirm={onCheckout} />
    </AuthGuard>
  )
}
