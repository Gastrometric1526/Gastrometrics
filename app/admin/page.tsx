"use client"

import type React from "react"
import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/contexts/language-context"
import { ArrowLeft, RefreshCw, LogOut, BookOpen, X, Wrench, HelpCircle } from "lucide-react"
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
import { AdminPushToggle } from "@/components/admin/push-toggle"
import { OverviewNumbers } from "@/components/admin/overview-panel"
import { RevenuePanel } from "@/components/admin/revenue-panel"
import { HealthPanel } from "@/components/admin/health-panel"
import { RetentionPanel } from "@/components/admin/retention-panel"
import { FunnelPanel } from "@/components/admin/funnel-panel"
import { AccountHistoryPanel } from "@/components/admin/account-history-panel"
import { AdminSearch } from "@/components/admin/admin-search"
import { GuidePanel } from "@/components/admin/guide-panel"
import { AdminToday } from "@/components/admin/admin-today"
import { SpaceView } from "@/components/admin/space-view"
import { SpaceBottomBar, SpaceTabs } from "@/components/admin/space-nav"
import { AdminLogin } from "@/components/admin/admin-login"
import { AdminPanelTour } from "@/components/admin/admin-tour"
import { AdminAccessPanel } from "@/components/admin/admin-access-panel"
import type { AdminSessionInfo } from "@/lib/admin/session-info"
import { RecoveryPanel } from "@/components/admin/recovery-panel"
import { AppOverviewPanel } from "@/components/admin/app-overview-panel"
import { PdfExportsPanel } from "@/components/admin/pdf-exports-panel"
import { AdminCard, useAdminData } from "@/components/admin/ui"
import type { HealthResponse } from "@/components/admin/health-panel"
import { OPEN_ACCOUNT_EVENT } from "@/lib/admin/open-account"
import { ADMIN_SPACES, locate, resolveAdminTab, spaceParts, taskSteps, type AdminSpaceId, type AdminTab, type AdminTask } from "@/lib/admin/nav"

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
// Rediseño desde cero (docs/292, pedido del dueño: «fácil de entender y usar»): 5 espacios
// siempre a la vista —Hoy, Mensajes, Personas, Números, Sistema— (arriba en la computadora,
// abajo en el celular) y, dentro de cada uno, todas sus partes en botones; el mapa vive en
// `ADMIN_SPACES` (lib/admin/nav.ts). Antes, diseño de docs/281 (pedido del dueño): un Inicio con «Para atender hoy» y 6 tarjetas
// grandes; cada tarjeta abre su área a pantalla completa con «← Inicio» y sus bloques uno
// debajo del otro, sin barra lateral ni submenús. Buscador «¿Qué quieres hacer?» y Guía con
// las tareas paso a paso (docs/279). El mapa vive en lib/admin/nav.ts; la lógica de cada
// panel en components/admin/*-panel.tsx. Los id siguen siendo los de la URL
// (?tab=…&sub=…, docs/191): `sub` ahora lleva al bloque dentro del área.

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
  // Quién entró y si puede dar acceso (docs/282).
  const [session, setSession] = useState<AdminSessionInfo | null>(null)
  const [feedbackCounts, setFeedbackCounts] = useState({ total: 0, nuevo: 0, bug: 0 })
  const [supportWaiting, setSupportWaiting] = useState(0)
  // Solicitudes para recuperar una cuenta sin resolver (docs/285).
  const [recoveryPending, setRecoveryPending] = useState(0)
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [legalPending, setLegalPending] = useState<number | null>(null)
  const [tab, setTab] = useState<AdminTab>("resumen")
  // Bloque al que hay que bajar dentro del área (de ?sub=, una tarea o un aviso).
  const [scrollTo, setScrollTo] = useState<{ tab: AdminTab; sub: string; n: number } | null>(null)
  // Tarea elegida en la Guía, el buscador o los accesos rápidos: sus pasos se muestran
  // arriba de la sección a la que lleva, hasta cerrarlos (docs/279).
  const [activeTask, setActiveTask] = useState<AdminTask | null>(null)
  // Cada vez que sube, se abre el recorrido del panel desde el Inicio (botón de la Guía).
  const [tourRun, setTourRun] = useState(0)
  // Problemas del sistema, para el número junto a «Sistema» (docs/292).
  const health = useAdminData<HealthResponse>(unlocked ? "/api/admin/health" : null)

  // Pestaña en la URL (?tab=crecimiento&sub=referidos, docs/191): al recargar se vuelve
  // a la misma sección y se puede enlazar. Se lee de window (no useSearchParams) para no
  // exigir <Suspense> en esta página.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const fromUrl = resolveAdminTab(params.get("tab"))
    if (fromUrl) {
      setTab(fromUrl)
      const sub = params.get("sub")
      if (sub) setScrollTo({ tab: fromUrl, sub, n: Date.now() })
    }
  }, [])

  const goTo = (next: AdminTab, sub?: string) => {
    setTab(next)
    setScrollTo(sub ? { tab: next, sub, n: Date.now() } : null)
    if (activeTask && activeTask.tab !== next) setActiveTask(null)
    const params = new URLSearchParams(window.location.search)
    params.set("tab", next)
    if (sub) params.set("sub", sub)
    else params.delete("sub")
    window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`)
    // Cada parte se ve sola (docs/287): siempre se empieza arriba.
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

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
    fetch("/api/admin/recovery")
      .then((res) => res.json())
      .then((data) => typeof data.pending === "number" && setRecoveryPending(data.pending))
      .catch(() => {})
    fetch("/api/admin/legal-update-email")
      .then((res) => res.json())
      .then((data) => {
        if (!data.error && typeof data.pendingCount === "number") setLegalPending(data.pendingCount)
      })
      .catch(() => {})
  }, [unlocked, tick])

  // La cookie httpOnly no se puede leer desde JS: se le pregunta al servidor si hay sesión
  // del panel, de quién es y qué cuenta de la app está abierta (docs/282). sessionStorage
  // solo evita el parpadeo de la pantalla de entrada al recargar.
  const loadSession = () =>
    fetch("/api/admin/verify")
      .then((res) => res.json())
      .then((data: AdminSessionInfo) => {
        setSession(data)
        setUnlocked(!!data.unlocked)
        if (data.unlocked) sessionStorage.setItem(ADMIN_SESSION_STORAGE_KEY, "true")
        else sessionStorage.removeItem(ADMIN_SESSION_STORAGE_KEY)
      })
      .catch(() => {})
      .finally(() => setCheckedSession(true))

  useEffect(() => {
    if (sessionStorage.getItem(ADMIN_SESSION_STORAGE_KEY) === "true") setUnlocked(true)
    loadSession()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!checkedSession) {
    return null
  }

  if (!unlocked) {
    return <AdminLogin info={session} onUnlocked={loadSession} />
  }

  const inboxCount = feedbackCounts.nuevo + supportWaiting + recoveryPending
  const go = (next: string, sub?: string) => {
    const resolved = resolveAdminTab(next)
    if (resolved) goTo(resolved, sub)
  }
  // Dónde estamos (docs/292): el espacio y la parte de la dirección actual.
  const here = locate(tab, scrollTo?.tab === tab ? scrollTo.sub : null)
  const openSpace = (id: AdminSpaceId) => {
    const space = ADMIN_SPACES.find((x) => x.id === id) ?? ADMIN_SPACES[0]
    const first = spaceParts(space)[0]
    goTo(first.tab, first.sub)
  }
  const banner = activeTask && activeTask.tab === tab ? <TaskBanner task={activeTask} onClose={() => setActiveTask(null)} /> : null
  const problems = health.data?.problems?.length ?? 0

  const logout = async () => {
    await fetch("/api/admin/verify", { method: "DELETE" })
    sessionStorage.removeItem(ADMIN_SESSION_STORAGE_KEY)
    setUnlocked(false)
    loadSession()
  }

  // Todo el contenido del panel, por parte (`tab:sub`). Cada pieza es la misma de antes:
  // el rediseño cambia cómo se encuentra, no qué muestra.
  const content: Record<string, React.ReactNode> = {
    "resumen:hoy": (
      <AdminToday
        supportWaiting={supportWaiting}
        recoveryPending={recoveryPending}
        feedbackCounts={feedbackCounts}
        expiringSoon={stats?.expiringSoon?.length ?? 0}
        legalPending={legalPending ?? 0}
        onGo={goTo}
        onTask={runTask}
      />
    ),
    "buzon:chat": <SupportInbox onWaitingChange={setSupportWaiting} />,
    "buzon:mensajes": <FeedbackPanel onCountsChange={setFeedbackCounts} />,
    "buzon:recuperar": <RecoveryPanel onPendingChange={setRecoveryPending} />,
    "buzon:encuestas": <SurveyPanel />,
    "buzon:resenas": <ReviewsPanel />,
    "comunicacion:novedades": <ProductUpdatesPanel />,
    "comunicacion:legal": <LegalUpdatePanel />,
    "cuentas:lista": <AccountsPanel />,
    "cuentas:cifras": <StatsPanel feedbackCounts={feedbackCounts} stats={stats} />,
    "cuentas:historial": <AccountHistoryPanel />,
    "ingresos:dinero": <RevenuePanel estimatedMrrUsdCents={stats?.estimatedMrrUsdCents} />,
    "crecimiento:numeros": <OverviewNumbers goTo={go} />,
    "crecimiento:app": <AppOverviewPanel />,
    "crecimiento:etapas": <FunnelPanel />,
    "crecimiento:retencion": <RetentionPanel />,
    "crecimiento:activacion": <ActivationPanel />,
    "crecimiento:usuarios": <TopUsersPanel />,
    "crecimiento:pdf": <PdfExportsPanel />,
    "crecimiento:inactivos": <BusinessHealthPanel />,
    "crecimiento:referidos": <ReferralsPanel />,
    "crecimiento:embudo": <AnalyticsPanel />,
    "crecimiento:correos": <EmailClicksPanel />,
    // Importaciones masivas y descargas del manual por cuenta (docs/208), y el uso del OCR.
    "crecimiento:importaciones": (
      <>
        <UsageEventsPanel />
        <OcrUsagePanel />
      </>
    ),
    "sistema:salud": <HealthPanel />,
    // Quién puede entrar al panel (docs/282).
    "sistema:acceso": <AdminAccessPanel />,
    // Herramientas del panel (docs/279).
    "sistema:herramientas": (
      <AdminCard title={t("admin_tools_title")} icon={Wrench} description={t("admin_tools_desc")}>
        <div className="flex flex-wrap items-center gap-2">
          {/* Un solo botón: todas las tablas + el informe PDF, en un ZIP (docs/250, docs/266) */}
          <FullExportButton />
          <AdminPushToggle />
        </div>
      </AdminCard>
    ),
    "guia:guia": <GuidePanel onGo={goTo} onTask={runTask} onStartTour={() => setTourRun((n) => n + 1)} />,
  }
  const counts: Record<string, number> = {
    "buzon:chat": supportWaiting,
    "buzon:mensajes": feedbackCounts.nuevo,
    "buzon:recuperar": recoveryPending,
    "comunicacion:legal": legalPending ?? 0,
    "sistema:salud": problems,
  }
  const badges = {
    mensajes: { count: inboxCount },
    sistema: { count: problems, tone: "bad" as const },
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Encabezado fijo (docs/292): volver a la app, el nombre del panel, el buscador y, a la
          derecha, en línea, la Guía, notificaciones y salir. Debajo, los 5 espacios (en el
          celular van abajo, como una app). */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link href="/dashboard" aria-label={t("common_back")}>
            <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <button type="button" onClick={() => openSpace("hoy")} className="min-w-0 text-left md:w-48 md:shrink-0">
            <h1 className="truncate text-base font-semibold text-foreground">{t("admin_page_title")}</h1>
          </button>
          <AdminSearch onGo={goTo} onTask={runTask} className="hidden flex-1 md:block md:max-w-lg" data-tour="admin-search" />
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <OnlineNow onOpenAccounts={() => goTo("cuentas", "lista")} />
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => goTo("guia", "guia")} aria-label={t("admin_tab_guide")} title={t("admin_tab_guide")}>
              <HelpCircle className="h-4 w-4" />
            </Button>
            {/* Centro de notificaciones: mensajes, encuestas, cuentas nuevas… (docs/267) */}
            <span data-tour="admin-bell">
              <AdminNotificationsBell onNavigate={go} />
            </span>
            {session?.identity?.kind === "account" && (
              <span className="hidden max-w-[14rem] truncate text-xs text-muted-foreground xl:inline" title={session.identity.email}>
                {session.identity.email}
              </span>
            )}
            <Button variant="ghost" size="sm" className="gap-1.5" onClick={logout} aria-label={t("admin_logout")} data-tour="admin-logout">
              <LogOut className="h-4 w-4" />
              <span className="hidden lg:inline">{t("admin_logout")}</span>
            </Button>
          </div>
        </div>
        <div className="px-4 pb-3 md:hidden">
          <AdminSearch onGo={goTo} onTask={runTask} />
        </div>
        <SpaceTabs current={here.space.id} badges={badges} onGo={openSpace} />
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 pb-28 pt-6 sm:px-6 sm:pt-8 md:pb-16">
        <div className="flex justify-end">
          <LiveIndicator lastUpdatedAt={lastUpdatedAt} onRefresh={refreshNow} />
        </div>

        {here.space.id === "hoy" ? (
          <>
            {banner}
            {content["resumen:hoy"]}
          </>
        ) : (
          <SpaceView space={here.space} active={here.part} content={content} counts={counts} banner={banner} onOpen={(p) => goTo(p.tab, p.sub)} />
        )}

        {/* Recorrido completo del panel (docs/282): sale solo la primera vez a quien
            administra sin ser dueño; cualquiera lo vuelve a ver desde la Guía. */}
        {here.space.id === "hoy" && (
          <AdminPanelTour key={tourRun} autoStart={session?.identity?.kind === "account" && session.identity.role === "admin"} forceStart={tourRun > 0} />
        )}
      </main>

      <SpaceBottomBar current={here.space.id} badges={badges} onGo={openSpace} />
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
