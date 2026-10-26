"use client"

/**
 * Chat de soporte dentro de la app (pedido del dueño, docs/204; interfaz y tickets, docs/205).
 * Montado en app/layout.tsx.
 *
 * - No intrusivo: un botón chico y neutro en la esquina (encima de la barra inferior en el
 *   celular). Nunca se abre solo; solo muestra un número cuando hay una respuesta sin leer.
 *   No aparece en páginas públicas, /admin ni en la Vista previa de equipo (mismo criterio que
 *   las preguntas cortas, components/feedback/feedback-orchestrator.tsx).
 * - Dos pestañas:
 *   · Chat: el asistente pregunta de qué se trata, sugiere secciones del manual mientras la
 *     persona escribe (public/help/manual-<idioma>.json, lib/support/core.ts searchHelp) y, si
 *     no basta, la manda a soporte. Fila por orden de llegada («Hay N personas antes que tú»),
 *     adjuntos en los formatos que la app ya acepta, respuestas aquí y por correo.
 *   · Ticket: lo mismo que /contacto (sugerencia, queja, reporte de error o experiencia, con
 *     captura opcional) → /api/feedback/submit → Buzón de /admin; la respuesta llega por correo.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { usePathname } from "next/navigation"
import {
  BookOpen,
  Bug,
  CheckCircle2,
  ChevronDown,
  Clock,
  FileText,
  ImagePlus,
  Lightbulb,
  Loader2,
  MessageCircleQuestion,
  MessageCircleWarning,
  Paperclip,
  Send,
  Smile,
  Ticket,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/contexts/auth-context"
import { useLanguage } from "@/contexts/language-context"
import { useToast } from "@/hooks/use-toast"
import { useTeamPreview } from "@/lib/plan-access"
import { isQuiet } from "@/components/feedback/feedback-orchestrator"
import { compressImageToDataUrl } from "@/lib/utils/image-compress"
import { formatDate, formatDateTime } from "@/lib/date-format"
import { cn } from "@/lib/utils"
import {
  ATTACHMENT_ACCEPT,
  MAX_ATTACHMENTS,
  MAX_TOTAL_ATTACHMENT_BYTES,
  SUPPORT_CATEGORIES,
  isAcceptedAttachment,
  searchHelp,
  type HelpEntry,
  type SupportAttachment,
  type SupportCategory,
} from "@/lib/support/core"
import type { TranslationKey } from "@/lib/i18n/translations"

interface Conversation {
  id: string
  category: string
  status: "waiting" | "answered" | "closed"
  user_unread: number
}
interface Message {
  id: string
  sender: "user" | "admin" | "bot"
  body: string
  attachments: SupportAttachment[]
  created_at: string
}
interface ChatState {
  available: boolean
  conversation: Conversation | null
  messages: Message[]
  position: number | null
}

type Tab = "chat" | "ticket"
type TicketType = "sugerencia" | "queja" | "bug" | "experiencia"

const TICKET_TYPES: { value: TicketType; icon: typeof Lightbulb }[] = [
  { value: "bug", icon: Bug },
  { value: "sugerencia", icon: Lightbulb },
  { value: "queja", icon: MessageCircleWarning },
  { value: "experiencia", icon: Smile },
]
const MAX_TICKET_IMAGE_BYTES = 10 * 1024 * 1024 // antes de comprimir, igual que /contacto

/**
 * Abre el panel desde cualquier parte: `window.dispatchEvent(new CustomEvent(SUPPORT_OPEN_EVENT,
 * { detail: { tab: "ticket" } }))`.
 */
export const SUPPORT_OPEN_EVENT = "gm:support:open"

const readFile = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })

