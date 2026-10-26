"use client"

/**
 * Chat de soporte dentro de la app (pedido del dueño, docs/204). Montado en app/layout.tsx.
 *
 * - No intrusivo: un botón chico y neutro en la esquina (encima de la barra inferior en el
 *   celular). Nunca se abre solo; solo muestra un punto cuando hay una respuesta sin leer.
 *   No aparece en páginas públicas, /admin ni en la Vista previa de equipo (mismo criterio que
 *   las preguntas cortas, components/feedback/feedback-orchestrator.tsx).
 * - Bot: pregunta de qué se trata (Ficha Técnica, Ingredientes…), y mientras la persona escribe
 *   le sugiere las secciones del manual que responden su duda (public/help/manual-<idioma>.json,
 *   lib/support/core.ts searchHelp) con el PDF del manual para descargar. Si no le basta, la
 *   manda a soporte.
 * - Fila por orden de llegada: «Hay N personas antes que tú».
 * - Adjuntos: fotos (se comprimen) y documentos en los formatos que la app ya acepta.
 * - Respuestas del dueño: llegan aquí y por correo (lib/services/support.ts).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { BookOpen, CheckCircle2, Clock, FileText, Loader2, MessageCircleQuestion, Paperclip, Send, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/contexts/auth-context"
import { useLanguage } from "@/contexts/language-context"
import { useToast } from "@/hooks/use-toast"
import { useTeamPreview } from "@/lib/plan-access"
import { isQuiet } from "@/components/feedback/feedback-orchestrator"
import { compressImageToDataUrl } from "@/lib/utils/image-compress"
import { formatDateTime } from "@/lib/date-format"
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

/** Pregunta el panel al abrir (`gm:support:open`), p. ej. desde Ajustes o la página de Contacto. */
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
  const [state, setState] = useState<ChatState | null>(null)
  const [category, setCategory] = useState<SupportCategory | null>(null)
  const [draft, setDraft] = useState("")
  const [files, setFiles] = useState<SupportAttachment[]>([])
  const [sending, setSending] = useState(false)
  const [startNew, setStartNew] = useState(false)
  const [helpIndex, setHelpIndex] = useState<HelpEntry[] | null>(null)
  const [expanded, setExpanded] = useState<number | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
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
    const onOpen = () => setOpen(true)
    window.addEventListener(SUPPORT_OPEN_EVENT, onOpen)
    return () => window.removeEventListener(SUPPORT_OPEN_EVENT, onOpen)
  }, [])

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

  // Marca leída la respuesta del dueño cuando la persona abre el panel.
  useEffect(() => {
    if (!open || !conversation || unread === 0) return
    fetch("/api/support", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "read", conversationId: conversation.id }) })
      .then(() => setState((s) => (s?.conversation ? { ...s, conversation: { ...s.conversation, user_unread: 0 } } : s)))
      .catch(() => {})
  }, [open, conversation, unread])

  useEffect(() => {
    if (open) bottom.current?.scrollIntoView({ block: "end" })
  }, [open, state?.messages.length, showThread])

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

  const statusLine = () => {
    if (!conversation || !showThread) return null
    if (conversation.status === "waiting") {
      const n = state?.position ?? 0
      return (
        <span className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          {n === 0 ? t("support_queue_next") : n === 1 ? t("support_queue_one") : t("support_queue_many").replace("{n}", String(n))}
        </span>
      )
    }
    if (conversation.status === "answered")
      return (
        <span className="flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5" />
          {t("support_status_answered")}
        </span>
      )
    return <span>{t("support_status_closed")}</span>
  }

  const manualHref = `/api/manual?v=${(process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || "dev").slice(0, 7)}`
  const canWrite = showThread ? conversation?.status !== "closed" : !!category

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t("support_open")}
          title={t("support_open")}
          className="fixed right-3 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-text-4 shadow-md transition-colors hover:text-foreground md:bottom-5 md:right-5 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] print:hidden"
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
          className="fixed right-3 z-50 flex h-[min(560px,calc(100dvh-7rem))] w-[calc(100vw-1.5rem)] max-w-sm flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xl md:bottom-5 md:right-5 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] print:hidden"
        >
          <div className="flex items-start justify-between gap-2 border-b border-border px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold">{t("support_title")}</p>
              <div className="text-xs text-muted-foreground">{statusLine() ?? t("support_subtitle")}</div>
            </div>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setOpen(false)} aria-label={t("support_close_panel")}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3 text-sm">
            {state && !state.available ? (
              <p className="text-muted-foreground">
                {t("support_unavailable")}{" "}
                <a href="/contacto" className="underline">
                  {t("support_unavailable_link")}
                </a>
              </p>
            ) : !state ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : showThread ? (
              <>
                {state.messages.map((m) => (
                  <div key={m.id} className={cn("flex", m.sender === "user" ? "justify-end" : "justify-start")}>
                    <div className={cn("max-w-[85%] rounded-2xl px-3 py-2", m.sender === "user" ? "bg-muted" : "border border-border")}>
                      {m.sender !== "user" && <p className="mb-0.5 text-[11px] font-medium text-muted-foreground">{t("support_from_team")}</p>}
                      {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
                      <Attachments items={m.attachments} />
                      <p className="mt-1 text-[10px] text-muted-foreground">{formatDateTime(m.created_at)}</p>
                    </div>
                  </div>
                ))}
                {conversation?.status === "closed" && (
                  <Button variant="outline" size="sm" className="w-full" onClick={() => setStartNew(true)}>
                    {t("support_new_conversation")}
                  </Button>
                )}
              </>
            ) : (
              <>
                <div className="rounded-2xl border border-border px-3 py-2">
                  <p className="mb-0.5 text-[11px] font-medium text-muted-foreground">{t("support_bot_name")}</p>
                  <p>{t("support_bot_greeting")}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {SUPPORT_CATEGORIES.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setCategory(c.id)}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs transition-colors",
                        category === c.id ? "border-foreground bg-foreground text-background" : "border-border hover:bg-muted",
                      )}
                    >
                      {t(`support_cat_${c.id}` as TranslationKey)}
                    </button>
                  ))}
                </div>
                {category && (
                  <div className="rounded-2xl border border-border px-3 py-2">
                    <p className="mb-0.5 text-[11px] font-medium text-muted-foreground">{t("support_bot_name")}</p>
                    <p>{category === "error" ? t("support_bot_ask_error") : category === "sugerencia" ? t("support_bot_ask_idea") : t("support_bot_ask")}</p>
                  </div>
                )}
                {suggestions.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <BookOpen className="h-3.5 w-3.5" />
                      {t("support_manual_suggest")}
                    </p>
                    {suggestions.map((s, i) => (
                      <div key={`${s.chapterId}-${s.section}`} className="rounded-lg border border-border">
                        <button type="button" className="w-full px-3 py-2 text-left" onClick={() => setExpanded(expanded === i ? null : i)} aria-expanded={expanded === i}>
                          <p className="text-xs text-muted-foreground">{s.chapter}</p>
                          <p className="font-medium">{s.section}</p>
                        </button>
                        {expanded === i && <p className="whitespace-pre-wrap border-t border-border px-3 py-2 text-xs leading-relaxed text-muted-foreground">{s.text}</p>}
                      </div>
                    ))}
                    <a href={manualHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs underline">
                      <FileText className="h-3.5 w-3.5" />
                      {t("support_manual_download")}
                    </a>
                  </div>
                )}
              </>
            )}
            <div ref={bottom} />
          </div>

          {state?.available && canWrite && (
            <div className="space-y-2 border-t border-border p-3">
              {files.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {files.map((f, i) => (
                    <span key={i} className="inline-flex max-w-full items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs">
                      <span className="truncate">{f.name}</span>
                      <button type="button" aria-label={t("support_attach_remove")} onClick={() => setFiles(files.filter((_, j) => j !== i))}>
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <Textarea
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
                rows={2}
                maxLength={4000}
                className="min-h-[60px] resize-none text-sm"
              />
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  <input ref={fileInput} type="file" accept={ATTACHMENT_ACCEPT} multiple className="hidden" onChange={(e) => addFiles(e.target.files)} />
                  <Button type="button" variant="ghost" size="sm" className="h-8 gap-1 px-2 text-xs" onClick={() => fileInput.current?.click()} title={t("support_attach_hint")}>
                    <Paperclip className="h-4 w-4" />
                    {t("support_attach")}
                  </Button>
                  {showThread && conversation && conversation.status !== "closed" && (
                    <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={closeConversation}>
                      {t("support_resolved")}
                    </Button>
                  )}
                </div>
                <Button type="button" size="sm" className="h-8 gap-1" onClick={send} disabled={sending || (!draft.trim() && !files.length)}>
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {showThread ? t("support_send") : t("support_send_to_team")}
                </Button>
              </div>
            </div>
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
          <a key={i} href={a.data} download={a.name} className="inline-flex max-w-full items-center gap-1 rounded-md border border-border px-2 py-1 text-xs underline">
            <FileText className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{a.name}</span>
          </a>
        ),
      )}
    </div>
  )
}
