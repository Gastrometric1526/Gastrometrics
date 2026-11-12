"use client"

import type React from "react"
import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useLanguage } from "@/contexts/language-context"
import { ArrowLeft, Lock, RefreshCw, LogOut, BookOpen, X, Wrench } from "lucide-react"
import { StatsPanel, type AdminStats } from "@/components/admin/stats-panel"
import { AdminLiveProvider, useAdminLive } from "@/components/admin/live"
import { AccountsPanel } from "@/components/admin/accounts-panel"
import { FeedbackPanel } from "@/components/admin/feedback-panel"
import { SurveyPanel } from "@/components/admin/survey-panel"
import { SupportInbox } from "@/components/admin/support-inbox"
import { OnlineNow } from "@/components/admin/online-now"
import { AdminNotificationsBell } from "@/components/admin/notifications-bell"
import { FullExportButton } from "@/components/admin/full-export-button"
import { AnalyticsPanel } from "@/components/admin/analytics-panel"
import { TopUsersPanel } from "@/components/admin/top-users-panel"
import { ReviewsPanel } from "@/components/admin/reviews-panel"
import { EmailClicksPanel } from "@/components/admin/email-clicks-panel"
import { OcrUsagePanel } from "@/components/admin/ocr-usage-panel"
import { UsageEventsPanel } from "@/components/admin/usage-events-panel"
import { BusinessHealthPanel } from "@/components/admin/business-health-panel"
import { ActivationPanel } from "@/components/admin/activation-panel"
import { ReferralsPanel } from "@/components/admin/referrals-panel"
import { ProductUpdatesPanel } from "@/components/admin/product-updates-panel"
import { LegalUpdatePanel } from "@/components/admin/legal-update-panel"
import { AdminSubTabs } from "@/components/admin/sub-tabs"
import { AdminPushToggle } from "@/components/admin/push-toggle"
import { OverviewPanel } from "@/components/admin/overview-panel"
import { RevenuePanel } from "@/components/admin/revenue-panel"
import { HealthPanel } from "@/components/admin/health-panel"
import { RetentionPanel } from "@/components/admin/retention-panel"
import { FunnelPanel } from "@/components/admin/funnel-panel"
import { AccountHistoryPanel } from "@/components/admin/account-history-panel"
import { AdminSidebar, AdminMobileNav, type AdminBadges } from "@/components/admin/admin-nav"
import { AdminSearch } from "@/components/admin/admin-search"
import { GuidePanel, QuickTasks, SectionHeader } from "@/components/admin/guide-panel"
import { AdminCard } from "@/components/admin/ui"
import { OPEN_ACCOUNT_EVENT } from "@/lib/admin/open-account"
import { ADMIN_SECTIONS, isAdminTab, taskSteps, type AdminTab, type AdminTask } from "@/lib/admin/nav"

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
// Rediseño de docs/279: barra lateral con 3 grupos (Día a día, Cómo va el negocio,
// Herramientas), buscador «¿Qué quieres hacer?», «Cómo se usa esta sección» en cada una,
// Guía con las tareas paso a paso y accesos rápidos en el Resumen. El mapa vive en
// lib/admin/nav.ts; la lógica de cada panel en components/admin/*-panel.tsx. Los id de
// sección y sub-sección siguen siendo los de la URL (?tab=…&sub=…) de docs/191.

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
  const { tick, lastUpdatedAt, refreshNow } = useAdminLive()

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
  // Tarea elegida en la Guía, el buscador o los accesos rápidos: sus pasos se muestran
  // arriba de la sección a la que lleva, hasta cerrarlos (docs/279).
  const [activeTask, setActiveTask] = useState<AdminTask | null>(null)

  // Pestaña en la URL (?tab=crecimiento&sub=referidos, docs/191): al recargar se vuelve
  // a la misma sección y se puede enlazar. Se lee de window (no useSearchParams) para no
  // exigir <Suspense> en esta página.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const fromUrl = params.get("tab")
    if (isAdminTab(fromUrl)) {
      setTab(fromUrl)
      const sub = params.get("sub")
      if (sub) setSubTab({ [fromUrl]: sub })
    }
  }, [])

  const goTo = (next: AdminTab, sub?: string) => {
    setTab(next)
    if (sub) setSubTab((prev) => ({ ...prev, [next]: sub }))
    if (activeTask && activeTask.tab !== next) setActiveTask(null)
    const params = new URLSearchParams(window.location.search)
    params.set("tab", next)
    if (sub) params.set("sub", sub)
    else params.delete("sub")
    window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }
  const setSub = (group: AdminTab, sub: string) => goTo(group, sub)

  const runTask = (task: AdminTask) => {
    if (task.prepare === "sortExpiring") {
      // Abre Cuentas ya ordenada «por vencer» (docs/197).
      try {
        sessionStorage.setItem("gm_admin_accounts_sort", "expiring")
      } catch {}
    }
    goTo(task.tab, task.sub)
    setActiveTask(task)
  }

  // Clic en una cuenta desde cualquier panel (docs/214): se va a Cuentas → Lista, donde
  // AccountsPanel abre su ficha.
  const goToRef = useRef(goTo)
  goToRef.current = goTo
  useEffect(() => {
    const open = () => goToRef.current("cuentas", "lista")
    window.addEventListener(OPEN_ACCOUNT_EVENT, open)
    return () => window.removeEventListener(OPEN_ACCOUNT_EVENT, open)
  }, [])

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
        // El aviso emergente de mensaje nuevo (docs/192) lo da ahora la campana de
        // notificaciones para todo tipo de aviso (docs/267).
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

  const inboxCount = feedbackCounts.nuevo + supportWaiting
  const badges: AdminBadges = { buzon: inboxCount, comunicacion: legalPending ?? 0 }
  const subBadges: Record<string, number> = { "buzon.chat": supportWaiting, "buzon.mensajes": feedbackCounts.nuevo, "comunicacion.legal": legalPending ?? 0 }
  const subItems = (group: AdminTab, contents: Record<string, React.ReactNode>) =>
    (ADMIN_SECTIONS[group].subs ?? []).map((s) => ({
      value: s.id,
      label: subBadges[`${group}.${s.id}`] ? `${t(s.label)} (${subBadges[`${group}.${s.id}`]})` : t(s.label),
      description: t(s.desc),
      content: contents[s.id],
    }))
  const subTabs = (group: AdminTab, contents: Record<string, React.ReactNode>) => (
    <AdminSubTabs value={subTab[group] || ADMIN_SECTIONS[group].subs![0].id} onChange={(v) => setSub(group, v)} items={subItems(group, contents)} pillsOnDesktop={false} />
  )

  const logout = async () => {
    await fetch("/api/admin/verify", { method: "DELETE" })
    sessionStorage.removeItem(ADMIN_SESSION_STORAGE_KEY)
    setUnlocked(false)
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Encabezado fijo (docs/279): volver y título a la izquierda, buscador al centro y
          las acciones del panel a la derecha. En el celular el buscador baja a su fila. */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-[1440px] items-center gap-3 px-4 py-3 lg:px-6">
          <Link href="/dashboard" aria-label={t("common_back")}>
            <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="min-w-0 lg:w-56 lg:shrink-0">
            <h1 className="truncate text-base font-semibold text-foreground">{t("admin_page_title")}</h1>
            <LiveIndicator lastUpdatedAt={lastUpdatedAt} onRefresh={refreshNow} />
          </div>
          <AdminSearch onGo={goTo} onTask={runTask} className="hidden flex-1 md:block md:max-w-xl" />
          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            <OnlineNow onOpenAccounts={() => goTo("cuentas")} />
            {/* Centro de notificaciones: mensajes, encuestas, cuentas nuevas… (docs/267) */}
            <AdminNotificationsBell onNavigate={(next, sub) => isAdminTab(next) && goTo(next, sub)} />
            <Button variant="ghost" size="sm" className="gap-1.5" onClick={logout} aria-label={t("admin_logout")}>
              <LogOut className="h-4 w-4" />
              <span className="hidden xl:inline">{t("admin_logout")}</span>
            </Button>
          </div>
        </div>
        <div className="px-4 pb-3 md:hidden">
          <AdminSearch onGo={goTo} onTask={runTask} />
        </div>
      </header>

      <div className="mx-auto flex max-w-[1440px] gap-8 px-4 lg:px-6">
        <aside className="hidden w-60 shrink-0 lg:block">
          <div className="sticky top-[4.5rem] max-h-[calc(100vh-5rem)] overflow-y-auto py-6 pr-1">
            <AdminSidebar tab={tab} sub={subTab[tab]} badges={badges} subBadges={subBadges} onGo={goTo} />
          </div>
        </aside>

        <main className="min-w-0 flex-1 space-y-6 py-6 pb-16">
          <div className="lg:hidden">
            <AdminMobileNav tab={tab} badges={badges} onGo={(next) => goTo(next)} />
          </div>

          <SectionHeader tab={tab} />

          {activeTask && activeTask.tab === tab && <TaskBanner task={activeTask} onClose={() => setActiveTask(null)} />}

          {tab === "resumen" && (
            <div className="space-y-6">
              <OverviewPanel
                feedbackCounts={feedbackCounts}
                expiringSoon={stats?.expiringSoon?.length ?? 0}
                legalPending={legalPending ?? 0}
                goTo={(next, sub) => isAdminTab(next) && goTo(next, sub)}
              />
              <QuickTasks onTask={runTask} onOpenGuide={() => goTo("guia")} />
              <StatsPanel feedbackCounts={feedbackCounts} stats={stats} />
            </div>
          )}

          {tab === "buzon" &&
            subTabs("buzon", {
              chat: <SupportInbox onWaitingChange={setSupportWaiting} />,
              mensajes: <FeedbackPanel onCountsChange={setFeedbackCounts} />,
              encuestas: <SurveyPanel />,
              resenas: <ReviewsPanel />,
            })}

          {tab === "cuentas" && subTabs("cuentas", { lista: <AccountsPanel />, historial: <AccountHistoryPanel /> })}

          {tab === "ingresos" && <RevenuePanel estimatedMrrUsdCents={stats?.estimatedMrrUsdCents} />}

          {tab === "crecimiento" &&
            subTabs("crecimiento", {
              etapas: <FunnelPanel />,
              retencion: <RetentionPanel />,
              activacion: <ActivationPanel />,
              referidos: <ReferralsPanel />,
              usuarios: <TopUsersPanel />,
              inactivos: <BusinessHealthPanel />,
            })}

          {tab === "uso" &&
            subTabs("uso", {
              embudo: <AnalyticsPanel />,
              correos: <EmailClicksPanel />,
              // Importaciones masivas y descargas del manual por cuenta (docs/208), y el uso del OCR.
              importaciones: (
                <>
                  <UsageEventsPanel />
                  <OcrUsagePanel />
                </>
              ),
            })}

          {tab === "comunicacion" && subTabs("comunicacion", { novedades: <ProductUpdatesPanel />, legal: <LegalUpdatePanel /> })}

          {tab === "sistema" && (
            <div className="space-y-6">
              <HealthPanel />
              {/* Herramientas del panel (docs/279): antes solo estaban en el encabezado. */}
              <AdminCard title={t("admin_tools_title")} icon={Wrench} description={t("admin_tools_desc")}>
                <div className="flex flex-wrap items-center gap-2">
                  {/* Un solo botón: todas las tablas + el informe PDF, en un ZIP (docs/250, docs/266) */}
                  <FullExportButton />
                  <AdminPushToggle />
                </div>
              </AdminCard>
            </div>
          )}

          {tab === "guia" && <GuidePanel onGo={goTo} onTask={runTask} />}
        </main>
      </div>
    </div>
  )
}

