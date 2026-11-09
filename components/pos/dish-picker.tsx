"use client"

/**
 * Carta del POS (docs/268): cuadrícula con la foto de cada plato, por categoría y con
 * buscador. Al tocar un plato se eligen la cantidad, los extras (con precio) y una nota, y
 * se agrega a la silla elegida.
 */

import { useMemo, useState } from "react"
import { Minus, Plus, Search, UtensilsCrossed } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/currency"
import { useLanguage } from "@/contexts/language-context"
import { normalizeSearch } from "@/lib/manual-sales"
import { extrasFor, itemUnitPrice } from "@/lib/pos"
import type { PosConfig, PosOrderExtra } from "@/types/pos"

export interface PosSellable {
  key: string
  sourceType: "recipe" | "menu"
  refId: string
  name: string
  category: string
  price: number
  cost: number
  image?: string
  classification: string | null
}

export function DishPicker({
  open,
  onOpenChange,
  sellables,
  config,
  seatLabel,
  onAdd,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  sellables: PosSellable[]
  config: PosConfig
  seatLabel: string
  onAdd: (s: PosSellable, quantity: number, extras: PosOrderExtra[], note: string | null) => void
}) {
  const { t } = useLanguage()
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState<string | null>(null)
  const [picked, setPicked] = useState<PosSellable | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [extras, setExtras] = useState<Record<string, number>>({})
  const [note, setNote] = useState("")

  const categories = useMemo(() => [...new Set(sellables.map((s) => s.category))].sort((a, b) => a.localeCompare(b)), [sellables])
  const shown = useMemo(() => {
    const q = normalizeSearch(query)
    return sellables.filter((s) => (!category || s.category === category) && (!q || normalizeSearch(s.name).includes(q)))
  }, [sellables, query, category])

  const available = picked ? extrasFor(config, picked.classification) : []
  const chosen: PosOrderExtra[] = available
    .filter((e) => (extras[e.id] || 0) > 0)
    .map((e) => ({ extraId: e.id, name: e.name, price: e.price, recipeId: e.recipeId, quantity: extras[e.id] }))
  const unit = picked ? itemUnitPrice({ unitPrice: picked.price, extras: chosen }) : 0

  const reset = () => {
    setPicked(null)
    setQuantity(1)
    setExtras({})
    setNote("")
  }
  const close = (o: boolean) => {
    if (!o) {
      reset()
      setQuery("")
    }
    onOpenChange(o)
  }
  const add = () => {
    if (!picked) return
    onAdd(picked, quantity, chosen, note.trim() || null)
    reset()
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{picked ? picked.name : t("pos_picker_title")}</DialogTitle>
          <DialogDescription>{t("pos_picker_for_seat").replace("{seat}", seatLabel)}</DialogDescription>
        </DialogHeader>

        {!picked ? (
          <div className="space-y-3 overflow-hidden flex flex-col min-h-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("ventas_search_placeholder")} className="pl-9" autoFocus />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              <Button size="sm" variant={category === null ? "default" : "outline"} onClick={() => setCategory(null)}>
                {t("pos_picker_all")}
              </Button>
              {categories.map((c) => (
                <Button key={c} size="sm" variant={category === c ? "default" : "outline"} onClick={() => setCategory(c)} className="shrink-0">
                  {c}
                </Button>
              ))}
            </div>
            <div className="overflow-y-auto min-h-0">
              {shown.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">{sellables.length ? t("ventas_search_empty") : t("ventas_no_recipes")}</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {shown.map((s) => (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => setPicked(s)}
                      className="text-left rounded-xl border border-border bg-card hover:border-primary hover:shadow-sm transition overflow-hidden"
                    >
                      <div className="aspect-[4/3] bg-muted flex items-center justify-center overflow-hidden">
                        {s.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={s.image} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <UtensilsCrossed className="h-8 w-8 text-muted-foreground" />
                        )}
                      </div>
                      <div className="p-2.5 space-y-0.5">
                        <p className="text-sm font-medium leading-tight line-clamp-2">{s.name}</p>
                        <p className="text-sm tabular-nums text-muted-foreground">{s.price > 0 ? formatCurrency(s.price) : t("pos_no_price")}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4 overflow-y-auto">
            <div className="flex items-center gap-3">
              <div className="h-16 w-20 rounded-lg bg-muted overflow-hidden flex items-center justify-center shrink-0">
                {picked.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={picked.image} alt="" className="h-full w-full object-cover" />
                ) : (
                  <UtensilsCrossed className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">{formatCurrency(picked.price)}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setQuantity((q) => Math.max(1, q - 1))} aria-label={t("ventas_less")}>
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-8 text-center tabular-nums font-medium">{quantity}</span>
                  <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setQuantity((q) => q + 1)} aria-label={t("ventas_more")}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">{t("pos_extras_title")}</p>
              {available.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("pos_extras_none")}</p>
              ) : (
                <div className="grid sm:grid-cols-2 gap-2">
                  {available.map((e) => {
                    const q = extras[e.id] || 0
                    return (
                      <div key={e.id} className={cn("flex items-center gap-2 rounded-lg border p-2", q > 0 ? "border-primary bg-primary/5" : "border-border")}>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{e.name}</p>
                          <p className="text-xs text-muted-foreground tabular-nums">{e.price > 0 ? `+ ${formatCurrency(e.price)}` : t("pos_extra_free")}</p>
                        </div>
                        {q > 0 && (
                          <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setExtras({ ...extras, [e.id]: q - 1 })} aria-label={t("ventas_less")}>
                            <Minus className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {q > 0 && <span className="w-5 text-center text-sm tabular-nums">{q}</span>}
                        <Button size="icon" variant={q > 0 ? "outline" : "secondary"} className="h-7 w-7" onClick={() => setExtras({ ...extras, [e.id]: q + 1 })} aria-label={t("ventas_more")}>
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <p className="text-sm font-medium">{t("ventas_note_label")}</p>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("pos_note_placeholder")} rows={2} />
            </div>
          </div>
        )}

        {picked && (
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={reset}>
              {t("pos_picker_back")}
            </Button>
            <Button onClick={add} className="gap-2">
              <Plus className="h-4 w-4" />
              {t("pos_picker_add").replace("{total}", formatCurrency(unit * quantity))}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
