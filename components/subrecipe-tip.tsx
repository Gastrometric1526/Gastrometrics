"use client"

/**
 * Nota corta sobre subrecetas (pedido del dueño, docs/299): «al menos al principio, que
 * mencione que si tiene una receta que es parte de otra receta… puede agregarla vía ficha
 * técnica seleccionando la clasificación de su receta, tanto cuando esté en ficha como
 * cuando entre a base de datos».
 *
 * Sale al agregar un ingrediente nuevo (Ingredientes) y bajo «Clasificación» (Ficha Técnica)
 * mientras la cuenta no tenga ninguna subreceta. Se cierra con «Entendido» (una vez por
 * aparato, en las dos pantallas) o sola cuando crea la primera subreceta.
 */

import { useEffect, useState } from "react"
import Link from "next/link"
import { Layers } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/contexts/language-context"

export const SUBRECIPE_TIP_KEY = "gm_subrecipe_tip_seen"

export function SubrecipeTip({ place, show, fichaHref = "/ficha-tecnica" }: { place: "ingredientes" | "ficha"; show: boolean; fichaHref?: string }) {
  const { t } = useLanguage()
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(SUBRECIPE_TIP_KEY) === "1")
    } catch {
      setDismissed(false)
    }
  }, [])

  if (!show || dismissed) return null

  const close = () => {
    setDismissed(true)
    try {
      window.localStorage.setItem(SUBRECIPE_TIP_KEY, "1")
    } catch {
      // Sin almacenamiento solo se cierra por ahora.
    }
  }

  return (
    <div className="flex gap-3 rounded-xl border border-info/30 bg-info-soft p-3 text-sm" data-subrecipe-tip={place}>
      <Layers className="mt-0.5 h-4 w-4 shrink-0 text-info" />
      <div className="min-w-0 flex-1 space-y-2">
        <p className="text-foreground">{t(place === "ingredientes" ? "subrecipe_tip_ingredients" : "subrecipe_tip_ficha")}</p>
        <div className="flex flex-wrap gap-2">
          {place === "ingredientes" && (
            <Link href={fichaHref}>
              <Button type="button" size="sm" variant="outline">
                {t("subrecipe_tip_open")}
              </Button>
            </Link>
          )}
          <Button type="button" size="sm" variant="ghost" onClick={close}>
            {t("subrecipe_tip_ok")}
          </Button>
        </div>
      </div>
    </div>
  )
}
