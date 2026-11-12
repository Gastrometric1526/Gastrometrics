"use client"

/**
 * /admin → Mensajes → «Recuperar cuentas» (docs/285): solicitudes de quien no recuerda su
 * correo, ya no tiene acceso a él o borró su contenido por error. Cada una dice qué pasa,
 * cómo contestarle y qué hacer; «Buscar la cuenta» abre su ficha (Acceso para cambiar el
 * correo o mandar el enlace; Respaldos para restaurar). Antes de cambiar nada, verificar
 * que sea la dueña de la cuenta.
 */

import { useEffect, useState } from "react"
import { CheckCircle2, LifeBuoy, RotateCcw, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/contexts/language-context"
import { useToast } from "@/hooks/use-toast"
import { AdminCard, EmptyState, LoadingBlock, useAdminData } from "@/components/admin/ui"
import { formatDateTime } from "@/lib/date-format"
import { openAdminAccount } from "@/lib/admin/open-account"
import { cn } from "@/lib/utils"

type RecoveryRequest = {
  id: string
  kind: "forgot_email" | "lost_email" | "restore_content"
  full_name: string | null
  business_name: string | null
  contact: string
  possible_emails: string | null
  details: string | null
  user_id: string | null
  user_email: string | null
  status: "nuevo" | "resuelto"
  created_at: string
  resolved_at: string | null
}

export function RecoveryPanel({ onPendingChange }: { onPendingChange?: (n: number) => void }) {
  const { t } = useLanguage()
  const { toast } = useToast()
  const { data, loading, reload } = useAdminData<{ ready: boolean; requests: RecoveryRequest[]; pending: number }>("/api/admin/recovery")
  const [showResolved, setShowResolved] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  useEffect(() => {
    if (data?.ready) onPendingChange?.(data.pending)
  }, [data, onPendingChange])

  if (loading && !data) return <LoadingBlock rows={3} />
  if (!data?.ready) return <p className="text-sm text-muted-foreground">{t("admin_recovery_not_ready")}</p>
  const list = data.requests.filter((r) => (showResolved ? true : r.status === "nuevo"))

  const setStatus = async (r: RecoveryRequest, status: "nuevo" | "resuelto") => {
    setBusy(r.id)
    const res = await fetch("/api/admin/recovery", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: r.id, status }) }).catch(() => null)
    setBusy(null)
    if (res?.ok) reload(true)
    else toast({ title: t("admin_access_error"), variant: "destructive" })
  }
  // La cuenta a buscar: la de la sesión (restaurar), o el primer correo que la persona cree haber usado.
  const lookup = (r: RecoveryRequest) => {
    if (r.user_id || r.user_email) return { userId: r.user_id, email: r.user_email }
    const email = (r.possible_emails ?? "").match(/[^\s,;]+@[^\s,;]+\.[^\s,;]+/)?.[0]
    return email ? { email: email.toLowerCase() } : null
  }

  return (
    <AdminCard
      title={t("admin_recovery_title")}
      icon={LifeBuoy}
      description={t("admin_recovery_desc")}
      actions={
        <Button variant="ghost" size="sm" onClick={() => setShowResolved((v) => !v)}>
          {showResolved ? t("admin_recovery_hide_resolved") : t("admin_recovery_show_resolved")}
        </Button>
      }
    >
      {list.length === 0 ? (
        <EmptyState text={t("admin_recovery_empty")} icon={CheckCircle2} />
      ) : (
        <ul className="space-y-3">
          {list.map((r) => {
            const target = lookup(r)
            return (
              <li key={r.id} className={cn("space-y-2 rounded-xl border p-4", r.status === "nuevo" ? "border-primary/40" : "border-border opacity-70")}>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">{t(`admin_recovery_kind_${r.kind}` as never)}</span>
                  <span className="text-muted-foreground">{formatDateTime(r.created_at)}</span>
                  {r.status === "resuelto" && <span className="rounded-full bg-success/10 px-2 py-0.5 text-success">{t("admin_recovery_resolved")}</span>}
                </div>
                <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[10rem_1fr]">
                  {r.full_name && (
                    <>
                      <dt className="text-muted-foreground">{t("admin_recovery_field_name")}</dt>
                      <dd className="text-foreground">{r.full_name}</dd>
                    </>
                  )}
                  {r.business_name && (
                    <>
                      <dt className="text-muted-foreground">{t("admin_recovery_field_business")}</dt>
                      <dd className="text-foreground">{r.business_name}</dd>
                    </>
                  )}
                  <dt className="text-muted-foreground">{t("admin_recovery_field_contact")}</dt>
                  <dd className="break-all font-medium text-foreground">{r.contact}</dd>
                  {(r.possible_emails || r.user_email) && (
                    <>
                      <dt className="text-muted-foreground">{t("admin_recovery_field_emails")}</dt>
                      <dd className="break-all text-foreground">{r.user_email ?? r.possible_emails}</dd>
                    </>
                  )}
                  {r.details && (
                    <>
                      <dt className="text-muted-foreground">{t("admin_recovery_field_details")}</dt>
                      <dd className="whitespace-pre-wrap text-foreground">{r.details}</dd>
                    </>
                  )}
                </dl>
                <p className="text-xs text-muted-foreground">{t(`admin_recovery_howto_${r.kind}` as never)}</p>
                <div className="flex flex-wrap gap-2">
                  {target && (
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => openAdminAccount(target)}>
                      <Search className="h-4 w-4" />
                      {t("admin_recovery_open_account")}
                    </Button>
                  )}
                  {r.status === "nuevo" ? (
                    <Button size="sm" className="gap-1.5" disabled={busy === r.id} onClick={() => setStatus(r, "resuelto")}>
                      <CheckCircle2 className="h-4 w-4" />
                      {t("admin_recovery_mark_resolved")}
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" className="gap-1.5" disabled={busy === r.id} onClick={() => setStatus(r, "nuevo")}>
                      <RotateCcw className="h-4 w-4" />
                      {t("admin_recovery_reopen")}
                    </Button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </AdminCard>
  )
}
