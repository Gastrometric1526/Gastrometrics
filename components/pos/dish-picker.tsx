"use client"

/**
 * Carta del POS (docs/268, docs/271): primero se elige la carta (un menú creado o «Mis
 * Recetas»), después el grupo (paso del menú o clasificación) y el plato. Con foto, la
 * tarjeta la muestra; sin foto, solo el nombre y el precio. Al tocar un plato se eligen la
 * cantidad, los extras (con precio) y una nota, y se agrega a la silla elegida.
 */

import { useEffect, useMemo, useState } from "react"
import { Minus, Plus, Search } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/currency"
import { useLanguage } from "@/contexts/language-context"
import { normalizeSearch } from "@/lib/manual-sales"
import { extrasFor, itemUnitPrice } from "@/lib/pos"
import { cartaCategories, RECIPES_CARTA, type PosCarta, type PosSellable } from "@/lib/pos-carta"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { PosConfig, PosOrderExtra } from "@/types/pos"

export type { PosSellable } from "@/lib/pos-carta"

const CARTA_KEY = "gm_pos_carta"

export function DishPicker({
  open,
  onOpenChange,
  cartas,
  config,
  seatLabel,
  onAdd,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  cartas: PosCarta[]
  config: PosConfig
  seatLabel: string
  onAdd: (s: PosSellable, quantity: number, extras: PosOrderExtra[], note: string | null) => void
}) {
  const { t } = useLanguage()
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState<string | null>(null)
  const [cartaId, setCartaId] = useState<string | null>(null)
  const [picked, setPicked] = useState<PosSellable | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [extras, setExtras] = useState<Record<string, number>>({})
  const [note, setNote] = useState("")

  // La última carta elegida se recuerda en el aparato; si ya no existe, la primera.
  useEffect(() => {
    if (cartaId && cartas.some((c) => c.id === cartaId)) return
    let saved: string | null = null
    try {
      saved = localStorage.getItem(CARTA_KEY)
    } catch {}
    setCartaId(cartas.find((c) => c.id === saved)?.id ?? cartas[0]?.id ?? null)
  }, [cartas, cartaId])
  const chooseCarta = (id: string) => {
    setCartaId(id)
    setCategory(null)
    try {
      localStorage.setItem(CARTA_KEY, id)
    } catch {}
  }

  const carta = cartas.find((c) => c.id === cartaId) ?? cartas[0]
  const sellables = useMemo(() => carta?.items ?? [], [carta])
  const categories = useMemo(() => (carta ? cartaCategories(carta) : []), [carta])
  const shown = useMemo(() => {
    const q = normalizeSearch(query)
    return sellables.filter((s) => (!category || s.category === category) && (!q || normalizeSearch(s.name).includes(q)))
  }, [sellables, query, category])
  // Agrupado por paso del menú o clasificación, en el orden de la carta.
  const groups = useMemo(
    () =>
      categories
        .map((name) => {
          const items = shown.filter((s) => s.category === name)
          return { name, withPhoto: items.filter((s) => s.image), nameOnly: items.filter((s) => !s.image) }
        })
        .filter((g) => g.withPhoto.length + g.nameOnly.length > 0),
    [categories, shown],
  )

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
            <div className="flex flex-col gap-2 sm:flex-row">
              {cartas.length > 1 && (
                <Select value={carta?.id} onValueChange={chooseCarta}>
                  <SelectTrigger className="sm:w-64" aria-label={t("pos_carta_label")} data-tour="salon-carta">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {cartas.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.id === RECIPES_CARTA ? t("pos_carta_all_recipes") : t("pos_carta_menu").replace("{name}", c.name)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("ventas_search_placeholder")} className="pl-9" autoFocus />
              </div>
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
                <div className="space-y-5">
                  {groups.map((g) => (
                    <section key={g.name} className="space-y-2">
                      {groups.length > 1 && <p className="text-sm font-semibold text-foreground">{g.name}</p>}
                      {/* Con foto, la foto; sin foto, solo el nombre y el precio (docs/271). */}
                      {g.withPhoto.length > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                          {g.withPhoto.map((s) => (
                            <button
                              key={s.key}
                              type="button"
                              onClick={() => setPicked(s)}
                              className="text-left rounded-xl border border-border bg-card hover:border-primary hover:shadow-sm transition overflow-hidden"
                            >
                              <div className="aspect-[4/3] bg-muted overflow-hidden">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={s.image} alt="" className="h-full w-full object-cover" />
                              </div>
                              <div className="p-2.5 space-y-0.5">
                                <p className="text-sm font-medium leading-tight line-clamp-2">{s.name}</p>
                                <p className="text-sm tabular-nums text-muted-foreground">{s.price > 0 ? formatCurrency(s.price) : t("pos_no_price")}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                      {g.nameOnly.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                          {g.nameOnly.map((s) => (
                            <button
                              key={s.key}
                              type="button"
                              onClick={() => setPicked(s)}
                              className="flex items-center justify-between gap-3 text-left rounded-lg border border-border bg-card px-3 py-2.5 hover:border-primary hover:shadow-sm transition"
                            >
                              <span className="text-sm font-medium leading-tight line-clamp-2">{s.name}</span>
                              <span className="shrink-0 text-sm tabular-nums text-muted-foreground">{s.price > 0 ? formatCurrency(s.price) : t("pos_no_price")}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </section>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4 overflow-y-auto">
            <div className="flex items-center gap-3">
              {picked.image && (
                <div className="h-16 w-20 rounded-lg bg-muted overflow-hidden shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={picked.image} alt="" className="h-full w-full object-cover" />
                </div>
              )}
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
