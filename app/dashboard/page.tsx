"use client"
import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"
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
import { ActivityTracker, type UserActivity, type SystemAlert } from "@/lib/activity-tracker"
import { useAuth } from "@/contexts/auth-context"
import { useLanguage } from "@/contexts/language-context"
import { AddBusinessDialog } from "@/components/add-business-dialog"
import { OnboardingTour } from "@/components/onboarding-tour"
import { useFeatureAccess, useTeamPreview, setCurrentPlanSlug } from "@/lib/plan-access"
import { AdminRestrictedPage } from "@/components/admin-restricted"
import { getAllBusinesses, refreshBusinesses } from "@/lib/storage/businesses"
import { getRecipes, ensureRecipesLoaded } from "@/lib/storage/recipes"
import { getIngredients, ensureIngredientsLoaded } from "@/lib/storage/ingredients"

export default function DashboardPage() {
  const { isLoggedIn, authChecked, user } = useAuth()
  const { t } = useLanguage()
  const canAccessTeam = useFeatureAccess("team")
  const { active: previewActive, member: previewMember } = useTeamPreview()
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [username, setUsername] = useState("Usuario")
  const [email, setEmail] = useState("usuario@example.com")
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [currentTime, setCurrentTime] = useState(new Date())
  const [recentActivity, setRecentActivity] = useState<UserActivity[]>([])
  const [systemAlerts, setSystemAlerts] = useState<SystemAlert[]>([])

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

  useEffect(() => {
    const userProfile = localStorage.getItem("userProfile")
    if (userProfile) {
      const profile = JSON.parse(userProfile)
      setUsername(profile.fullName || profile.name || "Usuario")
      setEmail(profile.email || "usuario@example.com")
    } else {
      const storedUsername = localStorage.getItem("username")
      const storedEmail = localStorage.getItem("email")
      if (storedUsername) setUsername(storedUsername)
      if (storedEmail) setEmail(storedEmail)
    }

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

    const handleProfileUpdate = (event: CustomEvent) => {
      const profile = event.detail
      setUsername(profile.fullName || "Usuario")
      setEmail(profile.email || "usuario@example.com")
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
    window.addEventListener("userProfileUpdated", handleProfileUpdate as EventListener)
    window.addEventListener("dataReset", handleDataReset as EventListener)

    return () => {
      window.removeEventListener("recipesUpdated", handleRecipesUpdate as EventListener)
      window.removeEventListener("businessUpdated", handleBusinessUpdate as EventListener)
      window.removeEventListener("activityUpdated", handleActivityUpdate as EventListener)
      window.removeEventListener("alertsUpdated", handleAlertsUpdate as EventListener)
      window.removeEventListener("ingredientsUpdated", handleIngredientsUpdate as EventListener)
      window.removeEventListener("userProfileUpdated", handleProfileUpdate as EventListener)
      window.removeEventListener("dataReset", handleDataReset as EventListener)
    }
  }, [])

  // BUG CORREGIDO: leía siempre ActivityTracker con businessId=undefined, es decir
  // solo el balde "global" (perfil actualizado, negocio creado/eliminado). Pero cada
  // acción real del día a día (crear receta, ingrediente, orden de compra, menú,
  // registrar inventario) se guarda bajo la llave de SU propio negocio — por eso
  // "Actividad reciente" casi nunca reflejaba el uso real. Ahora agrega la actividad
  // de todos los negocios del usuario (mas el balde global) antes de ordenar por fecha.
  const loadUserActivity = () => {
    try {
      const storedBusinesses = JSON.parse(localStorage.getItem("businesses") || "[]") as Business[]
      const businessIds = Array.from(new Set(["main", ...storedBusinesses.map((b) => b.id)]))
      const perBusiness = businessIds.flatMap((id) => ActivityTracker.getActivities(id))
      const global = ActivityTracker.getActivities(undefined)
      const activities = [...perBusiness, ...global]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 10)
      setRecentActivity(activities)
      console.log("Loaded activities:", activities.length)
    } catch (error) {
      console.error("Error loading user activity:", error)
    }
  }

  // Mismo bug y misma corrección que loadUserActivity: las alertas reales (stock
  // bajo, orden creada, etc.) se guardan por negocio, no en el balde global.
  const loadSystemAlerts = () => {
    try {
      const storedBusinesses = JSON.parse(localStorage.getItem("businesses") || "[]") as Business[]
      const businessIds = Array.from(new Set(["main", ...storedBusinesses.map((b) => b.id)]))
      const perBusiness = businessIds.flatMap((id) => ActivityTracker.getAlerts(id))
      const global = ActivityTracker.getAlerts(undefined)
      // Se ordena más nueva primero para quedarse con las 5 más recientes, y recién
      // después se invierte — así la más nueva queda al final de la lista (abajo),
      // pedido explícito, en vez del orden más común de "más nueva arriba".
      const alerts = [...perBusiness, ...global]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 5)
        .reverse()
      setSystemAlerts(alerts)
      console.log("Loaded alerts:", alerts.length)
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
      "/equipo": [],
    }
    const required = hrefFeatureMap[item.href]
    if (!required) return true
    if (required.length === 0) return false
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

  const handleMarkAlertAsRead = (alertId: string, businessId?: string) => {
    ActivityTracker.markAlertAsRead(alertId, businessId)
    loadSystemAlerts()
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
          <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 space-y-6">
            {/* Header Section */}
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-6">
              <div className="space-y-2 flex-1 min-w-0" data-tour="dash-header">
                <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-foreground truncate flex items-center gap-2">
                  {getGreeting()}, {username}
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
                        className="shrink-0 text-foreground/40 hover:text-foreground transition-colors"
                        aria-label={t("dashboard_edit_profile_aria")}
                        title={t("dashboard_edit_profile_aria")}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    }
                  />
                </h1>
                <p className="text-base md:text-lg text-foreground/80 font-medium">
                  {t("dashboard_welcome")}
                </p>
                <div className="flex items-center gap-2 text-sm text-foreground/70 font-medium">
                  <Clock className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">{currentTime.toLocaleString()}</span>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0 flex-wrap">
                <Link href="/ficha-tecnica">
                  <Button
                    data-tour="dash-new-recipe"
                    className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg text-sm px-4 py-2 h-auto font-semibold"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    {t("dashboard_new_recipe")}
                  </Button>
                </Link>
                <SettingsDialog
                  trigger={
                    <Button
                      variant="outline"
                      size="icon"
                      className="border-2 border-border hover:bg-accent bg-transparent h-10 w-10 flex-shrink-0"
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                  }
                />
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" data-tour="dash-stats">
              {stats.map((stat, index) => (
                <Card
                  key={index}
                  className="border-2 border-border shadow-lg hover:shadow-xl transition-all duration-300 bg-card overflow-hidden"
                >
                  <CardContent className="p-4 h-36 flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-3">
                      <div className={`p-2 rounded-lg ${stat.bgColor} flex-shrink-0`}>
                        <stat.icon className={`h-6 w-6 ${stat.textColor}`} />
                      </div>
                    </div>
                    <div className="space-y-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground/70 uppercase tracking-wide truncate">
                        {stat.title}
                      </p>
                      <p className="text-2xl font-bold text-foreground truncate">{stat.value}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Mis Negocios Section */}
            {businesses.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl md:text-2xl font-bold text-foreground">{t("dashboard_my_businesses")}</h2>
                  <Link href="/negocios">
                    <Button variant="outline" className="border-2 font-semibold bg-transparent">
                      <Building2 className="h-4 w-4 mr-2" />
                      {t("dashboard_view_all")}
                    </Button>
                  </Link>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {businesses.slice(0, 6).map((business) => (
                    <Card
                      key={business.id}
                      className="border-2 border-border shadow-lg hover:shadow-xl transition-all duration-300 bg-card group cursor-pointer"
                      onClick={() => handleBusinessClick(business.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Building2 className="h-5 w-5 text-primary" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="font-bold text-lg text-foreground group-hover:text-primary transition-colors truncate">
                              {business.name}
                            </h3>
                            <p className="text-sm text-foreground/70 truncate">
                              {t("dashboard_created_on")}{" "}
                              {new Date(business.createdAt || Date.now()).toLocaleDateString("es-HN", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })}
                            </p>
                          </div>
                          {business.hasFinancialData && (
                            <Badge variant="secondary" className="bg-green-100 text-green-800 dark:text-green-300 text-xs">
                              {t("dashboard_complete")}
                            </Badge>
                          )}
                        </div>

                        {business.hasFinancialData && business.expenses && (
                          <div className="text-sm text-foreground/70 mb-2">
                            {t("dashboard_operational_cost")}: {formatCurrency(roundToNextHundred(calculateTotalMonthlyExpenses(business.expenses)))}
                          </div>
                        )}

                        <div className="flex items-center text-primary group-hover:translate-x-1 transition-transform">
                          <span className="text-sm font-bold">{t("dashboard_open_dashboard")}</span>
                          <ArrowRight className="h-4 w-4 ml-2 flex-shrink-0" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <h2 className="text-xl md:text-2xl font-bold text-foreground">{t("dashboard_quick_actions")}</h2>
                <Button
                  onClick={() => setShowAddDialog(true)}
                  data-tour="dash-add-business"
                  className="text-sm px-4 py-2 h-auto font-semibold shadow-lg flex-shrink-0"
                >
                  <PlusCircle className="h-4 w-4 mr-2" />
                  {t("dashboard_add_business")}
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6" data-tour="dash-quick-actions">
                {menuItems.map((action, index) => (
                  <Link key={index} href={action.href}>
                    <Card className="border-2 border-border shadow-lg hover:shadow-xl transition-all duration-300 bg-card group cursor-pointer h-56 overflow-hidden">
                      <CardContent className="p-6 h-full flex flex-col justify-between">
                        <div className="space-y-4">
                          <div className={`p-4 rounded-lg ${action.bgColor} w-fit transition-all duration-300`}>
                            <action.icon className={`h-8 w-8 ${action.textColor}`} />
                          </div>
                          <div className="space-y-3 min-w-0">
                            <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors leading-tight">
                              {action.text}
                            </h3>
                            <p className="text-sm text-foreground/70 font-medium leading-relaxed line-clamp-3">
                              {action.description}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center text-primary group-hover:translate-x-1 transition-transform mt-4 pt-4 border-t border-border/50">
                          <span className="text-sm font-bold">{t("dashboard_access_now")}</span>
                          <ArrowRight className="h-4 w-4 ml-2 flex-shrink-0" />
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>

            {/* Recent Activity & Alerts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Activity */}
              <Card className="border-2 border-border shadow-lg bg-card h-80 overflow-hidden" data-tour="dash-recent-activity">
                <CardHeader className="border-b-2 border-border p-4">
                  <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                    <Activity className="h-5 w-5 flex-shrink-0" />
                    <span className="truncate">{t("dashboard_recent_activity")}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 h-full overflow-y-auto">
                  {recentActivity.length > 0 ? (
                    <div className="space-y-3">
                      {recentActivity.map((activity) => (
                        <div
                          key={activity.id}
                          className="flex items-start gap-3 p-3 rounded-lg bg-muted/20 border border-border"
                        >
                          <div className="text-lg flex-shrink-0 mt-0.5">
                            {ActivityTracker.getActivityIcon(activity.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground line-clamp-2">{activity.action}</p>
                            <p className="text-xs text-foreground/70 font-medium mt-1">
                              {ActivityTracker.formatTimeAgo(activity.timestamp)}
                            </p>
                          </div>
                          <Badge variant="outline" className="text-xs font-semibold border-2 flex-shrink-0 capitalize">
                            {activity.type}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Activity className="h-12 w-12 text-foreground/30 mx-auto mb-4" />
                      <p className="text-foreground/70 font-medium">{t("dashboard_no_activity")}</p>
                      <p className="text-xs text-foreground/50 mt-1">{t("dashboard_no_activity_desc")}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* System Alerts */}
              <Card className="border-2 border-border shadow-lg bg-card h-80 overflow-hidden" data-tour="dash-notifications">
                <CardHeader className="border-b-2 border-border p-4">
                  <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                    <Bell className="h-5 w-5 flex-shrink-0" />
                    <span className="truncate">{t("dashboard_notifications")}</span>
                    {systemAlerts.filter((alert) => !alert.read).length > 0 && (
                      <Badge variant="destructive" className="text-xs">
                        {systemAlerts.filter((alert) => !alert.read).length}
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 h-full overflow-y-auto">
                  {systemAlerts.length > 0 ? (
                    <div className="space-y-3">
                      {systemAlerts.map((alert) => (
                        <div
                          key={alert.id}
                          className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                            alert.type === "success"
                              ? "bg-green-100 border-green-300 hover:bg-green-50 dark:bg-green-950/40"
                              : alert.type === "warning"
                                ? "bg-amber-100 border-amber-300 hover:bg-amber-50 dark:bg-amber-950/40"
                                : alert.type === "error"
                                  ? "bg-red-100 border-red-300 hover:bg-red-50 dark:bg-red-950/40"
                                  : "bg-blue-100 border-blue-300 hover:bg-blue-50 dark:bg-blue-950/40"
                          } ${alert.read ? "opacity-60" : ""}`}
                          onClick={() => handleMarkAlertAsRead(alert.id, alert.businessId)}
                        >
                          <div className="text-lg flex-shrink-0 mt-0.5">{ActivityTracker.getAlertIcon(alert.type)}</div>
                          <div className="flex-1 min-w-0">
                            <p
                              className={`text-sm font-bold ${
                                alert.type === "success"
                                  ? "text-green-900 dark:text-green-300"
                                  : alert.type === "warning"
                                    ? "text-amber-900 dark:text-amber-300"
                                    : alert.type === "error"
                                      ? "text-red-900 dark:text-red-300"
                                      : "text-blue-900 dark:text-blue-300"
                              }`}
                            >
                              {alert.title}
                            </p>
                            <p
                              className={`text-xs font-medium mt-1 ${
                                alert.type === "success"
                                  ? "text-green-800 dark:text-green-300"
                                  : alert.type === "warning"
                                    ? "text-amber-800 dark:text-amber-300"
                                    : alert.type === "error"
                                      ? "text-red-800 dark:text-red-300"
                                      : "text-blue-800 dark:text-blue-300"
                              }`}
                            >
                              {alert.message}
                            </p>
                            <p className="text-xs text-foreground/50 mt-1">
                              {ActivityTracker.formatTimeAgo(alert.timestamp)}
                            </p>
                          </div>
                          {!alert.read && <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0 mt-2"></div>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Bell className="h-12 w-12 text-foreground/30 mx-auto mb-4" />
                      <p className="text-foreground/70 font-medium">{t("dashboard_no_notifications")}</p>
                      <p className="text-xs text-foreground/50 mt-1">{t("dashboard_no_notifications_desc")}</p>
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
              <p className="text-sm text-foreground/70 font-medium">
                ¿Tienes sugerencias?{" "}
                <Link href="/contacto" className="text-primary hover:text-primary/80 font-semibold underline">
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
