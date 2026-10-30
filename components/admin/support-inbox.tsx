"use client"

/**
 * /admin → Buzón y reseñas → Chat (docs/204): bandeja tipo Messenger.
 * Izquierda, una fila por conversación (persona, tema, último mensaje, lugar en la fila, sin
 * leer); derecha, el hilo con respuesta, adjuntos y estado. Responder manda también un correo
 * a la persona en su idioma. Se actualiza cada 20 s.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ArrowLeft, Loader2, Paperclip, Send, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useLanguage } from "@/contexts/language-context"
import { useToast } from "@/hooks/use-toast"
import { Attachments } from "@/components/support-chat"
import { compressImageToDataUrl } from "@/lib/utils/image-compress"
import { formatDateTime } from "@/lib/date-format"
import { cn } from "@/lib/utils"
import { ATTACHMENT_ACCEPT, MAX_ATTACHMENTS, MAX_TOTAL_ATTACHMENT_BYTES, isAcceptedAttachment, type SupportAttachment } from "@/lib/support/core"
import type { TranslationKey } from "@/lib/i18n/translations"
import { AccountLink } from "@/components/admin/account-link"

interface Row {
  id: string
  account_id: string
  email: string | null
  category: string
  status: "waiting" | "answered" | "closed"
  page: string | null
  language: string
  admin_unread: number
  last_message_at: string
  last_message_preview: string
  position: number | null
}
interface Message {
  id: string
  sender: "user" | "admin" | "bot"
  body: string
  attachments: SupportAttachment[]
  created_at: string
}

type Filter = "all" | "waiting" | "answered" | "closed"

const readFile = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })

export function SupportInbox({ onWaitingChange }: { onWaitingChange?: (n: number) => void }) {
  const { t } = useLanguage()
  const { toast } = useToast()
  const [rows, setRows] = useState<Row[] | null>(null)
  const [available, setAvailable] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loadingThread, setLoadingThread] = useState(false)
  const [filter, setFilter] = useState<Filter>("all")
  const [search, setSearch] = useState("")
  const [draft, setDraft] = useState("")
  const [files, setFiles] = useState<SupportAttachment[]>([])
  const [sending, setSending] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const bottom = useRef<HTMLDivElement>(null)

  const loadList = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/support", { cache: "no-store" })
      if (!res.ok) return
      const data = await res.json()
      setAvailable(data.available !== false)
      setRows(data.conversations ?? [])
    } catch {
      /* se reintenta en la próxima vuelta */
    }
  }, [])

  const loadThread = useCallback(async (id: string, quiet = false) => {
    if (!quiet) setLoadingThread(true)
    try {
      const res = await fetch(`/api/admin/support/${id}`, { cache: "no-store" })
      if (res.ok) setMessages((await res.json()).messages ?? [])
    } finally {
      if (!quiet) setLoadingThread(false)
    }
  }, [])

  useEffect(() => {
    loadList()
    const iv = window.setInterval(() => {
      loadList()
      if (selected) loadThread(selected, true)
    }, 20_000)
    return () => window.clearInterval(iv)
  }, [loadList, loadThread, selected])

  useEffect(() => {
    onWaitingChange?.(rows?.filter((r) => r.status === "waiting").length ?? 0)
  }, [rows, onWaitingChange])

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" })
  }, [messages.length, selected])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (rows ?? [])
      .filter((r) => filter === "all" || r.status === filter)
      .filter((r) => !q || (r.email ?? "").toLowerCase().includes(q) || r.last_message_preview.toLowerCase().includes(q))
  }, [rows, filter, search])

  const current = rows?.find((r) => r.id === selected) ?? null

  const open = (id: string) => {
    setSelected(id)
    setDraft("")
    setFiles([])
    loadThread(id)
    setRows((rs) => rs?.map((r) => (r.id === id ? { ...r, admin_unread: 0 } : r)) ?? rs)
  }

  const addFiles = async (list: FileList | null) => {
    if (!list) return
    const next = [...files]
    for (const file of Array.from(list)) {
      if (next.length >= MAX_ATTACHMENTS) break
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

  const reply = async () => {
    if (!selected || (!draft.trim() && !files.length)) return
    setSending(true)
    try {
      const res = await fetch(`/api/admin/support/${selected}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: draft.trim(), attachments: files }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error()
      setDraft("")
      setFiles([])
      toast({ title: data?.emailSent ? t("admin_support_sent_email") : t("admin_support_sent_no_email") })
      await Promise.all([loadThread(selected, true), loadList()])
    } catch {
      toast({ title: t("support_send_error"), variant: "destructive" })
    } finally {
      setSending(false)
    }
  }

  const setStatus = async (status: Row["status"]) => {
    if (!selected) return
    const res = await fetch(`/api/admin/support/${selected}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) }).catch(() => null)
    if (!res?.ok) {
      toast({ title: t("support_send_error"), variant: "destructive" })
      return
    }
    loadList()
  }

  if (!available) return <p className="text-sm text-muted-foreground">{t("admin_support_unavailable")}</p>
  if (!rows) return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />

  const statusLabel = (r: Row) =>
    r.status === "waiting" ? t("admin_support_waiting_pos").replace("{n}", String((r.position ?? 0) + 1)) : r.status === "answered" ? t("admin_support_status_answered") : t("admin_support_status_closed")

  return (
    <div className="grid overflow-hidden rounded-xl border border-border md:grid-cols-[320px_1fr]" style={{ height: "min(680px, 75vh)" }}>
      {/* Lista */}
      <div className={cn("flex min-h-0 flex-col border-border md:border-r", selected && "hidden md:flex")}>
        <div className="space-y-2 border-b border-border p-3">
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("admin_support_search")} aria-label={t("admin_support_search")} className="h-9" />
          <div className="flex flex-wrap gap-1">
            {(["all", "waiting", "answered", "closed"] as Filter[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={cn("rounded-full border px-2.5 py-0.5 text-xs", filter === f ? "border-foreground bg-foreground text-background" : "border-border hover:bg-muted")}
              >
                {t(`admin_support_filter_${f}` as TranslationKey)}
                {f === "waiting" && ` (${rows.filter((r) => r.status === "waiting").length})`}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {visible.length === 0 && <p className="p-4 text-sm text-muted-foreground">{t("admin_support_empty")}</p>}
          {visible.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => open(r.id)}
              className={cn("flex w-full flex-col gap-0.5 border-b border-border px-3 py-2.5 text-left transition-colors hover:bg-muted/60", selected === r.id && "bg-muted")}
            >
              <div className="flex items-center justify-between gap-2">
                <span className={cn("truncate text-sm", r.admin_unread > 0 ? "font-semibold" : "font-medium")}>{r.email ?? r.account_id.slice(0, 8)}</span>
                <span className="shrink-0 text-[11px] text-muted-foreground">{formatDateTime(r.last_message_at)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-xs text-muted-foreground">{r.last_message_preview || "—"}</span>
                {r.admin_unread > 0 && <span className="shrink-0 rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">{r.admin_unread}</span>}
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="rounded bg-muted px-1.5">{t(`support_cat_${r.category}` as TranslationKey)}</span>
                <span>{statusLabel(r)}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Hilo */}
      <div className={cn("flex min-h-0 flex-col", !selected && "hidden md:flex")}>
        {!current ? (
          <p className="m-auto p-6 text-sm text-muted-foreground">{t("admin_support_pick")}</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2.5">
              <div className="flex min-w-0 items-center gap-2">
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 md:hidden" onClick={() => setSelected(null)} aria-label={t("admin_support_back")}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold"><AccountLink email={current.email} userId={current.account_id}>{current.email ?? current.account_id.slice(0, 8)}</AccountLink></p>
                  <p className="truncate text-xs text-muted-foreground">
                    {t(`support_cat_${current.category}` as TranslationKey)} · {current.language.toUpperCase()}
                    {current.page ? ` · ${current.page}` : ""} · {statusLabel(current)}
                  </p>
                </div>
              </div>
              <div className="flex gap-1">
                {current.status !== "closed" ? (
                  <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setStatus("closed")}>
                    {t("admin_support_close")}
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setStatus("waiting")}>
                    {t("admin_support_reopen")}
                  </Button>
                )}
              </div>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3 text-sm">
              {loadingThread ? (
                <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
              ) : (
                messages.map((m) => (
                  <div key={m.id} className={cn("flex", m.sender === "admin" ? "justify-end" : "justify-start")}>
                    <div className={cn("max-w-[80%] rounded-2xl px-3 py-2", m.sender === "admin" ? "bg-primary/10" : "bg-muted")}>
                      {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
                      <Attachments items={m.attachments} />
                      <p className="mt-1 text-[10px] text-muted-foreground">{formatDateTime(m.created_at)}</p>
                    </div>
                  </div>
                ))
              )}
              <div ref={bottom} />
            </div>
            <div className="space-y-2 border-t border-border p-3">
              {files.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {files.map((f, i) => (
                    <span key={i} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs">
                      {f.name}
                      <button type="button" aria-label={t("support_attach_remove")} onClick={() => setFiles(files.filter((_, j) => j !== i))}>
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={t("admin_support_reply_placeholder")} aria-label={t("admin_support_reply_placeholder")} rows={3} className="resize-none text-sm" />
              <div className="flex items-center justify-between">
                <input ref={fileInput} type="file" accept={ATTACHMENT_ACCEPT} multiple className="hidden" onChange={(e) => addFiles(e.target.files)} />
                <Button type="button" variant="ghost" size="sm" className="h-8 gap-1 px-2 text-xs" onClick={() => fileInput.current?.click()}>
                  <Paperclip className="h-4 w-4" />
                  {t("support_attach")}
                </Button>
                <Button type="button" size="sm" className="h-8 gap-1" onClick={reply} disabled={sending || (!draft.trim() && !files.length)}>
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {t("admin_support_reply")}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
