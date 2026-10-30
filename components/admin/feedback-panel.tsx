"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"
import { Textarea } from "@/components/ui/textarea"
import { useLanguage } from "@/contexts/language-context"
import type { Feedback, FeedbackStatus, FeedbackType } from "@/types/feedback"
import { Archive, ArchiveRestore, Bug, Inbox, Lightbulb, MessageCircleWarning, Smile, Trash2 } from "lucide-react"
import { formatDateTime } from "@/lib/date-format"
import { useAdminLiveReload } from "@/components/admin/live"
import { AccountLink } from "@/components/admin/account-link"

const typeConfigDefs: Record<FeedbackType, { labelKey: "admin_type_suggestion" | "admin_type_complaint" | "admin_type_bug" | "admin_type_experience"; icon: typeof Lightbulb; color: string }> = {
  sugerencia: { labelKey: "admin_type_suggestion", icon: Lightbulb, color: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  queja: { labelKey: "admin_type_complaint", icon: MessageCircleWarning, color: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  bug: { labelKey: "admin_type_bug", icon: Bug, color: "bg-red-500/10 text-red-600 dark:text-red-400" },
  experiencia: { labelKey: "admin_type_experience", icon: Smile, color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
}

const statusLabelKeys: Record<FeedbackStatus, "admin_status_new" | "admin_status_reviewed" | "admin_status_resolved"> = {
  nuevo: "admin_status_new",
  revisado: "admin_status_reviewed",
  resuelto: "admin_status_resolved",
}

function rowToFeedback(row: any): Feedback {
  return {
    id: row.id,
    type: row.type,
    message: row.message,
    userName: row.user_name || undefined,
    userEmail: row.user_email || undefined,
    page: row.page || undefined,
    // Solo imágenes reales (docs/154): un "javascript:…" guardado no llega a ser un enlace.
    imageDataUrl: /^data:image\/(png|jpeg|webp|gif);base64,/.test(row.image_data_url || "") ? row.image_data_url : undefined,
    status: row.status,
    createdAt: row.created_at,
    adminReply: row.admin_reply || undefined,
    repliedAt: row.replied_at || undefined,
  }
}

/**
 * El buzón de sugerencias/quejas/reportes de /admin — extraído tal cual de app/admin/page.tsx (sin cambios de lógica) al reestructurar /admin en pestañas, ver docs/63.
 * Desde docs/176: «Archivar» (en las opiniones, «Mover a Reseñas») saca un mensaje de la bandeja sin borrarlo,
 * «Archivar todo» la vacía de un clic, y la vista «Archivo» permite devolverlos.
 */
export function FeedbackPanel({ onCountsChange }: { onCountsChange?: (counts: { total: number; nuevo: number; bug: number }) => void }) {
  const { toast } = useToast()
  const { t, language } = useLanguage()

  const typeConfig = {
    sugerencia: { ...typeConfigDefs.sugerencia, label: t(typeConfigDefs.sugerencia.labelKey) },
    queja: { ...typeConfigDefs.queja, label: t(typeConfigDefs.queja.labelKey) },
    bug: { ...typeConfigDefs.bug, label: t(typeConfigDefs.bug.labelKey) },
    experiencia: { ...typeConfigDefs.experiencia, label: t(typeConfigDefs.experiencia.labelKey) },
  }

  const statusLabels = {
    nuevo: t(statusLabelKeys.nuevo),
    revisado: t(statusLabelKeys.revisado),
    resuelto: t(statusLabelKeys.resuelto),
  }

  const [feedback, setFeedback] = useState<Feedback[]>([])
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({})
  const [sendingReplyId, setSendingReplyId] = useState<string | null>(null)
  const [filter, setFilter] = useState<"todos" | FeedbackType>("todos")
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [archived, setArchived] = useState<Set<string>>(new Set())
  const [view, setView] = useState<"bandeja" | "archivo">("bandeja")
  const [archiving, setArchiving] = useState(false)

  const loadData = async () => {
    try {
      const res = await fetch("/api/admin/feedback")
      const data = await res.json()
      if (Array.isArray(data.feedback)) setFeedback(data.feedback.map(rowToFeedback))
      if (Array.isArray(data.archivedIds)) setArchived(new Set(data.archivedIds))
    } catch (error) {
      console.error("Error loading feedback:", error)
    }
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // En vivo (docs/192): los mensajes nuevos aparecen solos.
  useAdminLiveReload(loadData)

  const inbox = feedback.filter((f) => !archived.has(f.id))
  const archivedItems = feedback.filter((f) => archived.has(f.id))
  const inView = view === "bandeja" ? inbox : archivedItems

  const counts = {
    total: inView.length,
    sugerencia: inView.filter((f) => f.type === "sugerencia").length,
    queja: inView.filter((f) => f.type === "queja").length,
    bug: inView.filter((f) => f.type === "bug").length,
    experiencia: inView.filter((f) => f.type === "experiencia").length,
  }
  // El aviso de la pestaña de /admin cuenta solo lo que sigue en la bandeja.
  const inboxCounts = {
    total: inbox.length,
    nuevo: inbox.filter((f) => f.status === "nuevo").length,
    bug: inbox.filter((f) => f.type === "bug").length,
  }

  useEffect(() => {
    onCountsChange?.(inboxCounts)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inboxCounts.total, inboxCounts.nuevo, inboxCounts.bug])

  const setArchivedFor = async (ids: string[], value: boolean) => {
    if (ids.length === 0) return
    setArchiving(true)
    try {
      const res = await fetch("/api/admin/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, archived: value }),
      })
      if (!res.ok) throw new Error()
      setArchived((prev) => {
        const next = new Set(prev)
        for (const id of ids) {
          if (value) next.add(id)
          else next.delete(id)
        }
        return next
      })
      if (value) toast({ title: ids.length >= inbox.length ? t("admin_archived_all_toast") : t("admin_archived_toast") })
    } catch {
      toast({ title: t("admin_archive_error"), variant: "destructive" })
    } finally {
      setArchiving(false)
    }
  }

  const handleStatusChange = async (id: string, status: FeedbackStatus) => {
    await fetch(`/api/admin/feedback/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
    loadData()
  }

  const handleDelete = async (id: string) => {
    await fetch(`/api/admin/feedback/${id}`, { method: "DELETE" })
    loadData()
    toast({ title: t("admin_delete_toast_title"), description: t("admin_delete_toast_desc") })
  }

  const confirmDelete = () => {
    if (!deleteTargetId) return
    handleDelete(deleteTargetId)
    setDeleteTargetId(null)
  }

  const handleSendReply = async (id: string) => {
    const reply = (replyDrafts[id] || "").trim()
    if (!reply) return
    setSendingReplyId(id)
    try {
      const res = await fetch(`/api/admin/feedback/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reply }),
      })
      const data = await res.json()
      setReplyDrafts((prev) => ({ ...prev, [id]: "" }))
      await loadData()
      toast({
        title: t("admin_reply_sent_toast_title"),
        description: data.emailSent ? t("admin_reply_sent_toast_desc_email") : t("admin_reply_sent_toast_desc_noemail"),
      })
    } catch (error) {
      console.error("Error sending reply:", error)
      toast({ title: t("admin_reply_error_toast_title"), variant: "destructive" })
    } finally {
      setSendingReplyId(null)
    }
  }

  const filtered = filter === "todos" ? inView : inView.filter((f) => f.type === filter)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("admin_inbox_title")}</CardTitle>
        <CardDescription>{t("admin_inbox_subtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex rounded-lg border border-border p-0.5">
            <Button size="sm" variant={view === "bandeja" ? "secondary" : "ghost"} onClick={() => setView("bandeja")}>
              <Inbox className="h-4 w-4 mr-1.5" />
              {t("admin_inbox_view")} ({inbox.length})
            </Button>
            <Button size="sm" variant={view === "archivo" ? "secondary" : "ghost"} onClick={() => setView("archivo")}>
              <Archive className="h-4 w-4 mr-1.5" />
              {t("admin_archive_view")} ({archivedItems.length})
            </Button>
          </div>
          {view === "bandeja" && filtered.length > 0 && (
            <Button size="sm" variant="outline" disabled={archiving} onClick={() => setArchivedFor(filtered.map((f) => f.id), true)}>
              <Archive className="h-4 w-4 mr-1.5" />
              {t("admin_archive_all").replace("{n}", String(filtered.length))}
            </Button>
          )}
        </div>

        <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <TabsList>
            <TabsTrigger value="todos">{t("admin_tab_all")} ({counts.total})</TabsTrigger>
            <TabsTrigger value="sugerencia">{t("admin_tab_suggestions")} ({counts.sugerencia})</TabsTrigger>
            <TabsTrigger value="queja">{t("admin_tab_complaints")} ({counts.queja})</TabsTrigger>
            <TabsTrigger value="bug">{t("admin_tab_bugs")} ({counts.bug})</TabsTrigger>
            <TabsTrigger value="experiencia">{t("admin_tab_experience")} ({counts.experiencia})</TabsTrigger>
          </TabsList>
        </Tabs>

        {filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">
            {view === "archivo" ? t("admin_archive_empty") : inbox.length === 0 ? t("admin_inbox_zero") : t("admin_empty_category")}
          </p>
        ) : (
          <div className="space-y-3">
            {filtered.map((item) => {
              const config = typeConfig[item.type]
              return (
                <div key={item.id} className="border border-border rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Badge className={config.color} variant="secondary">
                        <config.icon className="h-3 w-3 mr-1" />
                        {config.label}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime(item.createdAt)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {view === "bandeja" ? (
                        <Button variant="outline" size="sm" className="h-8 text-xs" disabled={archiving} onClick={() => setArchivedFor([item.id], true)}>
                          <Archive className="h-3.5 w-3.5 mr-1" />
                          {item.type === "experiencia" ? t("admin_move_to_reviews") : t("admin_archive")}
                        </Button>
                      ) : (
                        <Button variant="outline" size="sm" className="h-8 text-xs" disabled={archiving} onClick={() => setArchivedFor([item.id], false)}>
                          <ArchiveRestore className="h-3.5 w-3.5 mr-1" />
                          {t("admin_unarchive")}
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => setDeleteTargetId(item.id)}>
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-foreground text-sm whitespace-pre-wrap">{item.message}</p>
                  {item.imageDataUrl && (
                    <a href={item.imageDataUrl} target="_blank" rel="noopener noreferrer">
                      <img
                        src={item.imageDataUrl || "/placeholder.svg"}
                        alt={t("contacto_image_alt")}
                        className="max-h-48 rounded-lg border border-border object-contain hover:opacity-90 transition-opacity"
                      />
                    </a>
                  )}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>
                      {item.userEmail ? (
                        <AccountLink email={item.userEmail}>{item.userName ? `${item.userName} · ${item.userEmail}` : item.userEmail}</AccountLink>
                      ) : (
                        item.userName || t("admin_anonymous")
                      )}
                      {item.page ? ` · ${item.page}` : ""}
                    </span>
                    <Select value={item.status} onValueChange={(v) => handleStatusChange(item.id, v as FeedbackStatus)}>
                      <SelectTrigger className="w-32 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(statusLabels).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {item.adminReply ? (
                    <div className="rounded-lg bg-muted/50 p-3 space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">
                        {t("admin_reply_label")}
                        {item.repliedAt ? ` · ${formatDateTime(item.repliedAt)}` : ""}
                      </p>
                      <p className="text-sm text-foreground whitespace-pre-wrap">{item.adminReply}</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Textarea
                        value={replyDrafts[item.id] || ""}
                        onChange={(e) => setReplyDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))}
                        placeholder={item.userEmail ? t("admin_reply_placeholder") : t("admin_reply_placeholder_noemail")}
                        className="text-sm min-h-16"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!replyDrafts[item.id]?.trim() || sendingReplyId === item.id}
                        onClick={() => handleSendReply(item.id)}
                      >
                        {sendingReplyId === item.id ? t("admin_reply_sending") : t("admin_reply_button")}
                      </Button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>

      <AlertDialog open={!!deleteTargetId} onOpenChange={(open) => !open && setDeleteTargetId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin_feedback_delete_title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("admin_feedback_delete_desc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common_cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>{t("admin_feedback_delete_confirm")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
