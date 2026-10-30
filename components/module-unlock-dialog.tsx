"use client"

/**
 * «¡Desbloqueaste nuevos módulos!» (pedido del dueño, docs/208): cuando la revelación
 * progresiva (lib/module-reveal.ts) abre módulos nuevos, se anuncian una sola vez con qué es
 * cada uno y un botón para ir. Mientras no se visitan, el menú y las Acciones Rápidas los
 * resaltan. Espera a que no haya un tutorial en pantalla para no apilarse encima.
 */

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, PartyPopper } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/contexts/language-context"

interface UnlockItem {
  href: string
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
}

export function ModuleUnlockDialog({ open, items, onClose }: { open: boolean; items: UnlockItem[]; onClose: () => void }) {
  const { t } = useLanguage()
  const router = useRouter()
  const [noTour, setNoTour] = useState(false)

  useEffect(() => {
    if (!open) return
    // Una vez visible se queda (no se cierra sola si después se abre otra cosa).
    const check = () =>
      setNoTour((shown) => shown || !document.querySelector("[data-gm-page-tour], [role=dialog][data-state=open]:not([data-module-unlock]), [role=alertdialog]"))
    check()
    const id = window.setInterval(check, 1500)
    return () => window.clearInterval(id)
  }, [open])

  if (!open || items.length === 0) return null
  const go = (href: string) => {
    onClose()
    router.push(href)
  }

  return (
    <Dialog open={noTour} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-[460px]" data-module-unlock="">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PartyPopper className="h-5 w-5 text-primary" />
            {t("module_unlock_title")}
          </DialogTitle>
          <DialogDescription>{t("module_unlock_desc")}</DialogDescription>
        </DialogHeader>
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.href}>
              <button
                type="button"
                onClick={() => go(item.href)}
                className="flex w-full items-center gap-3 rounded-xl border border-border p-3 text-left transition-colors hover:border-primary/40 hover:bg-muted/40"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <item.icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-foreground">{item.title}</span>
                  <span className="block text-xs text-muted-foreground">{item.description}</span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            </li>
          ))}
        </ul>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">
            {t("module_unlock_later")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
