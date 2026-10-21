"use client"

/** Aviso «Recuperamos lo que dejaste sin terminar» de los borradores automáticos (docs/171). */

import { History, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/contexts/language-context"
import { formatDateTime } from "@/lib/date-format"
import type { FormDraftKind } from "@/lib/storage/form-draft"
import type { TranslationKey } from "@/lib/i18n/translations"

const DURATION_KEY: Record<FormDraftKind, TranslationKey> = {
  ingredient: "draft_duration_24h",
  inventory: "draft_duration_3d",
  purchaseOrder: "draft_duration_3d",
  menu: "draft_duration_7d",
}

export function DraftRestoredNotice({
  kind,
  restoredAt,
  onDiscard,
  onDismiss,
}: {
  kind: FormDraftKind
  restoredAt: string | null
  onDiscard: () => void
  onDismiss: () => void
}) {
  const { t } = useLanguage()
  if (!restoredAt) return null
  return (
    <div className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm" data-tour="draft-restored">
      <History className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-foreground">{t("draft_restored_title")}</p>
        <p className="text-muted-foreground">
          {t("draft_restored_desc").replace("{date}", formatDateTime(restoredAt)).replace("{duration}", t(DURATION_KEY[kind]))}
        </p>
        <Button type="button" variant="link" size="sm" className="h-auto p-0 text-primary" onClick={onDiscard}>
          {t("draft_discard")}
        </Button>
      </div>
      <button type="button" aria-label={t("draft_dismiss")} onClick={onDismiss} className="text-muted-foreground hover:text-foreground">
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

/** Duración del borrador, para los textos de ayuda. */
export function draftDurationKey(kind: FormDraftKind): TranslationKey {
  return DURATION_KEY[kind]
}

