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
import { getDateLocale } from "@/lib/i18n/translations"
import type { Feedback, FeedbackStatus, FeedbackType } from "@/types/feedback"
import { Bug, Lightbulb, MessageCircleWarning, Trash2 } from "lucide-react"

const typeConfigDefs: Record<FeedbackType, { labelKey: "admin_type_suggestion" | "admin_type_complaint" | "admin_type_bug"; icon: typeof Lightbulb; color: string }> = {
  sugerencia: { labelKey: "admin_type_suggestion", icon: Lightbulb, color: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  queja: { labelKey: "admin_type_complaint", icon: MessageCircleWarning, color: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  bug: { labelKey: "admin_type_bug", icon: Bug, color: "bg-red-500/10 text-red-600 dark:text-red-400" },
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
    imageDataUrl: row.image_data_url || undefined,
    status: row.status,
    createdAt: row.created_at,
    adminReply: row.admin_reply || undefined,
    repliedAt: row.replied_at || undefined,
  }
}

/** El buzón de sugerencias/quejas/reportes de /admin — extraído tal cual de app/admin/page.tsx (sin cambios de lógica) al reestructurar /admin en pestañas, ver docs/63. */
export function FeedbackPanel({ onCountsChange }: { onCountsChange?: (counts: { total: number; nuevo: number; bug: number }) => void }) {
  const { toast } = useToast()
  const { t, language } = useLanguage()

  const typeConfig = {
    sugerencia: { ...typeConfigDefs.sugerencia, label: t(typeConfigDefs.sugerencia.labelKey) },
    queja: { ...typeConfigDefs.queja, label: t(typeConfigDefs.queja.labelKey) },
    bug: { ...typeConfigDefs.bug, label: t(typeConfigDefs.bug.labelKey) },
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

  const loadData = async () => {
    try {
      const res = await fetch("/api/admin/feedback")
      const data = await res.json()
      if (Array.isArray(data.feedback)) setFeedback(data.feedback.map(rowToFeedback))
    } catch (error) {
      console.error("Error loading feedback:", error)
    }
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const counts = {
    total: feedback.length,
    nuevo: feedback.filter((f) => f.status === "nuevo").length,
    sugerencia: feedback.filter((f) => f.type === "sugerencia").length,
    queja: feedback.filter((f) => f.type === "queja").length,
    bug: feedback.filter((f) => f.type === "bug").length,
  }

  useEffect(() => {
    onCountsChange?.({ total: counts.total, nuevo: counts.nuevo, bug: counts.bug })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [counts.total, counts.nuevo, counts.bug])

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

  const filtered = filter === "todos" ? feedback : feedback.filter((f) => f.type === filter)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("admin_inbox_title")}</CardTitle>
        <CardDescription>{t("admin_inbox_subtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <TabsList>
            <TabsTrigger value="todos">{t("admin_tab_all")} ({counts.total})</TabsTrigger>
            <TabsTrigger value="sugerencia">{t("admin_tab_suggestions")} ({counts.sugerencia})</TabsTrigger>
            <TabsTrigger value="queja">{t("admin_tab_complaints")} ({counts.queja})</TabsTrigger>
            <TabsTrigger value="bug">{t("admin_tab_bugs")} ({counts.bug})</TabsTrigger>
          </TabsList>
        </Tabs>

        {filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">{t("admin_empty_category")}</p>
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
                        {new Date(item.createdAt).toLocaleString(getDateLocale(language))}
                      </span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setDeleteTargetId(item.id)}>
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
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
                      {item.userName || t("admin_anonymous")}
                      {item.userEmail ? ` · ${item.userEmail}` : ""}
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
                        {item.repliedAt ? ` · ${new Date(item.repliedAt).toLocaleString(getDateLocale(language))}` : ""}
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
