"use client"

/**
 * Campana de notificaciones de /admin (pedido del dueño, docs/267). Muestra lo que hizo la
 * gente y conviene mirar —mensajes del chat y del buzón, calificaciones, respuestas a las
 * preguntas cortas, cuentas nuevas y cambios de plan—, con el número de las que no se han visto.
 *
 * - Se actualiza con el «tic» en vivo de /admin (cada 30 s con la pestaña visible).
 * - Cuando llega una nueva con el panel abierto, sale un aviso emergente con «Ver».
 * - Tocar una notificación lleva a la sección donde se atiende.
 * - «Marcar todo como leído» guarda la hora en este aparato (no hay tabla propia).
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { Bell, CheckCheck, ClipboardList, CreditCard, Inbox, MessageCircle, Smile, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { ToastAction } from "@/components/ui/toast"
import { useAdminTick } from "@/components/admin/live"
import { useLanguage } from "@/contexts/language-context"
import { useToast } from "@/hooks/use-toast"
import { formatDateTime } from "@/lib/date-format"
import { QUESTIONS } from "@/lib/feedback/ask-rules"
import { newSince, NOTICES_SEEN_KEY, NOTICES_WINDOW_DAYS, unreadNotices, type AdminNotice, type NoticeKind } from "@/lib/admin/notifications"
import type { TranslationKey } from "@/lib/i18n/translations"

const KIND: Record<NoticeKind, { icon: typeof Bell; label: TranslationKey; tone: string }> = {
  chat: { icon: MessageCircle, label: "admin_notices_kind_chat", tone: "bg-primary-soft text-primary" },
  message: { icon: Inbox, label: "admin_notices_kind_message", tone: "bg-info-soft text-info" },
  rating: { icon: Smile, label: "admin_notices_kind_rating", tone: "bg-warning-soft text-warning" },
  survey: { icon: ClipboardList, label: "admin_notices_kind_survey", tone: "bg-info-soft text-info" },
  signup: { icon: UserPlus, label: "admin_notices_kind_signup", tone: "bg-success-soft text-success" },
  plan: { icon: CreditCard, label: "admin_notices_kind_plan", tone: "bg-success-soft text-success" },
}

function readSeen(): number | null {
  try {
    const raw = localStorage.getItem(NOTICES_SEEN_KEY)
    return raw ? Number(raw) || null : null
  } catch {
    return null
  }
}

function writeSeen(at: number) {
  try {
    localStorage.setItem(NOTICES_SEEN_KEY, String(at))
  } catch {
    // Sin almacenamiento: el número vuelve a salir al recargar, nada más.
  }
}

export function AdminNotificationsBell({ onNavigate }: { onNavigate: (tab: string, sub?: string) => void }) {
  const { t } = useLanguage()
  const { toast } = useToast()
  const tick = useAdminTick()
  const [notices, setNotices] = useState<AdminNotice[]>([])
  const [loaded, setLoaded] = useState(false)
  const [open, setOpen] = useState(false)
  const [seenAt, setSeenAt] = useState<number | null>(null)
  const previousIds = useRef<Set<string> | null>(null)

  useEffect(() => setSeenAt(readSeen()), [])

  const ago = useCallback(
    (iso: string) => {
      const minutes = Math.floor((Date.now() - Date.parse(iso)) / 60_000)
      if (minutes < 1) return t("admin_notices_just_now")
      if (minutes < 60) return t("admin_notices_minutes_ago").replace("{n}", String(minutes))
      if (minutes < 24 * 60) return t("admin_notices_hours_ago").replace("{n}", String(Math.floor(minutes / 60)))
      return formatDateTime(new Date(iso))
    },
    [t],
  )

  /** «Pregunta: respuesta» de una pregunta corta, en el idioma del panel (como en Encuestas). */
  const surveyLine = (n: AdminNotice) => {
    if (!n.detail) return null
    const title = t(`q_${n.detail}_title` as TranslationKey)
    const kind = QUESTIONS.find((q) => q.key === n.detail)?.kind
    let answer = n.answer ?? null
    if (answer && kind === "choice") answer = t(`q_${n.detail}_opt_${answer}` as TranslationKey)
    else if (answer && kind === "scale") answer = t("admin_survey_scale_value").replace("{n}", answer)
    return answer ? `${title} → ${answer}` : title
  }

  const go = useCallback(
    (n: AdminNotice) => {
      setOpen(false)
      onNavigate(n.tab, n.sub)
      window.scrollTo({ top: 0, behavior: "smooth" })
    },
    [onNavigate],
  )

  // Refs para que el efecto dependa solo del «tic» (onNavigate cambia en cada render).
  const goRef = useRef(go)
  goRef.current = go
  const tRef = useRef(t)
  tRef.current = t

  useEffect(() => {
    let cancelled = false
    const t = tRef.current
    fetch("/api/admin/notifications", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { notices?: AdminNotice[] } | null) => {
        if (cancelled || !data || !Array.isArray(data.notices)) return
        const list = data.notices
        // Aviso emergente solo por lo que llegó con el panel abierto (no al entrar).
        const fresh = newSince(previousIds.current, list)
        previousIds.current = new Set(list.map((n) => n.id))
        setNotices(list)
        setLoaded(true)
        if (fresh.length > 0) {
          const first = fresh[0]
          toast({
            title: fresh.length === 1 ? t(KIND[first.kind].label) : t("admin_notices_toast_many").replace("{count}", String(fresh.length)),
            description: [first.who, first.text].filter(Boolean).join(": "),
            action: (
              <ToastAction altText={t("admin_notices_view")} onClick={() => goRef.current(first)}>
                {t("admin_notices_view")}
              </ToastAction>
            ),
          })
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [tick, toast])

  const unread = unreadNotices(notices, seenAt).length
  const markAllRead = () => {
    const now = Date.now()
    writeSeen(now)
    setSeenAt(now)
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="relative gap-1.5"
        onClick={() => setOpen(true)}
        aria-label={t("admin_notices_button_label").replace("{count}", String(unread))}
      >
        <Bell className="h-4 w-4" />
        {t("admin_notices_title")}
        {unread > 0 && (
          <span className="ml-0.5 rounded-full bg-primary px-1.5 text-[11px] font-semibold leading-5 text-primary-foreground tabular-nums">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
          <SheetHeader className="space-y-1 border-b px-5 py-4 pr-12 text-left">
            <SheetTitle>{t("admin_notices_title")}</SheetTitle>
            <SheetDescription>{t("admin_notices_desc").replace("{days}", String(NOTICES_WINDOW_DAYS))}</SheetDescription>
            {unread > 0 && (
              <div className="pt-2">
                <Button variant="ghost" size="sm" className="-ml-2 gap-1.5" onClick={markAllRead}>
                  <CheckCheck className="h-4 w-4" />
                  {t("admin_notices_mark_read")}
                </Button>
              </div>
            )}
          </SheetHeader>
          <div className="flex-1 overflow-y-auto">
            {!loaded ? (
              <p className="px-5 py-6 text-sm text-muted-foreground">{t("admin_notices_loading")}</p>
            ) : notices.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted-foreground">{t("admin_notices_empty")}</p>
            ) : (
              <ul className="divide-y">
                {notices.map((n) => {
                  const kind = KIND[n.kind]
                  const Icon = kind.icon
                  const isNew = seenAt === null || Date.parse(n.at) > seenAt
                  return (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => go(n)}
                        className={`flex w-full gap-3 px-5 py-3 text-left transition-colors hover:bg-accent ${isNew ? "bg-primary/5" : ""}`}
                      >
                        <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${kind.tone}`}>
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1 space-y-0.5">
                          <span className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="font-medium text-foreground">{t(kind.label)}</span>
                            <span>·</span>
                            <span>{ago(n.at)}</span>
                            {isNew && <span className="ml-auto h-2 w-2 shrink-0 rounded-full bg-primary" aria-label={t("admin_notices_new")} />}
                          </span>
                          {n.who && <span className="block truncate text-sm font-medium">{n.who}</span>}
                          {n.kind === "survey" && n.detail && <span className="block text-sm text-foreground/80">{surveyLine(n)}</span>}
                          {n.text && <span className="line-clamp-2 block text-sm text-muted-foreground">{n.text}</span>}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
