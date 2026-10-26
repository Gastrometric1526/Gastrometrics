"use client"

import type React from "react"
import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useLanguage } from "@/contexts/language-context"
import { ArrowLeft, Lock, LayoutDashboard, Users, Inbox, LineChart, TrendingUp, Mail, RefreshCw, DollarSign, HeartPulse } from "lucide-react"
import { StatsPanel, type AdminStats } from "@/components/admin/stats-panel"
import { AdminLiveProvider, useAdminLive } from "@/components/admin/live"
import { useToast } from "@/hooks/use-toast"
import { AccountsPanel } from "@/components/admin/accounts-panel"
import { FeedbackPanel } from "@/components/admin/feedback-panel"
import { SupportInbox } from "@/components/admin/support-inbox"
import { FullReportButton } from "@/components/admin/full-report-button"
import { AnalyticsPanel } from "@/components/admin/analytics-panel"
import { TopUsersPanel } from "@/components/admin/top-users-panel"
import { ReviewsPanel } from "@/components/admin/reviews-panel"
import { EmailClicksPanel } from "@/components/admin/email-clicks-panel"
import { OcrUsagePanel } from "@/components/admin/ocr-usage-panel"
import { BusinessHealthPanel } from "@/components/admin/business-health-panel"
import { ActivationPanel } from "@/components/admin/activation-panel"
import { ReferralsPanel } from "@/components/admin/referrals-panel"
import { ProductUpdatesPanel } from "@/components/admin/product-updates-panel"
import { LegalUpdatePanel } from "@/components/admin/legal-update-panel"
import { AdminSubTabs } from "@/components/admin/sub-tabs"
import { OverviewPanel } from "@/components/admin/overview-panel"
import { RevenuePanel } from "@/components/admin/revenue-panel"
import { HealthPanel } from "@/components/admin/health-panel"
import { RetentionPanel } from "@/components/admin/retention-panel"
import { AccountHistoryPanel } from "@/components/admin/account-history-panel"

// Candado de acceso — pedido explícito: agregar algún control de acceso a /admin,
// que hoy cualquiera con el link puede ver. SIN backend no existe un sistema de roles
// real (el login actual acepta cualquier usuario/contraseña, ver contexts/auth-context.tsx),
// así que esto sigue sin ser control de acceso multiusuario real — es un candado de
// código de acceso, no una cuenta con permisos.
//
// BUG CORREGIDO (ver docs/33): antes el código se comparaba en el cliente contra
// NEXT_PUBLIC_ADMIN_PASSCODE, una variable que Next.js embebe tal cual en el bundle
// del navegador — cualquiera podía extraer el código real leyendo el JS compilado,
// sin necesidad de adivinar nada. Ahora la verificación ocurre en el servidor
// (app/api/admin/verify/route.ts), contra una variable sin el prefijo NEXT_PUBLIC_
// que nunca llega al cliente, y el resultado es una cookie httpOnly que el navegador
// no puede leer ni falsificar. El bloqueo tras varios intentos fallidos también se
// mueve al servidor (por IP), no solo a un contador en sessionStorage.
const ADMIN_SESSION_STORAGE_KEY = "gm_admin_unlocked"

// Panel administrativo — pedido explícito: "ahi debo poder manejar TODO" (ver docs/63).
// Desde docs/191 se organiza en 6 secciones según lo que hace el dueño (Resumen con
// pendientes del día, Cuentas, Buzón y reseñas, Crecimiento, Uso de la app,
// Comunicación), con sub-pestañas y la pestaña guardada en la URL. La lógica de cada
// panel vive en components/admin/*-panel.tsx; este archivo mantiene el candado y el layout.

// En vivo (docs/192): todo el panel cuelga del proveedor que dispara las actualizaciones.
export default function AdminPage() {
  return (
    <AdminLiveProvider>
      <AdminPageInner />
    </AdminLiveProvider>
  )
}

