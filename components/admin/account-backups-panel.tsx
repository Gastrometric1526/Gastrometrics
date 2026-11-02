"use client"

// Pestaña «Respaldos» de una cuenta en /admin (docs/229): lista los respaldos automáticos
// (fecha, motivo y conteos, sin el contenido), crea uno ahora y restaura uno. Restaurar
// respalda antes el estado actual, así que también se puede deshacer.

import { useState } from "react"
import { DatabaseBackup, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { useLanguage } from "@/contexts/language-context"
import { useConfirmDialog } from "@/components/confirm-dialog"
import { formatDateTime } from "@/lib/date-format"
import { AdminCard, EmptyState, ErrorState, LoadingBlock, useAdminData } from "@/components/admin/ui"
import type { SnapshotInfo } from "@/lib/services/account-snapshots"

type TKey = Parameters<ReturnType<typeof useLanguage>["t"]>[0]
const REASON_KEY: Record<SnapshotInfo["reason"], TKey> = {
  daily: "admin_backups_reason_daily",
  manual: "admin_backups_reason_manual",
  before_wipe: "admin_backups_reason_before_wipe",
  before_delete: "admin_backups_reason_before_delete",
  before_restore: "admin_backups_reason_before_restore",
}

export function AccountBackupsPanel({ userId, email }: { userId: string; email: string }) {
  const { t } = useLanguage()
  const { toast } = useToast()
  const [confirm, confirmDialog] = useConfirmDialog()
  const [busy, setBusy] = useState<string | null>(null)
  const { data, error, loading, reload } = useAdminData<{ snapshots: SnapshotInfo[] }>(
    `/api/admin/account-backups?userId=${encodeURIComponent(userId)}`,
  )

  const post = async (body: Record<string, unknown>) => {
    const res = await fetch("/api/admin/account-backups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, ...body }),
    })
    if (!res.ok) throw new Error(String(res.status))
  }

  const snapshotNow = async () => {
    setBusy("snapshot")
    try {
      await post({ action: "snapshot" })
      toast({ title: t("admin_backups_created") })
      reload(true)
    } catch {
      toast({ title: t("admin_backups_error"), variant: "destructive" })
    } finally {
      setBusy(null)
    }
  }

  const restore = async (s: SnapshotInfo) => {
    const ok = await confirm(
      t("admin_backups_restore_confirm_desc").replace("{date}", formatDateTime(s.createdAt)).replace("{email}", email),
      { title: t("admin_backups_restore_confirm_title"), confirmLabel: t("admin_backups_restore") },
    )
    if (!ok) return
    setBusy(s.path)
    try {
      await post({ action: "restore", path: s.path })
      toast({ title: t("admin_backups_restored"), description: t("admin_backups_restored_desc") })
      reload(true)
    } catch {
      toast({ title: t("admin_backups_error"), variant: "destructive" })
    } finally {
      setBusy(null)
    }
  }

  return (
    <AdminCard
      title={t("admin_backups_title")}
      icon={DatabaseBackup}
      description={t("admin_backups_desc")}
      actions={
        <Button size="sm" variant="outline" onClick={snapshotNow} disabled={busy !== null}>
          {busy === "snapshot" ? t("admin_accounts_applying") : t("admin_backups_create")}
        </Button>
      }
    >
      {loading && !data ? (
        <LoadingBlock rows={3} />
      ) : error ? (
        <ErrorState onRetry={() => reload(true)} />
      ) : !data?.snapshots.length ? (
        <EmptyState text={t("admin_backups_empty")} />
      ) : (
        <ul className="divide-y rounded-lg border">
          {data.snapshots.map((s, i) => (
            <li key={s.path} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 space-y-0.5">
                <div className="text-sm font-medium">
                  {formatDateTime(s.createdAt)} · {t(REASON_KEY[s.reason])}
                  {i === 0 && <span className="ml-2 text-xs text-muted-foreground">{t("admin_backups_latest")}</span>}
                </div>
                <div className="text-xs tabular-nums text-muted-foreground">
                  {t("admin_backups_counts")
                    .replace("{ingredients}", String(s.counts.ingredients))
                    .replace("{recipes}", String(s.counts.recipes))
                    .replace("{businesses}", String(s.counts.businesses))
                    .replace("{menus}", String(s.counts.menus))
                    .replace("{inventory}", String(s.counts.inventory))}
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => restore(s)} disabled={busy !== null} className="shrink-0">
                <RotateCcw className="mr-1.5 h-4 w-4" aria-hidden />
                {busy === s.path ? t("admin_accounts_applying") : t("admin_backups_restore")}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {confirmDialog}
    </AdminCard>
  )
}
