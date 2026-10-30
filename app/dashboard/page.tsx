"use client"
import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import type { Business } from "@/types/business"
import { calculateTotalMonthlyExpenses } from "@/types/business"
import { formatCurrency } from "@/lib/currency"
import {
  FileText,
  Database,
  ShoppingCart,
  UtensilsCrossed,
  Store,
  PlusCircle,
  BarChart,
  ChefHat,
  Users,
  DollarSign,
  Plus,
  ArrowRight,
  Package,
  Settings,
  Clock,
  Bell,
  Activity,
  Building2,
  Pencil,
  Receipt,
  Loader2,
  AlertTriangle,
  Tag,
  TrendingUp,
} from "lucide-react"
import { SettingsDialog } from "@/components/settings-dialog"
import { Sidebar } from "@/components/sidebar"
import { useTheme } from "next-themes"
import { ActivityTracker } from "@/lib/activity-tracker"
import { logActivity, getActivityLog, formatActivityEntry, type ActivityLogEntry } from "@/lib/services/activity-log"
import { usePlanStatus, planExpiryOf } from "@/lib/plan-status"
import { getPlanBySlug } from "@/lib/plans"
import { SUPPORT_OPEN_EVENT } from "@/components/support-chat"
import { useAuth } from "@/contexts/auth-context"
import { useLanguage } from "@/contexts/language-context"
import { AddBusinessDialog } from "@/components/add-business-dialog"
import { OnboardingTour } from "@/components/onboarding-tour"
import { WhatsNewDialog, WHATS_NEW_OPEN_EVENT } from "@/components/whats-new-dialog"
import { useModuleReveal } from "@/lib/module-reveal"
import { NotificationDetailDialog } from "@/components/notification-detail-dialog"
import { getRecentChangelog, changelogDate } from "@/lib/changelog"
import { PlanChangeNoticeDialog } from "@/components/plan-change-notice-dialog"
import { PlanTour } from "@/components/plan-tour"
import { GettingStartedPath } from "@/components/getting-started-path"
import { refreshPlanStatus } from "@/lib/plan-status"
import { useFeatureAccess, useActiveMembership, setCurrentPlanSlug, getMinimumPlanForFeature } from "@/lib/plan-access"
import type { FeatureKey } from "@/lib/plans"
import { Lock, Sparkles } from "lucide-react"
import { useNavigationItems } from "@/components/sidebar"
import { moduleCardStyle } from "@/lib/module-card-style"
import { AdminRestrictedPage } from "@/components/admin-restricted"
import { getAllBusinesses, refreshBusinesses } from "@/lib/storage/businesses"
import { getRecipes, ensureRecipesLoaded, isSubRecipe } from "@/lib/storage/recipes"
import { getIngredients, ensureIngredientsLoaded } from "@/lib/storage/ingredients"
import { ensureInventoryLoaded, getInventory } from "@/lib/storage/inventory"
import { getOrSeedExampleRecipe } from "@/lib/services/seed-example-recipe"
import { formatDate, formatDateTime } from "@/lib/date-format"
import { PublicReviews } from "@/components/public-reviews"
import { unitMarginPercent } from "@/lib/recipe-pricing"

