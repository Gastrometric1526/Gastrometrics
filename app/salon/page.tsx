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
import { ArrowLeft, Armchair, ChefHat, LayoutGrid, Settings2, ShoppingBag } from "lucide-react"
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
import { CheckoutDialog } from "@/components/pos/checkout-dialog"
import { KitchenBoard } from "@/components/pos/kitchen-board"
import { PosSettings } from "@/components/pos/pos-settings"
import { useToast } from "@/hooks/use-toast"
import { useLanguage } from "@/contexts/language-context"
import { useFeatureAccess, getAccessBlockReason } from "@/lib/plan-access"
import { getRecipes, ensureRecipesLoaded } from "@/lib/storage/recipes"
import { getMenus, ensureMenusLoaded } from "@/lib/menus"
import { getSalesImports, ensureSalesImportsLoaded, addSalesImport, updateSalesImport } from "@/lib/storage/sales-imports"
import { fetchPosData, saveFloorPlan, savePosConfig, savePosOrder, deletePosOrder, type PosData } from "@/lib/storage/pos"
import { toIsoDate, formatDate } from "@/lib/date-format"
import { formatCurrency } from "@/lib/currency"
import {
  addOrderItem,
  buildPosSale,
  defaultFloorPlan,
  emptyConfig,
  mergeSaleIntoDay,
  orderTotal,
  sendToKitchen,
  setItemQuantity,
  setItemStatus,
} from "@/lib/pos"
import type { FloorPlan, PosConfig, PosOrder, PosOrderExtra, PosPayment } from "@/types/pos"
import type { Recipe } from "@/types/recipe"
import type { Menu } from "@/lib/types/menus"

const POLL_MS = 5000

export default function SalonPage() {
  return (
    <Suspense fallback={null}>
      <SalonPageInner />
    </Suspense>
  )
}

function SalonPageInner() {
  const searchParams = useSearchParams()
  const businessId = searchParams.get("business") || "main"
  const { t } = useLanguage()
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
      setData(fresh)
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

  // Cartas del POS (docs/271): cada menú creado y «Mis Recetas».
  const cartas = useMemo(
    () => buildCartas(menus, recipes, { recipes: t("pos_carta_all_recipes"), other: t("pos_category_other"), wholeMenu: t("pos_carta_whole_menu") }),
    [recipes, menus, t],
  )

  // ---------- pedido abierto ----------
  const openTable = floor?.tables.find((tb) => tb.id === openKey) ?? null
  const openOrder: PosOrder | null = openKey ? (byTable.get(openKey) ?? orders.find((o) => o.id === openKey) ?? (draft && (draft.tableId === openKey || draft.id === openKey) ? draft : null)) : null
  const openSeats = openTable?.seats ?? 0

  const newOrder = (tableId: string | null, label: string, areaName: string | null, channel: PosOrder["channel"]): PosOrder => {
    const now = new Date().toISOString()
    return { id: uuidv4(), tableId, tableLabel: label, areaName, channel, guests: null, waiter: null, openedAt: now, status: "open", items: [], updatedAt: now }
  }

  /** Guarda un pedido (optimista) y relee después. */
  const persistOrder = async (order: PosOrder) => {
    busy.current++
    setData((d) => (d ? { ...d, orders: d.orders.some((o) => o.id === order.id) ? d.orders.map((o) => (o.id === order.id ? order : o)) : [...d.orders, order] } : d))
    setDraft(null)
    try {
      await savePosOrder(order, businessId)
    } catch (error) {
      console.error("[salon] No se pudo guardar el pedido:", error)
      toast({ title: t("pos_save_error"), variant: "destructive" })
    } finally {
      busy.current--
    }
  }

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
    setPickerOpen(false)
    toast({ title: t("pos_added_toast").replace("{dish}", s.name) })
  }

  const onCheckout = async (pay: PosPayment) => {
    if (!openOrder) return
    setSaving(true)
    busy.current++
    try {
      await ensureSalesImportsLoaded(businessId)
      const today = toIsoDate(new Date())
      const dayStart = new Date(`${today}T00:00:00`)
      const isoDate = dayStart.toISOString()
      const day = getSalesImports(businessId).find((imp) => imp.source === "manual" && !!imp.periodStart && toIsoDate(new Date(imp.periodStart)) === today) ?? null
      const sale = buildPosSale(openOrder, pay, recipes, isoDate, uuidv4())
      const merged = mergeSaleIntoDay(day, sale, { id: uuidv4(), businessId, isoDate, fileName: `${t("manual_sales_entry_label")} — ${formatDate(dayStart)}` })
      if (day) await updateSalesImport(merged, businessId)
      else await addSalesImport(merged, businessId)
      const charged = sale.lines.reduce((s, l) => s + l.revenue, 0) + pay.tip
      if (sale.remaining.length) await persistOrder({ ...openOrder, items: sale.remaining, status: "open", updatedAt: new Date().toISOString() })
      else {
        await removeOrder(openOrder.id)
        setOpenKey(null)
      }
      setCheckoutOpen(false)
      toast({ title: t("pos_paid_toast").replace("{total}", formatCurrency(charged)), description: t("pos_paid_toast_desc") })
    } catch (error) {
      console.error("[salon] No se pudo cobrar:", error)
      toast({ title: t("pos_checkout_error"), variant: "destructive" })
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

  if (canAccess === null) return null
  if (!canAccess) {
    return getAccessBlockReason("pos") === "admin" ? (
      <AdminRestrictedPage sectionName={t("nav_salon")} />
    ) : (
      <FeatureLockedPage feature="pos" title={t("pos_locked_title")} description={t("pos_locked_desc")} />
    )
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
                <Link href={businessId !== "main" ? `/business/${businessId}` : "/dashboard"}>
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
                    <p className="text-sm md:text-base text-muted-foreground">{t("nav_salon_desc")}</p>
                  </div>
                </div>
              </div>

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
                    </TabsTrigger>
                    <TabsTrigger id="salon-tab-cocina" value="cocina" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                      <ChefHat className="h-4 w-4" />
                      {t("pos_tab_kitchen")}
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
                    <div data-tour="salon-map">
                      {areaTables.length === 0 ? (
                        <Card>
                          <CardContent className="py-10 text-center text-sm text-muted-foreground">{t("pos_area_empty")}</CardContent>
                        </Card>
                      ) : (
                        <FloorMap tables={areaTables} orders={byTable} mode="service" selectedId={openKey} onSelect={onSelectTable} />
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
        onPatch={(patch) => {
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
