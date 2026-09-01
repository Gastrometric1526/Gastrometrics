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
} from "lucide-react"
import { SettingsDialog } from "@/components/settings-dialog"
import { Sidebar } from "@/components/sidebar"
import { useTheme } from "next-themes"
import { ActivityTracker } from "@/lib/activity-tracker"
import { logActivity, getActivityLog, formatActivityEntry, type ActivityLogEntry } from "@/lib/services/activity-log"
import { useAuth } from "@/contexts/auth-context"
import { useLanguage } from "@/contexts/language-context"
import { AddBusinessDialog } from "@/components/add-business-dialog"
import { OnboardingTour } from "@/components/onboarding-tour"
import { useFeatureAccess, useActiveMembership, setCurrentPlanSlug } from "@/lib/plan-access"
import { AdminRestrictedPage } from "@/components/admin-restricted"
import { getAllBusinesses, refreshBusinesses } from "@/lib/storage/businesses"
import { getRecipes, ensureRecipesLoaded } from "@/lib/storage/recipes"
import { getIngredients, ensureIngredientsLoaded } from "@/lib/storage/ingredients"

export default function DashboardPage() {
  const { isLoggedIn, authChecked, user } = useAuth()
  const { t } = useLanguage()
  const canAccessTeam = useFeatureAccess("team")
  const { active: previewActive, member: previewMember } = useActiveMembership()
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [currentTime, setCurrentTime] = useState(new Date())
  const [recentActivity, setRecentActivity] = useState<ActivityLogEntry[]>([])
  const [systemAlerts, setSystemAlerts] = useState<ActivityLogEntry[]>([])
  const [unreadNotifications, setUnreadNotifications] = useState(0)

  const router = useRouter()
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
      businessIds.flatMap((id) => [ensureRecipesLoaded(id), ensureIngredientsLoaded(id)]),
    )

    const allRecipes = businessIds.flatMap((id) => getRecipes(id))
    const allIngredients = businessIds.flatMap((id) => getIngredients(id))

    let totalCost = 0
    let recipeCount = 0

    allRecipes.forEach((recipe) => {
      if (recipe.totalCost && recipe.totalCost > 0) {
        totalCost += recipe.totalCost
        recipeCount++
      }
    })

    const averageCost = recipeCount > 0 ? totalCost / recipeCount : 0

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

  // Orden pensado como flujo de trabajo real: primero base de datos de ingredientes
  // y ficha tecnica (de donde nace todo lo demas), luego recetas guardadas, menus,
  // inventario, ordenes de compra (que ahora depende de menu+inventario, ver docs/31),
  // y estadisticas al final, como cierre de analisis.
  // BUG CORREGIDO: esta grilla de "Quick Actions" es una lista aparte de los items del
  // sidebar (components/sidebar.tsx) — cuando se agregó Equipo al sidebar no se agregó
  // acá, así que el panel de invitar/administrar equipo no aparecía en el dashboard
  // principal aunque sí estuviera accesible desde el menú lateral. Igual que en el
  // sidebar, solo se agrega si el plan de la cuenta incluye la función.
  const menuItems = [
    {
      href: "/ingredientes",
      text: t("nav_ingredientes"),
      icon: Database,
      description: t("nav_ingredientes_desc"),
      bgColor: "bg-chart-2/10 group-hover:bg-chart-2/20",
      textColor: "text-chart-2",
    },
    {
      href: "/ficha-tecnica",
      text: t("nav_ficha_tecnica"),
      icon: FileText,
      description: t("nav_ficha_tecnica_desc"),
      bgColor: "bg-chart-1/10 group-hover:bg-chart-1/20",
      textColor: "text-chart-1",
    },
    {
      href: "/mis-recetas",
      text: t("nav_mis_recetas"),
      icon: UtensilsCrossed,
      description: t("nav_mis_recetas_desc"),
      bgColor: "bg-chart-5/10 group-hover:bg-chart-5/20",
      textColor: "text-chart-5",
    },
    {
      href: "/menus",
      text: t("nav_menus"),
      icon: UtensilsCrossed,
      description: t("nav_menus_desc"),
      bgColor: "bg-chart-3/10 group-hover:bg-chart-3/20",
      textColor: "text-chart-3",
    },
    {
      href: "/inventario",
      text: t("nav_inventario"),
      icon: Store,
      description: t("nav_inventario_desc"),
      bgColor: "bg-chart-6/10 group-hover:bg-chart-6/20",
      textColor: "text-chart-6",
    },
    {
      href: "/ordenes-compra",
      text: t("nav_ordenes_compra"),
      icon: ShoppingCart,
      description: t("nav_ordenes_compra_desc"),
      bgColor: "bg-chart-4/10 group-hover:bg-chart-4/20",
      textColor: "text-chart-4",
    },
    {
      href: "/estadisticas",
      text: t("nav_estadisticas"),
      icon: BarChart,
      description: t("nav_estadisticas_desc"),
      bgColor: "bg-chart-7/10 group-hover:bg-chart-7/20",
      textColor: "text-chart-7",
    },
    ...(canAccessTeam
      ? [
          {
            href: "/equipo",
            text: t("nav_equipo"),
            icon: Users,
            description: t("nav_equipo_desc"),
            bgColor: "bg-chart-1/10 group-hover:bg-chart-1/20",
            textColor: "text-chart-1",
          },
        ]
      : []),
  ].filter((item) => {
    // BUG CORREGIDO: esta grilla tenía su propio filtrado por plan (canAccessTeam,
    // arriba) pero no sabía nada de una vista previa de Equipo activa — mostraba las
    // 8 tarjetas completas sin importar qué le habilitó el administrador a esta
    // persona, aunque el sidebar (al lado, en la misma pantalla) sí filtraba
    // correctamente. Mismo mapeo href→FeatureKey que components/sidebar.tsx.
    if (!previewActive || !previewMember) return true
    const hrefFeatureMap: Record<string, string[]> = {
      "/ficha-tecnica": ["recipes"],
      "/mis-recetas": ["recipes"],
      "/ingredientes": ["ingredients"],
      "/inventario": ["inventory"],
      "/menus": ["menus"],
      "/ordenes-compra": ["purchase_orders_manual", "purchase_orders_auto"],
      "/estadisticas": ["stats_panorama", "stats_finance"],
      // Delegable desde docs/75 — ver components/sidebar.tsx para el mismo mapeo.
      "/equipo": ["team"],
    }
    const required = hrefFeatureMap[item.href]
    if (!required) return true
    return required.some((f) => previewMember.allowedFeatures.includes(f as any))
  })

  const handleBusinessClick = useCallback(
    (businessId: string) => {
      router.push(`/business/${businessId}`)
    },
    [router],
  )

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
    return <AdminRestrictedPage sectionName="El dashboard principal" />
  }

  return (
    <div className="flex min-h-screen bg-background">
      <OnboardingTour />
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
                  <span className="truncate">{currentTime.toLocaleString()}</span>
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
                  <p className="text-3xl font-semibold text-foreground tabular-nums truncate">{stat.value}</p>
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
                      className="bg-card hover:bg-[#F9F9F8] transition-colors duration-150 p-5 cursor-pointer"
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
                            {new Date(business.createdAt || Date.now()).toLocaleDateString("es-HN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
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

            {/* Quick Actions — misma rejilla que "Todo conectado..." del landing:
                fila con ícono, título/descripción y flecha, no tarjetas cuadradas. */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <h2 className="text-xl font-semibold tracking-[-0.02em] text-foreground">{t("dashboard_quick_actions")}</h2>
                <Button onClick={() => setShowAddDialog(true)} data-tour="dash-add-business" size="sm" variant="outline">
                  <PlusCircle className="h-4 w-4 mr-2" />
                  {t("dashboard_add_business")}
                </Button>
              </div>

              <div className="divide-y divide-hairline border-t border-b border-hairline" data-tour="dash-quick-actions">
                {menuItems.map((action, index) => (
                  <Link
                    key={index}
                    href={action.href}
                    className="flex items-center gap-4 py-4 group hover:bg-[#F9F9F8] transition-colors -mx-2 px-2 rounded-lg"
                  >
                    <div className={`w-10 h-10 rounded-xl ${action.bgColor} flex items-center justify-center shrink-0`}>
                      <action.icon className={`h-5 w-5 ${action.textColor}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">{action.text}</p>
                      <p className="text-sm text-text-3 mt-0.5 truncate">{action.description}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-text-4 shrink-0 group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                ))}
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
                              {ActivityTracker.formatTimeAgo(activity.createdAt)}
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
                    {unreadNotifications > 0 && (
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-danger-soft text-destructive">
                        {unreadNotifications}
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 h-full overflow-y-auto">
                  {systemAlerts.length > 0 ? (
                    <div className="divide-y divide-hairline">
                      {systemAlerts.map((alert) => (
                        <div key={alert.id} className="flex items-start gap-3 py-3">
                          <span className="h-1.5 w-1.5 rounded-full shrink-0 mt-1.5 bg-primary" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground">{formatActivityEntry(alert, t)}</p>
                            <p className="text-xs text-text-4 mt-0.5">{ActivityTracker.formatTimeAgo(alert.createdAt)}</p>
                          </div>
                        </div>
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


            {/* Add Business Dialog */}
            <AddBusinessDialog
              open={showAddDialog}
              onOpenChange={setShowAddDialog}
              onBusinessAdded={handleBusinessCreated}
            />

            {/* Footer */}
            <div className="text-center py-6">
              <p className="text-sm text-text-4">
                ¿Tienes sugerencias?{" "}
                <Link href="/contacto" className="text-primary hover:text-primary/80 font-medium">
                  Compártelas con nosotros
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