export default function DashboardPage() {
  const { isLoggedIn, authChecked, user } = useAuth()
  const { t, language } = useLanguage()
  const canAccessTeam = useFeatureAccess("team")
  const canAccessManualSales = useFeatureAccess("manual_sales")
  // Mismo candado visual por plan que components/sidebar.tsx (ver ese archivo para el
  // porqué) — pedido explícito: las tarjetas grandes de "Acciones Rápidas" son lo
  // primero que ve un usuario nuevo en el tour del Dashboard, así que deben verse
  // "apagadas" igual que el ítem correspondiente del sidebar, no solo bloquearse
  // después de hacer clic y aterrizar en /inventario, /menus, etc.
  const canAccessInventory = useFeatureAccess("inventory")
  const canAccessMenus = useFeatureAccess("menus")
  const canAccessPurchaseOrdersManual = useFeatureAccess("purchase_orders_manual")
  const canAccessPurchaseOrdersAuto = useFeatureAccess("purchase_orders_auto")
  const canAccessStatsPanorama = useFeatureAccess("stats_panorama")
  const { active: previewActive, member: previewMember } = useActiveMembership()
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [currentTime, setCurrentTime] = useState(new Date())
  const [recentActivity, setRecentActivity] = useState<ActivityLogEntry[]>([])
  const [systemAlerts, setSystemAlerts] = useState<ActivityLogEntry[]>([])
  // Detalle de una notificación al tocarla (docs/208).
  const [notificationDetail, setNotificationDetail] = useState<ActivityLogEntry | null>(null)
  const [unreadNotifications, setUnreadNotifications] = useState(0)
  const [isSeedingExample, setIsSeedingExample] = useState(false)
  // "Qué hacer hoy" — se llena dentro de calculateCurrentStats (más abajo), no en un
  // efecto propio, para que se refresque gratis en cada uno de los puntos que ya
  // recalculan `stats` sin tener que tocar todos esos call sites por separado.
  const [actionItems, setActionItems] = useState<
    { id: string; count: number | null; label: string; href: string; icon: typeof AlertTriangle; tone: "critical" | "warn" | "info" | "ok" }[]
  >([])

  const router = useRouter()
  const moduleReveal = useModuleReveal()
  // Avisos en vivo de «Notificaciones» (docs/206): plan por vencer y respuesta del soporte.
  const planStatusLive = usePlanStatus()
  const planExpiryLive = planExpiryOf(planStatusLive)
  const [supportUnread, setSupportUnread] = useState(0)
  const { toast } = useToast()
  const { setTheme } = useTheme()

  // BUG CORREGIDO: estas tarjetas tenían un badge de "cambio" (+X% en verde/rojo)
  // que comparaba contra un snapshot en localStorage ("previousStats"). Ese snapshot
  // se resguardaba en un useEffect con dependencia en el propio `stats` (ver abajo),
  // así que se sobreescribía con los valores ACTUALES en el mismo instante en que se
  // acababan de calcular — nunca quedaba tiempo para que "anterior" y "actual"
  // difirieran de verdad. El badge terminaba mostrando "0%" siempre, sin importar
  // cuánto hubiera crecido el negocio. Se quita el badge en vez de intentar arreglar
  // el tracking: la app no tiene noción de "sesión anterior" o "ayer" en ningún otro
  // lado, así que cualquier fix real sería una función nueva, no una corrección.
  // Suma recetas/ingredientes de "main" + todos los negocios reales de la cuenta (ver
  // docs/52) — antes leía las claves planas "recipes"/"ingredients" de localStorage,
  // que ya no existen desde que estos módulos se movieron a Supabase (cada negocio
  // tiene su propia caché, no hay una sola clave global).
  const calculateCurrentStats = useCallback(async () => {
    await refreshBusinesses()
    const realBusinesses = getAllBusinesses()
    const businessIds = [null, ...realBusinesses.map((b) => b.id)]

    await Promise.all(
      businessIds.flatMap((id) => [ensureRecipesLoaded(id), ensureIngredientsLoaded(id), ensureInventoryLoaded(id)]),
    )

    const allRecipes = businessIds.flatMap((id) => getRecipes(id))
    const allIngredients = businessIds.flatMap((id) => getIngredients(id))
    const allInventory = businessIds.flatMap((id) => getInventory(id))

    let totalCost = 0
    let recipeCount = 0

    allRecipes.forEach((recipe) => {
      if (recipe.totalCost && recipe.totalCost > 0) {
        totalCost += recipe.totalCost
        recipeCount++
      }
    })

    const averageCost = recipeCount > 0 ? totalCost / recipeCount : 0

    // "Qué hacer hoy" — tres señales que sí se pueden calcular con lo que ya está
    // cargado en esta misma función, sin depender de ventas de POS importadas (esas
    // viven aparte, en Reportes → Finanzas, y requieren un negocio con importación
    // real; ver lib/sales-analytics.ts). Se calculan aquí (no en un efecto separado)
    // para que se refresquen gratis cada vez que algo ya llama a calculateCurrentStats,
    // sin tener que tocar cada uno de esos puntos de llamada (feedback de producto:
    // "el dashboard debe decir qué hacer hoy", no solo mostrar conteos genéricos).
    const lowStockCount = allInventory.filter((item) => item.status === "critical" || item.status === "low").length

    const sellableRecipes = allRecipes.filter((recipe) => !isSubRecipe(recipe))
    const recipesWithoutPriceCount = sellableRecipes.filter((recipe) => !(recipe.unitPrice && recipe.unitPrice > 0)).length

    const pricedRecipes = sellableRecipes.filter(
      (recipe) => recipe.unitPrice && recipe.unitPrice > 0 && recipe.yieldAmount && recipe.yieldAmount > 0,
    )
    const averageMargin =
      pricedRecipes.length > 0
        ? pricedRecipes.reduce((sum, recipe) => {
            // Mismo margen que la Ficha (venta sin ISV y menos comisión, docs/188); antes
            // contaba el ISV incluido en el precio como ganancia.
            const unitCost = (recipe.totalCost || 0) / (recipe.yieldAmount || 1)
            return sum + unitMarginPercent(recipe, recipe.unitPrice || 0, unitCost)
          }, 0) / pricedRecipes.length
        : null

    setActionItems([
      {
        id: "low-stock",
        count: lowStockCount,
        label:
          lowStockCount === 1
            ? t("dashboard_action_low_stock_one")
            : t("dashboard_action_low_stock_many").replace("{count}", String(lowStockCount)),
        href: "/inventario",
        icon: AlertTriangle,
        tone: lowStockCount > 0 ? "critical" : "ok",
      },
      {
        id: "no-price",
        count: recipesWithoutPriceCount,
        label:
          recipesWithoutPriceCount === 1
            ? t("dashboard_action_no_price_one")
            : t("dashboard_action_no_price_many").replace("{count}", String(recipesWithoutPriceCount)),
        href: "/mis-recetas",
        icon: Tag,
        tone: recipesWithoutPriceCount > 0 ? "warn" : "ok",
      },
      {
        id: "avg-margin",
        count: averageMargin,
        label:
          averageMargin === null
            ? t("dashboard_action_margin_empty")
            : t("dashboard_action_margin_value").replace("{percent}", averageMargin.toFixed(1)),
        href: "/estadisticas",
        icon: TrendingUp,
        tone: "info",
      },
    ])

    return [
      {
        title: t("stat_total_recipes"),
        value: allRecipes.length.toString(),
        icon: ChefHat,
        bgColor: "bg-chart-1/10",
        textColor: "text-chart-1",
      },
      {
        title: t("stat_ingredients"),
        value: allIngredients.length.toString(),
        icon: Package,
        bgColor: "bg-chart-2/10",
        textColor: "text-chart-2",
      },
      {
        title: t("stat_businesses"),
        value: realBusinesses.length.toString(),
        icon: Users,
        bgColor: "bg-chart-3/10",
        textColor: "text-chart-3",
      },
      {
        title: t("stat_avg_cost"),
        value: formatCurrency(averageCost > 0 ? averageCost : 0),
        icon: DollarSign,
        bgColor: "bg-chart-4/10",
        textColor: "text-chart-4",
      },
    ]
  }, [t])

  // Inicializa vacío para que esta página se pueda prerenderizar en el servidor durante
  // `next build` — el useEffect de abajo recalcula con los datos reales apenas monta en
  // el navegador, así que el usuario nunca ve este estado vacío en la práctica.
  const [stats, setStats] = useState<Awaited<ReturnType<typeof calculateCurrentStats>>>([])

  // Recalcula las tarjetas (incluye sus títulos traducidos) cuando cambia el idioma.
  useEffect(() => {
    let cancelled = false
    calculateCurrentStats().then((result) => {
      if (!cancelled) setStats(result)
    })
    return () => {
      cancelled = true
    }
  }, [calculateCurrentStats])

  useEffect(() => {
    if (!authChecked) return
    if (!isLoggedIn) {
      // BUG CORREGIDO (ver components/auth-guard.tsx y docs/51): con Supabase Auth real,
      // login() valida contraseña de verdad y ya no puede usarse como auto-login de
      // cuentas legacy — sin sesión real, la única opción es ir a /login.
      router.push("/login")
    }
  }, [isLoggedIn, authChecked, router])

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  // Vuelta desde Stripe Checkout (ver app/api/checkout/route.ts, success_url) — se lee
  // window.location.search directo en vez de useSearchParams() para no tener que envolver
  // esta página entera en <Suspense> (mismo gotcha documentado en app/signup/payment/page.tsx
  // y components/sidebar.tsx). El plan comprado YA quedó aplicado del lado del servidor
  // dentro de /api/checkout/session (ver ese archivo) — acá solo se pide esa misma
  // respuesta para reflejarlo al instante en el caché local (lib/plan-access.ts) y
  // mostrar el toast; ya no se confía en un ?plan= de la URL (editable por cualquiera,
  // ver docs/52). Se limpia la URL después para que un refresh no repita el toast.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get("checkout") !== "success") return
    const sessionId = params.get("session_id")
    if (sessionId) {
      fetch(`/api/checkout/session?session_id=${sessionId}`)
        .then((res) => res.json())
        .then((data) => {
          // Ya no se guarda customerId en localStorage (ver docs/61 — era un valor
          // legible/editable por cualquiera y compartido entre cuentas en el mismo
          // navegador). /api/checkout/session ya aplicó el plan y guardó el
          // stripe_customer_id real en account_plans; /api/stripe/portal lo lee de
          // ahí, con sesión real, cuando haga falta abrir el portal.
          if (data.planSlug) {
            setCurrentPlanSlug(data.planSlug)
            toast({
              title: t("dashboard_checkout_success_title"),
              description: t("dashboard_checkout_success_desc"),
            })
          } else if (data.scheduled) {
            // Pago programado al vencer el plan (docs/165): el plan todavía no cambia.
            toast({
              title: t("plan_expiry_scheduled_title"),
              description: t("dashboard_checkout_scheduled_desc"),
            })
            if (user?.id) refreshPlanStatus(user.id)
          }
        })
        .catch(() => {})
    }
    router.replace("/dashboard")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // BUG CORREGIDO: el saludo ("Buenos días, {nombre}") leía localStorage["userProfile"]/
  // ["username"], claves de antes de la migración a Supabase que el AuthProvider real
  // (contexts/auth-context.tsx) nunca vuelve a escribir — por eso siempre caía al
  // literal "Usuario". El nombre real ya vive en `user.name` (useAuth()), sincronizado
  // desde `profiles.full_name` en cada login y en cada cambio de perfil — se usa
  // directo más abajo, sin este estado local duplicado.
  useEffect(() => {
    // BUG CORREGIDO (ver docs/52): leer localStorage["businesses"] aquí Y volver a
    // agregar la fila nueva a mano en handleBusinessCreated de abajo duplicaba el
    // negocio recién creado — lib/storage/businesses.ts ya lo agrega a su caché
    // (y refleja el espejo en localStorage) antes de que este callback se entere.
    // getAllBusinesses() lee esa misma caché, ya sin duplicados.
    refreshBusinesses().then(() => setBusinesses(getAllBusinesses()))

    // Load real user activity and alerts
    loadUserActivity()
    loadSystemAlerts()

    // Listen for real-time updates
    const handleActivityUpdate = (event: CustomEvent) => {
      console.log("Activity updated:", event.detail)
      loadUserActivity()
    }

    const handleAlertsUpdate = (event: CustomEvent) => {
      console.log("Alerts updated:", event.detail)
      loadSystemAlerts()
    }

    const handleIngredientsUpdate = (event: CustomEvent) => {
      console.log("Ingredients updated:", event.detail)
      calculateCurrentStats().then(setStats)
      setTimeout(() => {
        loadUserActivity()
        loadSystemAlerts()
      }, 100)
    }

    const handleDataReset = () => {
      // Reload all data after reset
      setBusinesses([])
      calculateCurrentStats().then(setStats)
      loadUserActivity()
      loadSystemAlerts()
    }

    window.addEventListener("recipesUpdated", handleRecipesUpdate as EventListener)
    window.addEventListener("businessUpdated", handleBusinessUpdate as EventListener)
    window.addEventListener("activityUpdated", handleActivityUpdate as EventListener)
    window.addEventListener("alertsUpdated", handleAlertsUpdate as EventListener)
    window.addEventListener("ingredientsUpdated", handleIngredientsUpdate as EventListener)
    window.addEventListener("dataReset", handleDataReset as EventListener)

    return () => {
      window.removeEventListener("recipesUpdated", handleRecipesUpdate as EventListener)
      window.removeEventListener("businessUpdated", handleBusinessUpdate as EventListener)
      window.removeEventListener("activityUpdated", handleActivityUpdate as EventListener)
      window.removeEventListener("alertsUpdated", handleAlertsUpdate as EventListener)
      window.removeEventListener("ingredientsUpdated", handleIngredientsUpdate as EventListener)
      window.removeEventListener("dataReset", handleDataReset as EventListener)
    }
  }, [])

  // loadUserActivity/loadSystemAlerts (más abajo) necesitan user.id, que todavía puede
  // ser null en el primer render (useAuth resuelve la sesión async) — el efecto de
  // arriba ya corrió loadUserActivity()/loadSystemAlerts() una vez con deps [], así que
  // sin este segundo efecto esa carga inicial se quedaría vacía en silencio cuando el
  // usuario tarda en resolverse.
  useEffect(() => {
    loadUserActivity()
    loadSystemAlerts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  // Reemplaza lib/activity-tracker.ts (localStorage, aislado por navegador) por el log
  // real de supabase/migrations/0017_activity_log.sql (ver docs/87) — ahora "Actividad
  // reciente" y "Notificaciones" muestran lo que hizo cualquier persona con acceso al
  // negocio (dueño o invitado de equipo), no solo lo que hizo esta sesión.
  useEffect(() => {
    if (!user) return
    fetch("/api/support", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setSupportUnread(Number(d?.conversation?.user_unread) || 0))
      .catch(() => {})
  }, [user])

  const liveAlerts: { key: string; text: string; onClick: () => void }[] = [
    ...(supportUnread > 0
      ? [{ key: "support", text: t("notif_support_reply"), onClick: () => window.dispatchEvent(new CustomEvent(SUPPORT_OPEN_EVENT, { detail: { tab: "chat" } })) }]
      : []),
    ...(planExpiryLive && planExpiryLive.daysLeft <= 7
      ? [
          {
            key: "plan",
            text: (planExpiryLive.daysLeft === 0 ? t("notif_plan_today") : planExpiryLive.daysLeft === 1 ? t("notif_plan_one_day") : t("notif_plan_days").replace("{days}", String(planExpiryLive.daysLeft))).replace(
              "{plan}",
              getPlanBySlug(planStatusLive?.planSlug ?? "").name,
            ),
            onClick: () => router.push("/mi-plan"),
          },
        ]
      : []),
  ]
  // Novedades de los últimos 30 días (docs/208): al tocarlas se reabre su ventana con «Ver el tutorial».
  const newsAlerts = getRecentChangelog().map((entry) => ({
    key: `news-${entry.version}`,
    text: t("notif_news").replace("{title}", (entry.content[language] || entry.content.es).title),
    date: changelogDate(entry.version),
    onClick: () => window.dispatchEvent(new CustomEvent(WHATS_NEW_OPEN_EVENT, { detail: { version: entry.version } })),
  }))

  const loadUserActivity = async () => {
    if (!user) return
    try {
      const storedBusinesses = JSON.parse(localStorage.getItem("businesses") || "[]") as Business[]
      const businessIds = storedBusinesses.map((b) => b.id)
      const activities = await getActivityLog({ businessIds, includeGlobalForUserId: user.id, limit: 10 })
      setRecentActivity(activities)
    } catch (error) {
      console.error("Error loading user activity:", error)
    }
  }

  // Mismos eventos que loadUserActivity, filtrados a is_notification=true (creado/
  // guardado/activado-desactivado merma/importado, etc.) — no "entró a un módulo".
  const loadSystemAlerts = async () => {
    if (!user) return
    try {
      const storedBusinesses = JSON.parse(localStorage.getItem("businesses") || "[]") as Business[]
      const businessIds = storedBusinesses.map((b) => b.id)
      // Se ordena más nueva primero para quedarse con las 5 más recientes, y recién
      // después se invierte — así la más nueva queda al final de la lista (abajo),
      // pedido explícito, en vez del orden más común de "más nueva arriba".
      const alerts = await getActivityLog({ businessIds, includeGlobalForUserId: user.id, notificationsOnly: true, limit: 5 })
      const reversed = alerts.reverse()
      setSystemAlerts(reversed)

      // Sin estado de "leído" cruzado entre usuarios (requeriría una tabla de unión
      // aparte, ver docs/87) — el badge de "no leídas" usa una marca de agua simple
      // por dispositivo: cuántas notificaciones son más nuevas que la última vez que
      // este navegador cargó el dashboard.
      const watermarkKey = `activity_notifications_seen_${user.id}`
      const lastSeenAt = localStorage.getItem(watermarkKey)
      setUnreadNotifications(lastSeenAt ? reversed.filter((a) => a.createdAt > lastSeenAt).length : reversed.length)
      localStorage.setItem(watermarkKey, new Date().toISOString())
    } catch (error) {
      console.error("Error loading system alerts:", error)
    }
  }

  const handleBusinessCreated = useCallback(
    (newBusiness: Business) => {
      // add-business-dialog.tsx ya esperó a que addBusiness() terminara (Supabase +
      // caché + espejo en localStorage) antes de llamar a este callback — getAllBusinesses()
      // ya incluye el negocio nuevo, sin necesidad (ni riesgo de duplicar) de agregarlo
      // a mano aquí.
      setBusinesses(getAllBusinesses())

      // Track activity
      ActivityTracker.addActivity(
        t("dashboard_activity_business_created").replace("{name}", newBusiness.name),
        "business",
        newBusiness.id,
        {
          hasFinancialData: newBusiness.hasCustomizedCosts,
          estimatedMonthlyPlates: newBusiness.estimatedMonthlyPlates,
        },
      )

      ActivityTracker.addAlert(
        "success",
        t("dashboard_business_created_title"),
        t("dashboard_alert_business_created_desc").replace("{name}", newBusiness.name),
        newBusiness.id,
      )

      if (user) {
        logActivity({ user, businessId: newBusiness.id, module: "negocios", action: "created", entityLabel: newBusiness.name })
      }

      toast({
        title: t("dashboard_business_created_title"),
        description: t("dashboard_business_created_desc"),
      })

      // Force reload of activity and alerts
      setTimeout(() => {
        calculateCurrentStats().then(setStats)
        loadUserActivity()
        loadSystemAlerts()
      }, 100)
    },
    [toast, t],
  )

  const handleDeleteBusiness = useCallback(
    (businessId: string) => {
      const prevBusinesses = businesses
      setBusinesses((prev) => {
        const updated = prev.filter((b) => b.id !== businessId)
        localStorage.setItem("businesses", JSON.stringify(updated))
        window.dispatchEvent(new CustomEvent("businessUpdated", { detail: { action: "deleted", businessId } }))
        return updated
      })

      // Track activity with more details
      const businessToDelete = prevBusinesses.find((b) => b.id === businessId)
      if (businessToDelete) {
        ActivityTracker.addActivity(
          t("dashboard_activity_business_deleted").replace("{name}", businessToDelete.name),
          "business",
          undefined,
          {
            deletedBusinessId: businessToDelete.id,
            hadFinancialData: businessToDelete.hasFinancialData,
          },
        )

        ActivityTracker.addAlert(
          "warning",
          t("dashboard_business_deleted_title"),
          t("dashboard_alert_business_deleted_desc").replace("{name}", businessToDelete.name),
          undefined,
        )

        // business_id null a propósito: el negocio ya se está borrando, y activity_log
        // tiene "on delete cascade" en esa columna — si se guardara con el id del
        // negocio que se acaba de eliminar, este mismo registro se autoborraría.
        if (user) {
          logActivity({ user, businessId: null, module: "negocios", action: "deleted", entityLabel: businessToDelete.name })
        }
      }

      toast({
        title: t("dashboard_business_deleted_title"),
        description: t("dashboard_business_deleted_desc"),
      })

      // Force reload of activity and alerts
      setTimeout(() => {
        calculateCurrentStats().then(setStats)
        loadUserActivity()
        loadSystemAlerts()
      }, 100)
    },
    [toast, businesses, t],
  )

  // Acciones Rápidas = los mismos módulos del menú lateral, en el mismo orden, con el mismo
  // candado por plan y el mismo filtro de Vista previa de Equipo (docs/203). Antes era una
  // lista aparte escrita a mano y se quedaba atrás cada vez que el menú sumaba un módulo
  // (Equipo, Ventas, Negocios, Invita, MEP…).
  const navItems = useNavigationItems()
  const menuItems = navItems
    .filter((item) => item.href !== "/dashboard")
    .map((item) => ({
      href: item.href,
      text: item.title,
      icon: item.icon,
      description: item.description,
      ...moduleCardStyle(item.href),
      locked: item.locked,
      feature: item.feature,
    }))

  const handleBusinessClick = useCallback(
    (businessId: string) => {
      router.push(`/business/${businessId}`)
    },
    [router],
  )

  // Botón "Ver un ejemplo primero" del estado vacío — crea (o reutiliza, si ya existe)
  // el ingrediente + receta de ejemplo de esta cuenta y abre la receta ya en modo
  // edición, para que se vea el costo/margen calculado sin escribir nada primero. Ver
  // lib/services/seed-example-recipe.ts.
  const handleSeeExample = useCallback(async () => {
    if (!user) return
    setIsSeedingExample(true)
    try {
      const recipeId = await getOrSeedExampleRecipe(user.id, language)
      router.push(`/ficha-tecnica/${recipeId}?business=main&mode=edit`)
    } catch (error) {
      console.error("Error creando la receta de ejemplo:", error)
      toast({
        title: t("dashboard_empty_state_example_error_title"),
        description: t("dashboard_empty_state_example_error_desc"),
        variant: "destructive",
      })
      setIsSeedingExample(false)
    }
  }, [user, language, router, toast, t])

  const roundToNextHundred = (num: number) => {
    return Math.ceil(num / 100) * 100
  }

  const getGreeting = () => {
    const hour = currentTime.getHours()
    if (hour < 12) return t("greeting_morning")
    if (hour < 18) return t("greeting_afternoon")
    return t("greeting_evening")
  }

  const handleRecipesUpdate = useCallback(
    (event: CustomEvent) => {
      calculateCurrentStats().then(setStats)
      setTimeout(() => {
        loadUserActivity()
        loadSystemAlerts()
      }, 100)
    },
    [calculateCurrentStats],
  )

  const handleBusinessUpdate = useCallback(
    (event: CustomEvent) => {
      const storedBusinesses = JSON.parse(localStorage.getItem("businesses") || "[]")
      setBusinesses(storedBusinesses)
      calculateCurrentStats().then(setStats)
      setTimeout(() => {
        loadUserActivity()
        loadSystemAlerts()
      }, 100)
    },
    [calculateCurrentStats],
  )

  const handleIngredientsUpdate = useCallback(
    (event: CustomEvent) => {
      calculateCurrentStats().then(setStats)
      setTimeout(() => {
        loadUserActivity()
        loadSystemAlerts()
      }, 100)
    },
    [calculateCurrentStats],
  )

  const handleDataReset = useCallback(() => {
    setBusinesses([])
    calculateCurrentStats().then(setStats)
    loadUserActivity()
    loadSystemAlerts()
  }, [calculateCurrentStats])

  if (!isLoggedIn) {
    return null
  }

  // Vista previa de Equipo (ver /equipo, botón "Vista previa"): el dashboard principal
  // (todos los negocios a la vez) solo es visible para una persona invitada si su
  // acceso configurado es "Dashboard principal" — si es a un negocio específico, ni
  // siquiera debería poder aterrizar acá.
  if (previewActive && previewMember && previewMember.scope !== "dashboard") {
    return <AdminRestrictedPage sectionName={t("equipo_scope_dashboard_badge")} />
  }

  return (
    <div className="flex min-h-screen bg-background">
      <OnboardingTour />
      <WhatsNewDialog />
      <NotificationDetailDialog entry={notificationDetail} onClose={() => setNotificationDetail(null)} />
      <PlanChangeNoticeDialog />
      <PlanTour />
      <Sidebar />
      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto">
          <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 space-y-10">
            {/* Header Section */}
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
              <div className="space-y-1.5 flex-1 min-w-0" data-tour="dash-header">
                <h1 className="text-2xl md:text-3xl lg:text-[34px] font-semibold tracking-[-0.03em] text-foreground truncate flex items-center gap-2">
                  {getGreeting()}, {user?.name}
                  {/* BUG CORREGIDO: este lápiz abría un diálogo de edición de perfil
                      propio y separado (isProfileOpen), que guardaba en las claves
                      sueltas "username"/"email" en vez de en userProfile — un
                      segundo lugar para cambiar el correo que no pasaba por la
                      confirmación + contraseña actual que sí tiene Configuración
                      (components/settings-dialog.tsx), y que además podía dejar el
                      correo desincronizado entre ambos lugares. Ahora abre el mismo
                      diálogo de Configuración real, con el mismo candado. */}
                  <SettingsDialog
                    trigger={
                      <button
                        type="button"
                        className="shrink-0 text-text-4 hover:text-foreground transition-colors"
                        aria-label={t("dashboard_edit_profile_aria")}
                        title={t("dashboard_edit_profile_aria")}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    }
                  />
                </h1>
                <p className="text-base text-text-3">
                  {t("dashboard_welcome")}
                </p>
                <div className="flex items-center gap-2 text-sm text-text-4">
                  <Clock className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">{formatDateTime(currentTime)}</span>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0 flex-wrap">
                <Link href="/ficha-tecnica">
                  <Button data-tour="dash-new-recipe" className="bg-primary text-primary-foreground hover:bg-primary/90">
                    <Plus className="h-4 w-4 mr-2" />
                    {t("dashboard_new_recipe")}
                  </Button>
                </Link>
                <SettingsDialog
                  trigger={
                    <Button variant="outline" size="icon" className="h-10 w-10 flex-shrink-0">
                      <Settings className="h-4 w-4" />
                    </Button>
                  }
                />
              </div>
            </div>

            {/* Estado vacío / primer paso — cuenta sin ninguna receta ni ingrediente
                todavía (ver docs/96 y referencia-estrategia-crecimiento...: el tour
                ya explica el flujo de valor, pero un usuario que cierra el tour o
                vuelve días después aterrizaba en una grilla de KPIs en cero sin
                ningún camino obvio hacia adelante). Se calcula sobre `stats` (ya
                cargado desde Supabase) en vez de sobre datos crudos, así no hay
                parpadeo mientras stats sigue vacío en el primer render. */}
            {stats.length > 0 && Number(stats[0]?.value || 0) === 0 && Number(stats[1]?.value || 0) === 0 && (
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6 md:p-8">
                <div className="flex flex-col md:flex-row md:items-center gap-5">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <ChefHat className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <h2 className="text-xl md:text-2xl font-semibold tracking-[-0.02em] text-foreground">
                      {t("dashboard_empty_state_title")}
                    </h2>
                    <p className="text-base text-text-3 max-w-2xl">{t("dashboard_empty_state_desc")}</p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={handleSeeExample}
                      disabled={isSeedingExample}
                      className="w-full md:w-auto"
                    >
                      {isSeedingExample ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <ChefHat className="h-4 w-4 mr-2" />
                      )}
                      {t("dashboard_empty_state_example_cta")}
                    </Button>
                    <Link href="/ingredientes" className="shrink-0">
                      <Button size="lg" className="w-full md:w-auto bg-primary text-primary-foreground hover:bg-primary/90">
                        <Plus className="h-4 w-4 mr-2" />
                        {t("dashboard_empty_state_cta")}
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* "Qué hacer hoy" — a diferencia de los 4 KPIs de abajo (conteos
                generales, siempre neutros), estas tres tarjetas son accionables: cada
                una lleva directo a la pantalla donde se resuelve, y el tono de color
                refuerza (nunca sustituye, docs/06) lo que ya dice el texto. Se
                calculan dentro de calculateCurrentStats — ver el comentario ahí arriba
                sobre por qué, en vez de un efecto propio. */}
            {actionItems.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold uppercase tracking-[0.09em] text-text-4">
                  {t("dashboard_actions_heading")}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-hairline border border-hairline rounded-2xl overflow-hidden">
                  {actionItems.map((item) => {
                    const toneClasses =
                      item.tone === "critical"
                        ? "text-destructive"
                        : item.tone === "warn"
                          ? "text-warning"
                          : item.tone === "info"
                            ? "text-chart-1"
                            : "text-emerald-600"
                    const iconBg =
                      item.tone === "critical"
                        ? "bg-danger-soft"
                        : item.tone === "warn"
                          ? "bg-warning-soft"
                          : item.tone === "info"
                            ? "bg-chart-1/10"
                            : "bg-emerald-500/10"
                    return (
                      <Link
                        key={item.id}
                        href={item.href}
                        className="bg-card p-5 flex items-start gap-3 hover:bg-accent/40 transition-colors"
                      >
                        <span className={`flex-shrink-0 rounded-full p-2 ${iconBg}`}>
                          <item.icon className={`h-4 w-4 ${toneClasses}`} />
                        </span>
                        <span className="text-sm font-medium text-foreground leading-snug">{item.label}</span>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Tu camino (docs/145): pasos que van revelando los módulos. */}
            <GettingStartedPath />

            {/* Stats — sin cajas: etiqueta, cifra grande, separadas por hairline
                (docs/80/81/82: "cuatro KPIs sin cajas" del paquete de diseño). Mismos
                cuatro valores reales de siempre (calculateCurrentStats más arriba),
                solo cambia cómo se presentan. */}
            <div
              className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-hairline border-y border-hairline"
              data-tour="dash-stats"
            >
              {stats.map((stat, index) => (
                <div key={index} className="p-5 space-y-2">
                  <div className="flex items-center gap-2">
                    <stat.icon className={`h-4 w-4 ${stat.textColor}`} />
                    <p className="text-[10.5px] font-medium uppercase tracking-[0.09em] text-text-4 truncate">
                      {stat.title}
                    </p>
                  </div>
                  <p className="text-xl sm:text-3xl font-semibold text-foreground tabular-nums truncate">{stat.value}</p>
                </div>
              ))}
            </div>

            {/* Mis Negocios — rejilla de 1px (mismo patrón que los módulos del
                landing): celdas separadas por hairline, sin tarjetas con sombra. */}
            {businesses.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold tracking-[-0.02em] text-foreground">{t("dashboard_my_businesses")}</h2>
                  <Link href="/negocios">
                    <Button variant="outline" size="sm">
                      <Building2 className="h-4 w-4 mr-2" />
                      {t("dashboard_view_all")}
                    </Button>
                  </Link>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-px bg-hairline border border-hairline rounded-2xl overflow-hidden">
                  {businesses.slice(0, 6).map((business) => (
                    <div
                      key={business.id}
                      className="bg-card hover:bg-canvas-alt transition-colors duration-150 p-5 cursor-pointer"
                      onClick={() => handleBusinessClick(business.id)}
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 bg-primary-soft rounded-xl flex items-center justify-center flex-shrink-0">
                          <Building2 className="h-5 w-5 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-foreground truncate">{business.name}</h3>
                          <p className="text-xs text-text-4 truncate">
                            {t("dashboard_created_on")}{" "}
                            {formatDate(business.createdAt || Date.now())}
                          </p>
                        </div>
                        {business.hasFinancialData && (
                          <span className="text-[11.5px] font-medium px-2.5 py-1 rounded-full bg-success-soft text-success shrink-0">
                            {t("dashboard_complete")}
                          </span>
                        )}
                      </div>

                      {business.hasFinancialData && business.expenses && (
                        <div className="text-sm text-text-3 mb-2">
                          {t("dashboard_operational_cost")}: {formatCurrency(roundToNextHundred(calculateTotalMonthlyExpenses(business.expenses)))}
                        </div>
                      )}

                      <div className="flex items-center text-primary">
                        <span className="text-sm font-medium">{t("dashboard_open_dashboard")}</span>
                        <ArrowRight className="h-3.5 w-3.5 ml-1.5 flex-shrink-0" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Actions — botones grandes (vuelta atrás a pedido explícito del
                dueño del proyecto: la fila delgada con flecha, de la rejilla "Todo
                conectado..." del landing, quedaba demasiado chica/discreta para ser el
                acceso principal a Ficha Técnica/Ingredientes/etc. desde el Dashboard).
                Cada botón es su propia tarjeta cuadrada con el ícono grande arriba. */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <h2 className="text-xl font-semibold tracking-[-0.02em] text-foreground">{t("dashboard_quick_actions")}</h2>
                <Button onClick={() => setShowAddDialog(true)} data-tour="dash-add-business" size="sm" variant="outline">
                  <PlusCircle className="h-4 w-4 mr-2" />
                  {t("dashboard_add_business")}
                </Button>
              </div>

              <div
                className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4"
                data-tour="dash-quick-actions"
              >
                {menuItems.map((action, index) => {
                  if (action.locked) {
                    const minPlan = action.feature ? getMinimumPlanForFeature(action.feature) : null
                    return (
                      <button
                        key={index}
                        type="button"
                        aria-disabled="true"
                        onClick={() =>
                          toast({
                            title: t("sidebar_locked_feature_toast_title"),
                            description: minPlan
                              ? t("sidebar_locked_feature_toast_desc").replace("{plan}", minPlan.name)
                              : t("sidebar_locked_feature_toast_desc_generic"),
                          })
                        }
                        className="flex flex-col items-start gap-3 rounded-2xl border border-hairline bg-card p-5 opacity-60 hover:opacity-90 cursor-not-allowed text-left"
                      >
                        <div className={`w-12 h-12 rounded-xl ${action.bgColor} flex items-center justify-center shrink-0`}>
                          <action.icon className={`h-6 w-6 ${action.textColor}`} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                            {action.text}
                            <Lock className="h-3 w-3 flex-shrink-0" />
                          </p>
                          <p className="text-xs text-text-3 mt-1 line-clamp-2">
                            {minPlan
                              ? t("sidebar_locked_feature_hint").replace("{plan}", minPlan.name)
                              : t("sidebar_locked_feature_hint_generic")}
                          </p>
                        </div>
                      </button>
                    )
                  }

                  const isFresh = moduleReveal.fresh.has(action.href.split("?")[0])
                  return (
                  <Link
                    key={index}
                    href={action.href}
                    data-module-fresh={isFresh ? "" : undefined}
                    className={`group relative flex flex-col items-start gap-3 rounded-2xl border bg-card p-5 hover:border-primary/40 hover:shadow-sm transition-all ${isFresh ? "border-primary/50" : "border-hairline"}`}
                  >
                    {isFresh && (
                      <>
                        <span className="pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-primary/50 animate-pulse" aria-hidden="true" />
                        <span className="absolute right-3 top-3 rounded-full bg-primary px-1.5 py-px text-[10px] font-semibold text-primary-foreground">{t("sidebar_module_new")}</span>
                      </>
                    )}
                    <div className={`w-12 h-12 rounded-xl ${action.bgColor} flex items-center justify-center shrink-0`}>
                      <action.icon className={`h-6 w-6 ${action.textColor}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{action.text}</p>
                      <p className="text-xs text-text-3 mt-1 line-clamp-2">{action.description}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-text-4 shrink-0 mt-auto group-hover:translate-x-0.5 group-hover:text-primary transition-all" />
                  </Link>
                  )
                })}
              </div>
            </div>

            {/* Recent Activity & Alerts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Activity */}
              <Card className="border-hairline bg-card h-80 overflow-hidden" data-tour="dash-recent-activity">
                <CardHeader className="border-b border-hairline p-4">
                  <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Activity className="h-4 w-4 flex-shrink-0 text-text-4" />
                    <span className="truncate">{t("dashboard_recent_activity")}</span>
                  </CardTitle>
                  <p className="text-xs text-text-4">{t("dashboard_activity_card_desc")}</p>
                </CardHeader>
                <CardContent className="p-4 h-full overflow-y-auto">
                  {recentActivity.length > 0 ? (
                    <div className="divide-y divide-hairline">
                      {recentActivity.map((activity) => (
                        <div key={activity.id} className="flex items-start gap-3 py-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground line-clamp-2">
                              {formatActivityEntry(activity, t)}
                            </p>
                            <p className="text-xs text-text-4 mt-0.5">
                              {ActivityTracker.formatTimeAgo(activity.createdAt, t, language)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Activity className="h-10 w-10 text-text-4/50 mx-auto mb-3" />
                      <p className="text-sm text-text-3">{t("dashboard_no_activity")}</p>
                      <p className="text-xs text-text-4 mt-1">{t("dashboard_no_activity_desc")}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* System Alerts — el color ya no es la única señal: el texto de la
                  fila dice qué tipo de aviso es (docs/06: "el estado nunca se
                  comunica solo con color"). */}
              <Card className="border-hairline bg-card h-80 overflow-hidden" data-tour="dash-notifications">
                <CardHeader className="border-b border-hairline p-4">
                  <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Bell className="h-4 w-4 flex-shrink-0 text-text-4" />
                    <span className="truncate">{t("dashboard_notifications")}</span>
                    {unreadNotifications + liveAlerts.length > 0 && (
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-danger-soft text-destructive">
                        {unreadNotifications + liveAlerts.length}
                      </span>
                    )}
                  </CardTitle>
                  <p className="text-xs text-text-4">{t("dashboard_notifications_card_desc")}</p>
                </CardHeader>
                <CardContent className="p-4 h-full overflow-y-auto">
                  {systemAlerts.length + liveAlerts.length + newsAlerts.length > 0 ? (
                    <div className="divide-y divide-hairline">
                      {liveAlerts.map((a) => (
                        <button key={a.key} type="button" onClick={a.onClick} className="flex w-full items-start gap-3 py-3 text-left hover:bg-muted/40 rounded-md">
                          <span className="h-1.5 w-1.5 rounded-full shrink-0 mt-1.5 bg-primary" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground">{a.text}</p>
                            <p className="text-xs text-text-4 mt-0.5">{t("dashboard_notifications_now")}</p>
                          </div>
                        </button>
                      ))}
                      {systemAlerts.map((alert) => (
                        <button
                          key={alert.id}
                          type="button"
                          onClick={() => setNotificationDetail(alert)}
                          className="flex w-full items-start gap-3 py-3 text-left hover:bg-muted/40 rounded-md"
                        >
                          <span className="h-1.5 w-1.5 rounded-full shrink-0 mt-1.5 bg-text-4/60" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground">{formatActivityEntry(alert, t)}</p>
                            <p className="text-xs text-text-4 mt-0.5">{ActivityTracker.formatTimeAgo(alert.createdAt, t, language)}</p>
                          </div>
                        </button>
                      ))}
                      {newsAlerts.map((a) => (
                        <button key={a.key} type="button" onClick={a.onClick} className="flex w-full items-start gap-3 py-3 text-left hover:bg-muted/40 rounded-md">
                          <Sparkles className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground">{a.text}</p>
                            <p className="text-xs text-text-4 mt-0.5">{formatDate(a.date)}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Bell className="h-10 w-10 text-text-4/50 mx-auto mb-3" />
                      <p className="text-sm text-text-3">{t("dashboard_no_notifications")}</p>
                      <p className="text-xs text-text-4 mt-1">{t("dashboard_no_notifications_desc")}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Opiniones de otros chefs (docs/173); solo con 3 o más publicadas. */}
            <PublicReviews variant="dashboard" max={3} />

            {/* Add Business Dialog */}
            <AddBusinessDialog
              open={showAddDialog}
              onOpenChange={setShowAddDialog}
              onBusinessAdded={handleBusinessCreated}
            />

            {/* Footer */}
            <div className="text-center py-6">
              <p className="text-sm text-text-4">
                {t("dashboard_feedback_question")}{" "}
                <Link href="/contacto" className="text-primary hover:text-primary/80 font-medium">
                  {t("dashboard_feedback_cta")}
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