function AdminPageInner() {
  const { t } = useLanguage()
  const { toast } = useToast()
  const { tick, lastUpdatedAt, refreshNow } = useAdminLive()
  const lastUnreadRef = useRef<number | null>(null)

  const [unlocked, setUnlocked] = useState(false)
  const [checkedSession, setCheckedSession] = useState(false)
  const [passcodeInput, setPasscodeInput] = useState("")
  const [passcodeError, setPasscodeError] = useState(false)
  const [lockedUntil, setLockedUntil] = useState<number | null>(null)
  const [lockoutSecondsLeft, setLockoutSecondsLeft] = useState(0)
  const [feedbackCounts, setFeedbackCounts] = useState({ total: 0, nuevo: 0, bug: 0 })
  const [supportWaiting, setSupportWaiting] = useState(0)
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [legalPending, setLegalPending] = useState<number | null>(null)
  const [tab, setTab] = useState<AdminTab>("resumen")
  const [subTab, setSubTab] = useState<Record<string, string>>({})

  // Pestaña en la URL (?tab=crecimiento&sub=referidos, docs/191): al recargar se vuelve
  // a la misma sección y se puede enlazar. Se lee de window (no useSearchParams) para no
  // exigir <Suspense> en esta página.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const fromUrl = params.get("tab") as AdminTab | null
    if (fromUrl && ADMIN_TABS.includes(fromUrl)) {
      setTab(fromUrl)
      const sub = params.get("sub")
      if (sub) setSubTab({ [fromUrl]: sub })
    }
  }, [])

  const goTo = (next: AdminTab, sub?: string) => {
    setTab(next)
    if (sub) setSubTab((prev) => ({ ...prev, [next]: sub }))
    const params = new URLSearchParams(window.location.search)
    params.set("tab", next)
    if (sub) params.set("sub", sub)
    else params.delete("sub")
    window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`)
  }
  const setSub = (group: AdminTab, sub: string) => goTo(group, sub)

  // Contadores y pendientes desde el inicio (docs/191): antes «sin revisar», «reportes
  // de error» y el número de la pestaña Buzón quedaban en 0 hasta abrir el Buzón.
  useEffect(() => {
    if (!unlocked) return
    fetch("/api/admin/stats")
      .then((res) => res.json())
      .then((data) => {
        if (!data.error) setStats(data)
      })
      .catch(() => {})
    // Conversaciones del chat de soporte esperando respuesta (docs/204).
    fetch("/api/admin/support")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.conversations)) setSupportWaiting(data.conversations.filter((c: { status: string }) => c.status === "waiting").length)
      })
      .catch(() => {})
    fetch("/api/admin/feedback")
      .then((res) => res.json())
      .then((data) => {
        if (!Array.isArray(data.feedback)) return
        const archived = new Set<string>(Array.isArray(data.archivedIds) ? data.archivedIds : [])
        const inbox = data.feedback.filter((f: { id: string }) => !archived.has(f.id))
        const nuevo = inbox.filter((f: { status?: string }) => f.status === "nuevo").length
        setFeedbackCounts({
          total: inbox.length,
          nuevo,
          bug: inbox.filter((f: { type?: string }) => f.type === "bug").length,
        })
        // Aviso cuando llega un mensaje nuevo mientras el panel está abierto (docs/192).
        if (lastUnreadRef.current !== null && nuevo > lastUnreadRef.current) {
          toast({
            title: t("admin_live_new_message_title"),
            description: t("admin_live_new_message_desc").replace("{count}", String(nuevo - lastUnreadRef.current)),
          })
        }
        lastUnreadRef.current = nuevo
      })
      .catch(() => {})
    fetch("/api/admin/legal-update-email")
      .then((res) => res.json())
      .then((data) => {
        if (!data.error && typeof data.pendingCount === "number") setLegalPending(data.pendingCount)
      })
      .catch(() => {})
  }, [unlocked, tick])

  useEffect(() => {
    // La cookie httpOnly no se puede leer desde JS — se le pregunta al servidor si
    // hay una sesión admin válida. sessionStorage solo se usa como caché optimista
    // para no parpadear la pantalla de candado en cada navegación dentro de /admin.
    const cached = sessionStorage.getItem(ADMIN_SESSION_STORAGE_KEY) === "true"
    if (cached) setUnlocked(true)

    fetch("/api/admin/verify")
      .then((res) => res.json())
      .then((data) => {
        setUnlocked(!!data.unlocked)
        if (data.unlocked) sessionStorage.setItem(ADMIN_SESSION_STORAGE_KEY, "true")
        else sessionStorage.removeItem(ADMIN_SESSION_STORAGE_KEY)
      })
      .catch(() => {})
      .finally(() => setCheckedSession(true))
  }, [])

  // Cuenta regresiva visible mientras dura el bloqueo, para que el mensaje de espera
  // no quede pegado con el mismo número.
  useEffect(() => {
    if (!lockedUntil) {
      setLockoutSecondsLeft(0)
      return
    }
    const tick = () => {
      const secondsLeft = Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000))
      setLockoutSecondsLeft(secondsLeft)
      if (secondsLeft === 0) setLockedUntil(null)
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [lockedUntil])

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault()
    if (lockedUntil && lockedUntil > Date.now()) return

    try {
      const res = await fetch("/api/admin/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode: passcodeInput }),
      })
      const data = await res.json()

      if (res.ok && data.ok) {
        sessionStorage.setItem(ADMIN_SESSION_STORAGE_KEY, "true")
        setUnlocked(true)
        setPasscodeError(false)
      } else {
        if (data.lockedForSeconds) setLockedUntil(Date.now() + data.lockedForSeconds * 1000)
        setPasscodeError(true)
        setPasscodeInput("")
      }
    } catch {
      setPasscodeError(true)
    }
  }

  if (!checkedSession) {
    return null
  }

  if (!unlocked) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 h-10 w-10 rounded-full bg-muted flex items-center justify-center">
              <Lock className="h-5 w-5 text-muted-foreground" />
            </div>
            <CardTitle>{t("admin_login_title")}</CardTitle>
            <CardDescription>{t("admin_login_subtitle")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUnlock} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="admin-passcode">{t("admin_login_passcode_label")}</Label>
                <Input
                  id="admin-passcode"
                  type="password"
                  value={passcodeInput}
                  onChange={(e) => {
                    setPasscodeInput(e.target.value)
                    setPasscodeError(false)
                  }}
                  disabled={lockoutSecondsLeft > 0}
                  autoFocus
                />
                {passcodeError && lockoutSecondsLeft === 0 && (
                  <p className="text-sm text-destructive">{t("admin_login_error")}</p>
                )}
                {lockoutSecondsLeft > 0 && (
                  <p className="text-sm text-destructive">
                    {t("admin_login_locked").replace("{seconds}", String(lockoutSecondsLeft))}
                  </p>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={lockoutSecondsLeft > 0}>
                {t("admin_login_submit")}
              </Button>
              <Link href="/dashboard">
                <Button type="button" variant="ghost" className="w-full">
                  {t("common_back")}
                </Button>
              </Link>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-7xl space-y-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Link href="/dashboard">
              <Button variant="ghost" size="sm" className="gap-2 -ml-3 mb-4">
                <ArrowLeft className="h-4 w-4" />
                {t("common_back")}
              </Button>
            </Link>
            <h1 className="text-3xl font-bold text-foreground">{t("admin_page_title")}</h1>
            <p className="text-muted-foreground">{t("admin_page_subtitle")}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            {/* Informe completo con todos los datos de /admin (docs/206) */}
            <FullReportButton />
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                await fetch("/api/admin/verify", { method: "DELETE" })
                sessionStorage.removeItem(ADMIN_SESSION_STORAGE_KEY)
                setUnlocked(false)
              }}
            >
              {t("admin_logout")}
            </Button>
            <LiveIndicator lastUpdatedAt={lastUpdatedAt} onRefresh={refreshNow} />
          </div>
        </div>

        <Tabs value={tab} onValueChange={(v) => goTo(v as AdminTab)}>
          <TabsList className="flex h-auto flex-wrap justify-start">
            <TabsTrigger value="resumen" className="gap-1.5">
              <LayoutDashboard className="h-4 w-4" />
              {t("admin_tab_resumen")}
            </TabsTrigger>
            <TabsTrigger value="cuentas" className="gap-1.5">
              <Users className="h-4 w-4" />
              {t("admin_tab_accounts")}
            </TabsTrigger>
            <TabsTrigger value="ingresos" className="gap-1.5">
              <DollarSign className="h-4 w-4" />
              {t("admin_tab_revenue")}
            </TabsTrigger>
            <TabsTrigger value="buzon" className="gap-1.5">
              <Inbox className="h-4 w-4" />
              {t("admin_tab_inbox_group")}
              {feedbackCounts.nuevo + supportWaiting > 0 && (
                <span className="ml-1 rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground tabular-nums">
                  {feedbackCounts.nuevo + supportWaiting}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="crecimiento" className="gap-1.5">
              <TrendingUp className="h-4 w-4" />
              {t("admin_tab_growth")}
            </TabsTrigger>
            <TabsTrigger value="uso" className="gap-1.5">
              <LineChart className="h-4 w-4" />
              {t("admin_tab_usage")}
            </TabsTrigger>
            <TabsTrigger value="comunicacion" className="gap-1.5">
              <Mail className="h-4 w-4" />
              {t("admin_tab_comms")}
            </TabsTrigger>
            <TabsTrigger value="sistema" className="gap-1.5">
              <HeartPulse className="h-4 w-4" />
              {t("admin_tab_system")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="resumen" className="mt-6 space-y-6">
            <TabIntro text={t("admin_tabdesc_resumen")} />
            <OverviewPanel
              feedbackCounts={feedbackCounts}
              expiringSoon={stats?.expiringSoon.length ?? 0}
              legalPending={legalPending ?? 0}
              goTo={(next, sub) => goTo(next as AdminTab, sub)}
            />
            <StatsPanel feedbackCounts={feedbackCounts} stats={stats} />
          </TabsContent>

          <TabsContent value="ingresos" className="mt-6 space-y-6">
            <TabIntro text={t("admin_tabdesc_revenue")} />
            <RevenuePanel estimatedMrrUsdCents={stats?.estimatedMrrUsdCents} />
          </TabsContent>

          <TabsContent value="cuentas" className="mt-6 space-y-6">
            <TabIntro text={t("admin_tabdesc_accounts")} />
            <AdminSubTabs
              value={subTab.cuentas || "lista"}
              onChange={(v) => setSub("cuentas", v)}
              items={[
                { value: "lista", label: t("admin_sub_accounts_list"), content: <AccountsPanel /> },
                { value: "historial", label: t("admin_sub_accounts_history"), content: <AccountHistoryPanel /> },
              ]}
            />
          </TabsContent>

          <TabsContent value="buzon" className="mt-6 space-y-6">
            <TabIntro text={t("admin_tabdesc_inbox")} />
            <AdminSubTabs
              value={subTab.buzon || "chat"}
              onChange={(v) => setSub("buzon", v)}
              items={[
                { value: "chat", label: `${t("admin_tab_support_chat")}${supportWaiting ? ` (${supportWaiting})` : ""}`, content: <SupportInbox onWaitingChange={setSupportWaiting} /> },
                { value: "mensajes", label: `${t("admin_tab_feedback")} (${feedbackCounts.total})`, content: <FeedbackPanel onCountsChange={setFeedbackCounts} /> },
                { value: "resenas", label: t("admin_tab_reviews"), content: <ReviewsPanel /> },
              ]}
            />
          </TabsContent>

          <TabsContent value="crecimiento" className="mt-6 space-y-6">
            <TabIntro text={t("admin_tabdesc_growth")} />
            <AdminSubTabs
              value={subTab.crecimiento || "retencion"}
              onChange={(v) => setSub("crecimiento", v)}
              items={[
                { value: "retencion", label: t("admin_sub_retention"), content: <RetentionPanel /> },
                { value: "activacion", label: t("admin_tab_activation"), content: <ActivationPanel /> },
                { value: "referidos", label: t("admin_sub_referrals"), content: <ReferralsPanel /> },
                { value: "usuarios", label: t("admin_sub_top_users"), content: <TopUsersPanel /> },
                { value: "inactivos", label: t("admin_sub_inactive"), content: <BusinessHealthPanel /> },
              ]}
            />
          </TabsContent>

          <TabsContent value="uso" className="mt-6 space-y-6">
            <TabIntro text={t("admin_tabdesc_usage")} />
            <AdminSubTabs
              value={subTab.uso || "embudo"}
              onChange={(v) => setSub("uso", v)}
              items={[
                { value: "embudo", label: t("admin_sub_funnel"), content: <AnalyticsPanel /> },
                { value: "correos", label: t("admin_sub_email_clicks"), content: <EmailClicksPanel /> },
                { value: "importaciones", label: t("admin_sub_imports"), content: <OcrUsagePanel /> },
              ]}
            />
          </TabsContent>

          <TabsContent value="comunicacion" className="mt-6 space-y-6">
            <TabIntro text={t("admin_tabdesc_comms")} />
            <AdminSubTabs
              value={subTab.comunicacion || "novedades"}
              onChange={(v) => setSub("comunicacion", v)}
              items={[
                { value: "novedades", label: t("admin_tab_product_updates"), content: <ProductUpdatesPanel /> },
                {
                  value: "legal",
                  label: legalPending ? `${t("admin_sub_legal")} (${legalPending})` : t("admin_sub_legal"),
                  content: <LegalUpdatePanel />,
                },
              ]}
            />
          </TabsContent>

          <TabsContent value="sistema" className="mt-6 space-y-6">
            <TabIntro text={t("admin_tabdesc_system")} />
            <HealthPanel />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

const ADMIN_TABS = ["resumen", "cuentas", "ingresos", "buzon", "crecimiento", "uso", "comunicacion", "sistema"] as const
type AdminTab = (typeof ADMIN_TABS)[number]

/** Una línea que dice para qué sirve la sección (docs/191). */
function TabIntro({ text }: { text: string }) {
  return <p className="text-sm text-muted-foreground -mt-2">{text}</p>
}

/** «En vivo · actualizado …» con el botón para actualizar ya (docs/192). */
function LiveIndicator({ lastUpdatedAt, onRefresh }: { lastUpdatedAt: number; onRefresh: () => void }) {
  const { t } = useLanguage()
  const d = new Date(lastUpdatedAt)
  const time = [d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, "0")).join(":")
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
      </span>
      <span>{t("admin_live_updated").replace("{time}", time)}</span>
      <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={onRefresh}>
        <RefreshCw className="h-3.5 w-3.5" />
        {t("admin_live_refresh")}
      </Button>
    </div>
  )
}
