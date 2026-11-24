"use client"

/**
 * Selección múltiple (pedido del dueño, docs/345): «que el usuario pueda multiseleccionar
 * cosas, ya sea para migrar o para borrar». Piezas comunes a Mis Recetas e Ingredientes:
 * - `BulkSelectBar`: barra fija abajo con cuántos hay elegidos y las acciones;
 * - `BulkMigrateDialog`: elegir el destino, ver el avance y el resultado;
 * - `BulkDeleteDialog`: confirmar antes de borrar (sin window.confirm).
 */

import { useCallback, useEffect, useState, type ReactNode } from "react"
import { ArrowRightLeft, CheckCircle2, Loader2, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Progress } from "@/components/ui/progress"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useLanguage } from "@/contexts/language-context"

/** Conjunto de ids elegidos, con las operaciones de siempre. */
export function useBulkSelection() {
  const [active, setActive] = useState(false)
  const [ids, setIds] = useState<Set<string>>(new Set())
  const toggle = (id: string) =>
    setIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const setAll = (all: string[]) => setIds(new Set(all))
  const clear = () => setIds(new Set())
  /** Deja elegidos solo los que se ven: nunca se borra ni migra algo que un filtro escondió (docs/353). */
  const keepOnly = useCallback(
    (visible: string[]) =>
      setIds((prev) => {
        const allowed = new Set(visible)
        const next = [...prev].filter((id) => allowed.has(id))
        return next.length === prev.size ? prev : new Set(next)
      }),
    [],
  )
  const start = () => setActive(true)
  const stop = () => {
    setActive(false)
    setIds(new Set())
  }
  return { active, ids, toggle, setAll, clear, keepOnly, start, stop }
}

/** Casilla grande (fácil de tocar en el celular) para una tarjeta o fila. */
export function SelectBox({ checked, onToggle, label }: { checked: boolean; onToggle: () => void; label: string }) {
  return (
    <span
      className="inline-flex h-9 w-9 items-center justify-center"
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
    >
      <Checkbox checked={checked} aria-label={label} className="h-5 w-5" onCheckedChange={() => {}} tabIndex={-1} />
    </span>
  )
}

export function BulkSelectBar({
  count,
  total,
  onSelectAll,
  onClear,
  onDone,
  onMigrate,
  onDelete,
  deleteLabel,
}: {
  count: number
  total: number
  onSelectAll: () => void
  onClear: () => void
  onDone: () => void
  onMigrate?: () => void
  onDelete?: () => void
  deleteLabel?: string
}) {
  const { t } = useLanguage()
  const allChosen = total > 0 && count >= total
  return (
    <div
      role="toolbar"
      aria-label={t("bulk_toolbar_label")}
      className="fixed inset-x-0 bottom-0 z-[45] border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/85 shadow-lg"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 pt-3">
        <span className="mr-auto text-sm font-medium text-foreground">{t("bulk_selected_count").replace("{count}", String(count))}</span>
        <Button type="button" variant="ghost" size="sm" className="min-h-9" onClick={allChosen ? onClear : onSelectAll}>
          {allChosen ? t("bulk_clear") : t("bulk_select_all")}
        </Button>
        {onMigrate && (
          <Button type="button" variant="outline" size="sm" className="min-h-9 gap-1.5" disabled={count === 0} onClick={onMigrate}>
            <ArrowRightLeft className="h-4 w-4" />
            {t("bulk_migrate")}
          </Button>
        )}
        {onDelete && (
          <Button type="button" variant="destructive" size="sm" className="min-h-9 gap-1.5" disabled={count === 0} onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
            {deleteLabel ?? t("common_delete")}
          </Button>
        )}
        <Button type="button" variant="ghost" size="sm" className="min-h-9 gap-1" onClick={onDone} aria-label={t("bulk_done")}>
          <X className="h-4 w-4" />
          <span className="hidden sm:inline">{t("bulk_done")}</span>
        </Button>
      </div>
    </div>
  )
}

export type BulkMigrateOutcome = { done: number; skipped: number; failed: string[]; note?: string }

export function BulkMigrateDialog({
  open,
  onOpenChange,
  count,
  description,
  targets,
  run,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  count: number
  description: string
  targets: { id: string; name: string }[]
  run: (targetId: string, onProgress: (done: number, total: number) => void) => Promise<BulkMigrateOutcome>
}) {
  const { t } = useLanguage()
  const [target, setTarget] = useState("")
  // Congelado al abrir: al terminar la selección se vacía y el título decía «Migrar 0».
  const [shownCount, setShownCount] = useState(count)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [outcome, setOutcome] = useState<BulkMigrateOutcome | null>(null)
  const running = progress !== null && outcome === null

  useEffect(() => {
    if (open) {
      setShownCount(count)
      setTarget(targets.length === 1 ? targets[0].id : "")
      setProgress(null)
      setOutcome(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const start = async () => {
    if (!target) return
    setProgress({ done: 0, total: count })
    try {
      setOutcome(await run(target, (done, total) => setProgress({ done, total })))
    } catch (e) {
      setOutcome({ done: 0, skipped: 0, failed: [e instanceof Error ? e.message : String(e)] })
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !running && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-primary" />
            {t("bulk_migrate_title").replace("{count}", String(shownCount))}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {outcome ? (
          <div className="space-y-2 text-sm">
            <p className="flex items-start gap-2 font-medium text-foreground">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
              {t("bulk_migrate_done").replace("{count}", String(outcome.done))}
            </p>
            {outcome.skipped > 0 && <p className="text-muted-foreground">{t("bulk_migrate_skipped").replace("{count}", String(outcome.skipped))}</p>}
            {outcome.note && <p className="text-muted-foreground">{outcome.note}</p>}
            {outcome.failed.length > 0 && <p className="text-destructive">{t("bulk_migrate_failed").replace("{names}", outcome.failed.join(", "))}</p>}
          </div>
        ) : running ? (
          <div className="space-y-3 py-2">
            <Progress value={progress.total ? (progress.done / progress.total) * 100 : 0} />
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("bulk_migrate_progress").replace("{done}", String(progress.done)).replace("{total}", String(progress.total))}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="bulk-target">{t("bulk_migrate_target")}</Label>
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger id="bulk-target">
                <SelectValue placeholder={t("misrecetas_migration_target_placeholder")} />
              </SelectTrigger>
              <SelectContent>
                {targets.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row">
          {outcome ? (
            <Button type="button" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
              {t("bulk_done")}
            </Button>
          ) : (
            <>
              <Button type="button" variant="outline" disabled={running} onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
                {t("common_cancel")}
              </Button>
              <Button type="button" disabled={!target || running} onClick={start} className="w-full sm:w-auto gap-1.5">
                <ArrowRightLeft className="h-4 w-4" />
                {t("bulk_migrate")}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function BulkDeleteDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  children,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel: string
  children?: ReactNode
  onConfirm: () => Promise<void>
}) {
  const { t } = useLanguage()
  const [busy, setBusy] = useState(false)
  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
        <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            {t("common_cancel")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={busy}
            className="w-full sm:w-auto gap-1.5"
            onClick={async () => {
              setBusy(true)
              try {
                await onConfirm()
              } finally {
                setBusy(false)
              }
            }}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
