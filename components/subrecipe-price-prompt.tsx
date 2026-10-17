"use client"

// Pregunta de docs/164: cuando la cascada de costos sube el costo de sub-recetas que
// tienen un precio de venta escrito a mano (y están en «Preguntarme»), esta ventana pide
// permiso antes de subir ese precio. Los platos finales ya subieron solos (docs/162).
// Montada una sola vez en app/layout.tsx; la abre el evento SUBRECIPE_PRICE_PROMPT_EVENT
// (requestSubRecipePricePrompt, lib/recalculate.ts) desde Ingredientes, Inventario y la
// Ficha Técnica. Cerrarla sin elegir = «No, solo costos» (no se cambia ningún precio).

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { useAuth } from "@/contexts/auth-context"
import { useLanguage } from "@/contexts/language-context"
import { useToast } from "@/hooks/use-toast"
import { formatCurrency } from "@/lib/currency"
import { logPriceRuleChanges } from "@/lib/services/activity-log"
import {
  applySubRecipePriceDecisions,
  SUBRECIPE_PRICE_PROMPT_EVENT,
  type SubRecipePricePromptDetail,
} from "@/lib/recalculate"

export function SubRecipePricePrompt() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const { toast } = useToast()
  const [detail, setDetail] = useState<SubRecipePricePromptDetail | null>(null)
  const [choosing, setChoosing] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [remember, setRemember] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const onPrompt = (event: Event) => {
      const next = (event as CustomEvent<SubRecipePricePromptDetail>).detail
      if (!next?.items?.length) return
      setDetail(next)
      setChoosing(false)
      setSelected(next.items.map((i) => i.recipeId))
      setRemember(false)
    }
    window.addEventListener(SUBRECIPE_PRICE_PROMPT_EVENT, onPrompt)
    return () => window.removeEventListener(SUBRECIPE_PRICE_PROMPT_EVENT, onPrompt)
  }, [])

  if (!detail) return null

  const finish = async (acceptedIds: string[]) => {
    setSaving(true)
    try {
      const changes = await applySubRecipePriceDecisions(detail.businessId, detail.items, acceptedIds, remember)
      logPriceRuleChanges(changes, user, detail.businessId !== "main" ? detail.businessId : null)
      if (changes.length > 0) {
        toast({
          title: t("subrecipe_price_prompt_done_title"),
          description: t("subrecipe_price_prompt_done_desc").replace("{count}", String(changes.length)),
        })
      } else if (remember) {
        toast({ title: t("subrecipe_price_prompt_saved_title"), description: t("subrecipe_price_prompt_remember_hint") })
      }
    } catch (error) {
      console.error("[subrecipe-price-prompt]", error)
      toast({ title: t("subrecipe_price_prompt_error"), variant: "destructive" })
    } finally {
      setSaving(false)
      setDetail(null)
    }
  }

  const toggle = (id: string, checked: boolean) =>
    setSelected((prev) => (checked ? [...new Set([...prev, id])] : prev.filter((x) => x !== id)))

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && setDetail(null)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {detail.sourceName
              ? t("subrecipe_price_prompt_title").replace("{name}", detail.sourceName)
              : t("subrecipe_price_prompt_title_generic")}
          </DialogTitle>
          <DialogDescription>
            {detail.raisedDishes > 0 &&
              `${t("subrecipe_price_prompt_dishes").replace("{count}", String(detail.raisedDishes))} `}
            {t("subrecipe_price_prompt_desc")}
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-2 max-h-64 overflow-y-auto">
          {detail.items.map((item) => (
            <li key={item.recipeId} className="flex items-center gap-3 rounded-lg border p-3 text-sm">
              {choosing && (
                <Checkbox
                  checked={selected.includes(item.recipeId)}
                  onCheckedChange={(v) => toggle(item.recipeId, v === true)}
                  aria-label={item.recipeName}
                />
              )}
              <span className="flex-1 min-w-0 font-medium truncate">{item.recipeName}</span>
              <span className="tabular-nums text-muted-foreground whitespace-nowrap">
                {formatCurrency(item.currentPrice)} → {t("subrecipe_price_prompt_suggested")}{" "}
                <span className="font-semibold text-foreground">{formatCurrency(item.suggestedPrice)}</span>
              </span>
            </li>
          ))}
        </ul>

        <label className="flex items-start gap-2 text-sm">
          <Checkbox checked={remember} onCheckedChange={(v) => setRemember(v === true)} className="mt-0.5" />
          <span>
            {t("subrecipe_price_prompt_remember")}
            <span className="block text-xs text-muted-foreground">{t("subrecipe_price_prompt_remember_hint")}</span>
          </span>
        </label>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" disabled={saving} onClick={() => finish([])}>
            {t("subrecipe_price_prompt_no")}
          </Button>
          {choosing ? (
            <Button disabled={saving} onClick={() => finish(selected)}>
              {t("subrecipe_price_prompt_update_selected").replace("{count}", String(selected.length))}
            </Button>
          ) : (
            <>
              {detail.items.length > 1 && (
                <Button variant="outline" disabled={saving} onClick={() => setChoosing(true)}>
                  {t("subrecipe_price_prompt_choose")}
                </Button>
              )}
              <Button disabled={saving} onClick={() => finish(detail.items.map((i) => i.recipeId))}>
                {detail.items.length > 1 ? t("subrecipe_price_prompt_update_all") : t("subrecipe_price_prompt_update_one")}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
