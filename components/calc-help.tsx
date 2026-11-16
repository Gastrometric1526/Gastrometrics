"use client"

/**
 * «¿Cómo se calcula?» (docs/322): el botón con el signo de pregunta que abre la explicación de
 * un número con las cifras reales ya puestas en cada fórmula. Mismo diseño que las
 * explicaciones de la Ficha Técnica, Finanzas y las órdenes sugeridas, para que todo cálculo
 * nuevo se pueda revisar igual. Los pasos llegan ya armados por quien lo usa (con sus cifras).
 */

import type { ReactNode } from "react"
import { useState } from "react"
import { CircleHelp, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useLanguage } from "@/contexts/language-context"
import { cn } from "@/lib/utils"

export interface CalcStep {
  /** Qué se calcula, en palabras («Lo que llegó»). */
  label: string
  /** La fórmula con las cifras reales («8 kg × 30 = 240»). */
  formula: string
  /** Una aclaración corta debajo, opcional. */
  note?: string
}

export function CalcHelp({
  title,
  intro,
  steps,
  footer,
  className,
  label,
}: {
  title?: string
  intro?: string
  steps: CalcStep[]
  footer?: ReactNode
  className?: string
  /** Texto visible junto al signo (si no, solo el ícono). */
  label?: string
}) {
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)
  const heading = title || t("calc_help_title")
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size={label ? "sm" : "icon"}
        className={cn(label ? "h-8 gap-1.5 px-2 text-muted-foreground" : "h-8 w-8 shrink-0 text-muted-foreground", className)}
        onClick={() => setOpen(true)}
        aria-label={heading}
        title={heading}
      >
        <CircleHelp className="h-4 w-4" />
        {label && <span className="text-xs">{label}</span>}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info className="h-5 w-5 text-primary" />
              {heading}
            </DialogTitle>
            {intro && <DialogDescription>{intro}</DialogDescription>}
          </DialogHeader>
          <div className="max-h-[60vh] space-y-3 overflow-y-auto text-sm">
            {steps.map((s, i) => (
              <div key={i}>
                <p className="mb-1 font-medium text-foreground">{s.label}</p>
                <div className="rounded border bg-muted/50 p-3 font-mono text-xs sm:text-sm tabular-nums break-words">{s.formula}</div>
                {s.note && <p className="mt-1 text-xs text-muted-foreground">{s.note}</p>}
              </div>
            ))}
            {footer}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
