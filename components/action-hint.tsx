"use client"

import { PageTour } from "@/components/page-tour"
import { useLanguage } from "@/contexts/language-context"
import { hintStorageKey, type HintId } from "@/lib/hints"

/**
 * Pista por acción (docs/219): aparece una sola vez, cuando `when` se cumple, resaltando
 * `selector`. Ejemplos: el primer ingrediente de una ficha, la receta recién guardada, el
 * primer panel abierto. `actionLabel` + `onAction` convierten el botón en una invitación
 * («Probar la merma») en vez de «Entendido».
 */
export function ActionHint({
  id,
  when,
  title,
  description,
  selector,
  tip,
  actionLabel,
  onAction,
  delay = 700,
}: {
  id: HintId
  when: boolean
  title: string
  description: string
  selector: string | null
  tip?: string
  actionLabel?: string
  onAction?: () => void
  delay?: number
}) {
  const { t } = useLanguage()
  if (!when) return null
  return (
    <PageTour
      variant="hint"
      storageKey={hintStorageKey(id)}
      startDelay={delay}
      finishLabel={actionLabel ?? t("hint_ok")}
      onFinish={onAction}
      steps={[{ id, title, description, selector, tip }]}
    />
  )
}