export function SupportChat() {
  const { user } = useAuth()
  const pathname = usePathname()
  const { active: previewActive } = useTeamPreview()
  const { t, language } = useLanguage()
  const { toast } = useToast()

  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Tab>("chat")
  const [state, setState] = useState<ChatState | null>(null)
  const [category, setCategory] = useState<SupportCategory | null>(null)
  const [draft, setDraft] = useState("")
  const [files, setFiles] = useState<SupportAttachment[]>([])
  const [sending, setSending] = useState(false)
  const [startNew, setStartNew] = useState(false)
  const [helpIndex, setHelpIndex] = useState<HelpEntry[] | null>(null)
  const [expanded, setExpanded] = useState<number | null>(null)
  // Ticket
  const [ticketType, setTicketType] = useState<TicketType>("bug")
  const [ticketMessage, setTicketMessage] = useState("")
  const [ticketImage, setTicketImage] = useState<string | null>(null)
  const [ticketBusy, setTicketBusy] = useState(false)
  const [ticketSent, setTicketSent] = useState<string | null>(null)

  const fileInput = useRef<HTMLInputElement>(null)
  const ticketFileInput = useRef<HTMLInputElement>(null)
  const textArea = useRef<HTMLTextAreaElement>(null)
  const bottom = useRef<HTMLDivElement>(null)

  const hidden = !user || previewActive || isQuiet(pathname)

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/support", { cache: "no-store" })
      if (!res.ok) return
      setState(await res.json())
    } catch {
      /* sin red: se intenta en la próxima vuelta */
    }
  }, [])

  // Al entrar y cada 2 minutos (cada 20 s con el panel abierto), para la fila y las respuestas.
  useEffect(() => {
    if (hidden) return
    load()
    const id = window.setInterval(load, open ? 20_000 : 120_000)
    return () => window.clearInterval(id)
  }, [hidden, open, load])

  useEffect(() => {
    const onOpen = (e: Event) => {
      const wanted = (e as CustomEvent<{ tab?: Tab }>).detail?.tab
      if (wanted === "ticket" || wanted === "chat") setTab(wanted)
      setOpen(true)
    }
    window.addEventListener(SUPPORT_OPEN_EVENT, onOpen)
    return () => window.removeEventListener(SUPPORT_OPEN_EVENT, onOpen)
  }, [])

  // Escape cierra el panel.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  // Índice del manual en el idioma de la cuenta (se baja solo al abrir el panel).
  useEffect(() => {
    if (!open) return
    let cancelled = false
    fetch(`/help/manual-${language}.json`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => !cancelled && setHelpIndex(Array.isArray(data) ? data : []))
      .catch(() => !cancelled && setHelpIndex([]))
    return () => {
      cancelled = true
    }
  }, [open, language])

  const conversation = state?.conversation ?? null
  const unread = conversation?.user_unread ?? 0
  const showThread = !!conversation && !(conversation.status === "closed" && startNew)
  const activeCategory = (showThread && conversation?.status !== "closed" ? (conversation?.category as SupportCategory) : category) ?? null

  // Marca leída la respuesta del dueño cuando la persona abre el chat.
  useEffect(() => {
    if (!open || tab !== "chat" || !conversation || unread === 0) return
    fetch("/api/support", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "read", conversationId: conversation.id }) })
      .then(() => setState((s) => (s?.conversation ? { ...s, conversation: { ...s.conversation, user_unread: 0 } } : s)))
      .catch(() => {})
  }, [open, tab, conversation, unread])

  useEffect(() => {
    if (open && tab === "chat") bottom.current?.scrollIntoView({ block: "end" })
  }, [open, tab, state?.messages.length, showThread])

  // El cuadro de texto crece con lo escrito (hasta 5 líneas).
  useEffect(() => {
    const el = textArea.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }, [draft, open, tab])

  const suggestions = useMemo(() => {
    if (!helpIndex || !activeCategory || showThread) return []
    if (draft.trim().length < 4) return activeCategory === "sugerencia" || activeCategory === "otro" ? [] : searchHelp(helpIndex, "", activeCategory, 3)
    return searchHelp(helpIndex, draft, activeCategory, 3)
  }, [helpIndex, draft, activeCategory, showThread])

  // Que se vean las sugerencias del manual apenas aparecen o cambian.
  const suggestionKey = suggestions.map((s) => s.section).join("|")
  useEffect(() => {
    if (open && suggestionKey) bottom.current?.scrollIntoView({ block: "end", behavior: "smooth" })
  }, [open, suggestionKey])

  if (hidden) return null

  // ─── Chat ───

  const addFiles = async (list: FileList | null) => {
    if (!list) return
    const next = [...files]
    for (const file of Array.from(list)) {
      if (next.length >= MAX_ATTACHMENTS) {
        toast({ title: t("support_attach_too_many"), variant: "destructive" })
        break
      }
      try {
        if (file.type.startsWith("image/") && !/gif$/.test(file.type)) {
          const data = await compressImageToDataUrl(file)
          next.push({ name: file.name.replace(/\.[^.]+$/, "") + ".jpg", type: "image/jpeg", size: Math.floor((data.length * 3) / 4), data })
        } else if (isAcceptedAttachment(file)) {
          next.push({ name: file.name, type: file.type, size: file.size, data: await readFile(file) })
        } else {
          toast({ title: t("support_attach_invalid"), description: file.name, variant: "destructive" })
        }
      } catch {
        toast({ title: t("support_attach_invalid"), description: file.name, variant: "destructive" })
      }
    }
    // Tope entre todos los adjuntos (Vercel corta los pedidos grandes).
    while (next.reduce((n, f) => n + f.size, 0) > MAX_TOTAL_ATTACHMENT_BYTES) {
      const dropped = next.pop()
      toast({ title: t("support_attach_invalid"), description: dropped?.name, variant: "destructive" })
    }
    setFiles(next)
    if (fileInput.current) fileInput.current.value = ""
  }

  const send = async () => {
    const body = draft.trim()
    if (!body && !files.length) return
    setSending(true)
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: activeCategory ?? "otro", body, attachments: files, page: pathname, language }),
      })
      const data = await res.json().catch(() => null)
      if (res.status === 429) throw new Error(t("support_too_many"))
      if (!res.ok || !data?.available) throw new Error(t("support_send_error"))
      setState(data)
      setDraft("")
      setFiles([])
      setStartNew(false)
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : t("support_send_error"), variant: "destructive" })
    } finally {
      setSending(false)
    }
  }

  const closeConversation = async () => {
    if (!conversation) return
    await fetch("/api/support", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "close", conversationId: conversation.id }) }).catch(() => {})
    setStartNew(true)
    setCategory(null)
    load()
  }

  // ─── Ticket (igual que /contacto) ───

  const pickTicketImage = async (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast({ title: t("contacto_toast_invalid_file_title"), description: t("contacto_toast_invalid_file_desc"), variant: "destructive" })
      return
    }
    if (file.size > MAX_TICKET_IMAGE_BYTES) {
      toast({ title: t("contacto_toast_too_large_title"), description: t("contacto_toast_too_large_desc"), variant: "destructive" })
      return
    }
    try {
      setTicketImage(await compressImageToDataUrl(file))
    } catch {
      toast({ title: t("contacto_toast_image_error_title"), description: t("contacto_toast_image_error_desc"), variant: "destructive" })
    } finally {
      if (ticketFileInput.current) ticketFileInput.current.value = ""
    }
  }

  const sendTicket = async () => {
    if (!ticketMessage.trim()) {
      toast({ title: t("contacto_toast_missing_message_title"), description: t("contacto_toast_missing_message_desc"), variant: "destructive" })
      return
    }
    setTicketBusy(true)
    try {
      const res = await fetch("/api/feedback/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: ticketType,
          message: ticketMessage.trim(),
          userName: user?.name,
          userEmail: user?.email,
          page: pathname,
          imageDataUrl: ticketImage || undefined,
          language,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.id) throw new Error()
      setTicketSent(String(data.id))
      setTicketMessage("")
      setTicketImage(null)
    } catch {
      toast({ title: t("contacto_toast_send_error_title"), description: t("contacto_toast_send_error_desc"), variant: "destructive" })
    } finally {
      setTicketBusy(false)
    }
  }

  // ─── Vista ───

  const position = state?.position ?? 0
  const queueText = position === 0 ? t("support_queue_next") : position === 1 ? t("support_queue_one") : t("support_queue_many").replace("{n}", String(position))
  const manualHref = `/api/manual?v=${(process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || "dev").slice(0, 7)}`
  const canWrite = showThread ? conversation?.status !== "closed" : !!category
  const shortTicket = (id: string) => `#${id.split("-").pop()?.toUpperCase() ?? id}`

  const BotBubble = ({ children }: { children: ReactNode }) => (
    <div className="flex items-end gap-2">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-text-4">
        <MessageCircleQuestion className="h-4 w-4" />
      </span>
      <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-muted px-3 py-2">{children}</div>
    </div>
  )

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t("support_open")}
          title={t("support_open")}
          className="fixed right-3 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-text-4 shadow-md transition hover:-translate-y-0.5 hover:text-foreground hover:shadow-lg md:bottom-5 md:right-5 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] print:hidden"
          data-tour="support-chat"
        >
          <MessageCircleQuestion className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">{unread}</span>
          )}
        </button>
      )}

      {open && (
        <div
          role="dialog"
          aria-label={t("support_title")}
          className="fixed right-3 z-50 flex h-[min(600px,calc(100dvh-7rem))] w-[calc(100vw-1.5rem)] max-w-[400px] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-200 md:bottom-5 md:right-5 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] print:hidden"
        >
          {/* Encabezado */}
          <div className="border-b border-border px-4 pb-3 pt-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
                  <MessageCircleQuestion className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-tight">{t("support_title")}</p>
                  <p className="truncate text-xs text-muted-foreground">{tab === "chat" ? t("support_subtitle") : t("support_ticket_subtitle")}</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" className="h-8 w-8 shrink-0 p-0" onClick={() => setOpen(false)} aria-label={t("support_close_panel")}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div role="tablist" className="mt-3 grid grid-cols-2 gap-1 rounded-lg bg-muted p-1 text-xs font-medium">
              {(["chat", "ticket"] as Tab[]).map((k) => (
                <button
                  key={k}
                  role="tab"
                  type="button"
                  aria-selected={tab === k}
                  onClick={() => setTab(k)}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 transition-colors",
                    tab === k ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {k === "chat" ? <MessageCircleQuestion className="h-3.5 w-3.5" /> : <Ticket className="h-3.5 w-3.5" />}
                  {k === "chat" ? t("support_tab_chat") : t("support_tab_ticket")}
                  {k === "chat" && unread > 0 && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
                </button>
              ))}
            </div>
          </div>

          {tab === "chat" ? (
            <>
              {/* Estado de la conversación */}
              {showThread && conversation && (
                <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
                  {conversation.status === "waiting" ? <Clock className="h-3.5 w-3.5 shrink-0" /> : <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />}
                  <span className="min-w-0 flex-1">
                    {conversation.status === "waiting" ? queueText : conversation.status === "answered" ? t("support_status_answered") : t("support_status_closed")}
                  </span>
                  <span className="shrink-0 rounded-full border border-border bg-card px-2 py-0.5 text-[10px]">{t(`support_cat_${conversation.category}` as TranslationKey)}</span>
                </div>
              )}

              <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4 text-sm">
                {state && !state.available ? (
                  <BotBubble>
                    {t("support_unavailable")}{" "}
                    <button type="button" className="underline" onClick={() => setTab("ticket")}>
                      {t("support_unavailable_ticket")}
                    </button>
                  </BotBubble>
                ) : !state ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : showThread ? (
                  <>
                    {state.messages.map((m, i) => {
                      const day = formatDate(m.created_at)
                      const newDay = i === 0 || formatDate(state.messages[i - 1].created_at) !== day
                      const mine = m.sender === "user"
                      return (
                        <div key={m.id} className="space-y-3">
                          {newDay && <p className="text-center text-[11px] text-muted-foreground">{day}</p>}
                          {mine ? (
                            <div className="flex justify-end">
                              <div className="max-w-[85%] rounded-2xl rounded-br-md bg-foreground px-3 py-2 text-background">
                                {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
                                <Attachments items={m.attachments} />
                                <p className="mt-1 text-right text-[10px] opacity-60">{formatDateTime(m.created_at).split(" ").pop()}</p>
                              </div>
                            </div>
                          ) : (
                            <BotBubble>
                              <p className="mb-0.5 text-[11px] font-medium text-muted-foreground">{t("support_from_team")}</p>
                              {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
                              <Attachments items={m.attachments} />
                              <p className="mt-1 text-[10px] text-muted-foreground">{formatDateTime(m.created_at).split(" ").pop()}</p>
                            </BotBubble>
                          )}
                        </div>
                      )
                    })}
                    {conversation?.status === "closed" && (
                      <Button variant="outline" size="sm" className="w-full" onClick={() => setStartNew(true)}>
                        {t("support_new_conversation")}
                      </Button>
                    )}
                  </>
                ) : (
                  <>
                    <BotBubble>
                      <p className="mb-0.5 text-[11px] font-medium text-muted-foreground">{t("support_bot_name")}</p>
                      <p>{t("support_bot_greeting")}</p>
                    </BotBubble>
                    <div className="grid grid-cols-2 gap-1.5 pl-9">
                      {SUPPORT_CATEGORIES.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setCategory(c.id)
                            setExpanded(null)
                            window.setTimeout(() => textArea.current?.focus(), 50)
                          }}
                          aria-pressed={category === c.id}
                          className={cn(
                            "rounded-lg border px-2.5 py-2 text-left text-xs leading-tight transition-colors",
                            category === c.id ? "border-foreground bg-foreground text-background" : "border-border bg-card hover:bg-muted",
                          )}
                        >
                          {t(`support_cat_${c.id}` as TranslationKey)}
                        </button>
                      ))}
                    </div>
                    {category && (
                      <BotBubble>
                        <p>{category === "error" ? t("support_bot_ask_error") : category === "sugerencia" ? t("support_bot_ask_idea") : t("support_bot_ask")}</p>
                      </BotBubble>
                    )}
                    {suggestions.length > 0 && (
                      <div className="space-y-1.5 pl-9">
                        <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                          <BookOpen className="h-3.5 w-3.5" />
                          {t("support_manual_suggest")}
                        </p>
                        {suggestions.map((s, i) => (
                          <div key={`${s.chapterId}-${s.section}`} className="overflow-hidden rounded-lg border border-border bg-card">
                            <button type="button" className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-muted/50" onClick={() => setExpanded(expanded === i ? null : i)} aria-expanded={expanded === i}>
                              <span className="min-w-0 flex-1">
                                <span className="block text-[11px] text-muted-foreground">{s.chapter}</span>
                                <span className="block font-medium leading-snug">{s.section}</span>
                              </span>
                              <ChevronDown className={cn("mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform", expanded === i && "rotate-180")} />
                            </button>
                            {expanded === i && <p className="whitespace-pre-wrap border-t border-border px-3 py-2 text-xs leading-relaxed text-muted-foreground">{s.text}</p>}
                          </div>
                        ))}
                        <div className="flex flex-wrap gap-x-3 gap-y-1">
                          <a href={manualHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs underline">
                            <FileText className="h-3.5 w-3.5" />
                            {t("support_manual_download")}
                          </a>
                        </div>
                      </div>
                    )}
                    {category && (
                      <p className="pl-9 text-[11px] text-muted-foreground">
                        {t("support_prefer_ticket")}{" "}
                        <button type="button" className="underline" onClick={() => setTab("ticket")}>
                          {t("support_tab_ticket")}
                        </button>
                      </p>
                    )}
                  </>
                )}
                <div ref={bottom} />
              </div>

              {state?.available && canWrite && (
                <div className="border-t border-border p-3">
                  {files.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {files.map((f, i) => (
                        <span key={i} className="inline-flex max-w-full items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs">
                          <Paperclip className="h-3 w-3 shrink-0" />
                          <span className="truncate">{f.name}</span>
                          <button type="button" aria-label={t("support_attach_remove")} onClick={() => setFiles(files.filter((_, j) => j !== i))}>
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex items-end gap-1.5 rounded-xl border border-border bg-background px-1.5 py-1.5 focus-within:ring-2 focus-within:ring-ring/30">
                    <input ref={fileInput} type="file" accept={ATTACHMENT_ACCEPT} multiple className="hidden" onChange={(e) => addFiles(e.target.files)} />
                    <Button type="button" variant="ghost" size="sm" className="h-8 w-8 shrink-0 p-0" onClick={() => fileInput.current?.click()} aria-label={t("support_attach")} title={t("support_attach_hint")}>
                      <Paperclip className="h-4 w-4" />
                    </Button>
                    <Textarea
                      ref={textArea}
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey && !sending && window.matchMedia("(pointer: fine)").matches) {
                          e.preventDefault()
                          send()
                        }
                      }}
                      placeholder={t("support_placeholder")}
                      aria-label={t("support_placeholder")}
                      rows={1}
                      maxLength={4000}
                      className="min-h-[32px] flex-1 resize-none border-0 bg-transparent px-1 py-1.5 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 w-8 shrink-0 rounded-lg p-0"
                      onClick={send}
                      disabled={sending || (!draft.trim() && !files.length)}
                      aria-label={showThread ? t("support_send") : t("support_send_to_team")}
                      title={showThread ? t("support_send") : t("support_send_to_team")}
                    >
                      {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                    <span className="truncate">{showThread ? t("support_attach_hint") : t("support_send_hint")}</span>
                    {showThread && conversation && conversation.status !== "closed" && (
                      <button type="button" className="shrink-0 underline hover:text-foreground" onClick={closeConversation}>
                        {t("support_resolved")}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : ticketSent ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
              <CheckCircle2 className="h-10 w-10 text-foreground" />
              <p className="text-base font-semibold">{t("support_ticket_sent_title")}</p>
              <p className="text-sm text-muted-foreground">
                {t("support_ticket_sent_desc").replace("{id}", shortTicket(ticketSent)).replace("{email}", user?.email ?? "")}
              </p>
              <div className="mt-2 flex flex-wrap justify-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setTicketSent(null)}>
                  {t("support_ticket_another")}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setTab("chat")}>
                  {t("support_back_to_chat")}
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 text-sm">
                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">{t("contacto_type_label")}</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {TICKET_TYPES.map(({ value, icon: Icon }) => (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={ticketType === value}
                        onClick={() => setTicketType(value)}
                        className={cn(
                          "flex items-start gap-2 rounded-lg border p-2.5 text-left transition-colors",
                          ticketType === value ? "border-foreground bg-muted" : "border-border hover:bg-muted/60",
                        )}
                      >
                        <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                        <span className="min-w-0">
                          <span className="block text-xs font-medium leading-tight">{t(`contacto_type_${value}_label` as TranslationKey)}</span>
                          <span className="mt-0.5 block text-[11px] leading-tight text-muted-foreground">{t(`contacto_type_${value}_desc` as TranslationKey)}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label htmlFor="support-ticket-message" className="mb-2 block text-xs font-medium text-muted-foreground">
                    {t("support_ticket_message_label")}
                  </label>
                  <Textarea
                    id="support-ticket-message"
                    value={ticketMessage}
                    onChange={(e) => setTicketMessage(e.target.value)}
                    placeholder={ticketType === "bug" ? t("support_ticket_ph_bug") : t("support_ticket_ph")}
                    rows={5}
                    maxLength={5000}
                    className="resize-none text-sm"
                  />
                </div>
                <div>
                  <input ref={ticketFileInput} type="file" accept="image/*" className="hidden" onChange={(e) => pickTicketImage(e.target.files?.[0])} />
                  {ticketImage ? (
                    <div className="relative inline-block">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={ticketImage} alt={t("support_ticket_screenshot")} className="h-24 rounded-lg border border-border object-cover" />
                      <button
                        type="button"
                        onClick={() => setTicketImage(null)}
                        aria-label={t("support_attach_remove")}
                        className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card shadow"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => ticketFileInput.current?.click()}>
                      <ImagePlus className="h-4 w-4" />
                      {t("support_ticket_screenshot")}
                    </Button>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">{t("support_ticket_reply_to").replace("{email}", user?.email ?? "")}</p>
              </div>
              <div className="border-t border-border p-3">
                <Button type="button" className="w-full gap-1.5" onClick={sendTicket} disabled={ticketBusy || !ticketMessage.trim()}>
                  {ticketBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ticket className="h-4 w-4" />}
                  {t("support_ticket_send")}
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  )
}

/** Fotos como miniatura; documentos como descarga (nunca se abren como página). */
export function Attachments({ items }: { items: SupportAttachment[] | null | undefined }) {
  if (!items?.length) return null
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {items.map((a, i) =>
        /^data:image\/(png|jpe?g|webp|gif);base64,/.test(a.data) ? (
          <a key={i} href={a.data} download={a.name} title={a.name}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={a.data} alt={a.name} className="h-20 w-20 rounded-md border border-border object-cover" />
          </a>
        ) : (
          <a key={i} href={a.data} download={a.name} className="inline-flex max-w-full items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground underline">
            <FileText className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{a.name}</span>
          </a>
        ),
      )}
    </div>
  )
}
