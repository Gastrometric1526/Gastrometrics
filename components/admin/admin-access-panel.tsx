"use client"

/**
 * «Personas con acceso al panel» (pedido del dueño, docs/282), en Sistema. Cada persona
 * entra con su propia cuenta. El dueño escribe un correo y elige:
 * - «Dar acceso y enviar el correo»: le llega la invitación ya;
 * - «Guardar sin enviar»: queda en la lista y él decide cuándo tocar «Enviar invitación».
 * Quien administra sin ser dueño ve la lista pero no puede cambiarla.
 */

import { useCallback, useEffect, useState } from "react"
import { Mail, Send, ShieldCheck, Trash2, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useLanguage } from "@/contexts/language-context"
import { useToast } from "@/hooks/use-toast"
import { useConfirmDialog } from "@/components/confirm-dialog"
import { AdminCard, LoadingBlock } from "@/components/admin/ui"
import { formatDateTime } from "@/lib/date-format"
import { normalizeAdminEmail, type AdminMember } from "@/lib/admin/members"
import { cn } from "@/lib/utils"

type MembersResponse = { ready: boolean; members: AdminMember[]; canManage: boolean; me: string | null }

const STATUS_CLS: Record<AdminMember["status"], string> = {
  active: "bg-success/10 text-success",
  invited: "bg-primary/10 text-primary",
  pending: "bg-muted text-muted-foreground",
}

export function AdminAccessPanel() {
  const { t } = useLanguage()
  const { toast } = useToast()
  const [confirm, confirmDialog] = useConfirmDialog()
  const [data, setData] = useState<MembersResponse | null>(null)
  const [email, setEmail] = useState("")
  const [busy, setBusy] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const load = useCallback(() => {
    fetch("/api/admin/members")
      .then((res) => res.json())
      .then((json) => !json.error && setData(json))
      .catch(() => {})
  }, [])
  useEffect(load, [load])

  const call = async (method: "POST" | "PATCH" | "DELETE", body: Record<string, unknown>) => {
    const res = await fetch("/api/admin/members", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    const json = await res.json().catch(() => ({}))
    return { ok: res.ok && json.ok, error: json.error as string | undefined }
  }

  const errorText = (error?: string) => (error === "only_owner" ? t("admin_access_only_owner") : error === "invalid_email" ? t("admin_access_invalid_email") : t("admin_access_error"))

  const add = async (send: boolean) => {
    const normalized = normalizeAdminEmail(email)
    if (!normalized) {
      setFormError(t("admin_access_invalid_email"))
      return
    }
    setBusy(send ? "add-send" : "add-save")
    setFormError(null)
    const result = await call("POST", { email: normalized, send })
    setBusy(null)
    if (!result.ok) {
      setFormError(errorText(result.error))
      return
    }
    setEmail("")
    toast({ title: send ? t("admin_access_sent_toast").replace("{email}", normalized) : t("admin_access_saved_toast") })
    load()
  }

  const sendInvite = async (member: AdminMember) => {
    setBusy(`send:${member.email}`)
    const result = await call("PATCH", { email: member.email, action: "send" })
    setBusy(null)
    toast(result.ok ? { title: t("admin_access_sent_toast").replace("{email}", member.email) } : { title: errorText(result.error), variant: "destructive" })
    load()
  }

  const remove = async (member: AdminMember) => {
    const ok = await confirm(t("admin_access_remove_desc").replace("{email}", member.email), { title: t("admin_access_remove_title"), confirmLabel: t("admin_access_remove") })
    if (!ok) return
    setBusy(`remove:${member.email}`)
    const result = await call("DELETE", { email: member.email })
    setBusy(null)
    toast(result.ok ? { title: t("admin_access_removed_toast") } : { title: errorText(result.error), variant: "destructive" })
    load()
  }

  const statusLabel = (m: AdminMember) => t(m.status === "active" ? "admin_access_status_active" : m.status === "invited" ? "admin_access_status_invited" : "admin_access_status_pending")

  return (
    <AdminCard title={t("admin_access_title")} icon={ShieldCheck} description={t("admin_access_desc")}>
      {confirmDialog}
      {!data ? (
        <LoadingBlock rows={2} />
      ) : !data.ready ? (
        <p className="text-sm text-muted-foreground">{t("admin_login_not_ready")}</p>
      ) : (
        <div className="space-y-6">
          <ul className="divide-y divide-border rounded-xl border border-border">
            {data.members.map((m) => {
              const isMe = data.me === m.email
              return (
                <li key={m.email} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                      <span className="truncate">{m.email}</span>
                      {isMe && <span className="rounded-full bg-muted px-2 text-[11px] text-muted-foreground">{t("admin_access_you")}</span>}
                    </p>
                    <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="rounded-full border border-border px-2">{t(m.role === "owner" ? "admin_access_role_owner" : "admin_access_role_admin")}</span>
                      <span className={cn("rounded-full px-2", STATUS_CLS[m.status])}>{statusLabel(m)}</span>
                      {m.last_login_at ? (
                        <span>{t("admin_access_last_login").replace("{date}", formatDateTime(m.last_login_at))}</span>
                      ) : m.invited_at ? (
                        <span>{t("admin_access_sent_at").replace("{date}", formatDateTime(m.invited_at))}</span>
                      ) : null}
                    </p>
                  </div>
                  {data.canManage && !isMe && (
                    <div className="flex shrink-0 flex-wrap gap-2">
                      {m.status !== "active" && (
                        <Button size="sm" variant={m.status === "pending" ? "default" : "outline"} className="gap-1.5" disabled={!!busy} onClick={() => sendInvite(m)}>
                          <Send className="h-4 w-4" />
                          {m.status === "pending" ? t("admin_access_send") : t("admin_access_resend")}
                        </Button>
                      )}
                      {m.role !== "owner" && (
                        <Button size="sm" variant="ghost" className="gap-1.5 text-destructive hover:text-destructive" disabled={!!busy} onClick={() => remove(m)}>
                          <Trash2 className="h-4 w-4" />
                          {t("admin_access_remove")}
                        </Button>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>

          {data.canManage ? (
            <div className="space-y-3 rounded-xl bg-muted/40 p-4">
              <Label htmlFor="admin-access-email" className="flex items-center gap-2">
                <UserPlus className="h-4 w-4" />
                {t("admin_access_add_label")}
              </Label>
              <Input
                id="admin-access-email"
                type="email"
                inputMode="email"
                autoComplete="off"
                maxLength={254}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  setFormError(null)
                }}
                placeholder="nombre@correo.com"
              />
              {formError && <p className="text-sm text-destructive">{formError}</p>}
              <div className="flex flex-wrap gap-2">
                <Button className="gap-1.5" disabled={!!busy || !email.trim()} onClick={() => add(true)}>
                  <Mail className="h-4 w-4" />
                  {t("admin_access_add_send")}
                </Button>
                <Button variant="outline" disabled={!!busy || !email.trim()} onClick={() => add(false)}>
                  {t("admin_access_add_save")}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">{t("admin_access_add_hint")}</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t("admin_access_only_owner")}</p>
          )}
        </div>
      )}
    </AdminCard>
  )
}