/** Los pasos de la tarea elegida, arriba de la sección a la que llevó (docs/279). */
function TaskBanner({ task, onClose }: { task: AdminTask; onClose: () => void }) {
  const { t } = useLanguage()
  return (
    <div className="rounded-lg border border-primary/40 bg-primary/5 p-4" role="note">
      <div className="flex items-start gap-3">
        <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-sm font-semibold text-foreground">{t(task.title)}</p>
          <ol className="space-y-1 text-sm text-muted-foreground">
            {taskSteps(task, t).map((s, i) => (
              <li key={i} className="flex gap-2">
                <span className="w-4 shrink-0 text-right font-semibold text-primary tabular-nums">{i + 1}.</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onClose} aria-label={t("common_close")}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

/** «En vivo · actualizado …» con el botón para actualizar ya (docs/192). */
function LiveIndicator({ lastUpdatedAt, onRefresh }: { lastUpdatedAt: number; onRefresh: () => void }) {
  const { t } = useLanguage()
  const d = new Date(lastUpdatedAt)
  const time = [d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, "0")).join(":")
  return (
    <button type="button" onClick={onRefresh} title={t("admin_live_refresh")} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
      </span>
      <span className="truncate">{t("admin_live_updated").replace("{time}", time)}</span>
      <RefreshCw className="h-3 w-3 shrink-0" />
    </button>
  )
}
