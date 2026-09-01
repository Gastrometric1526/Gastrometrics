"use client"

import { useEffect, useState } from "react"
import { Download, Share } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { useLanguage } from "@/contexts/language-context"

// Botón fijo para instalar la app (PWA) — pedido explícito: "en el landing page debe
// siempre haber un boton para descargar la app en cualquier momento para celular".
// Solo aparece en móvil (md:hidden) y solo si la app no está ya instalada (si ya corre
// en modo standalone, no tiene sentido ofrecerlo). Android/Chrome sí puede disparar el
// instalador nativo via el evento beforeinstallprompt; iOS/Safari no lo soporta en
// absoluto — ahí solo se puede mostrar el paso manual (Compartir → Agregar a inicio).
export function InstallAppButton() {
  const { t } = useLanguage()
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [isStandalone, setIsStandalone] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [showIOSInstructions, setShowIOSInstructions] = useState(false)

  useEffect(() => {
    setIsStandalone(
      window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone === true,
    )
    setIsIOS(/iphone|ipad|ipod/i.test(window.navigator.userAgent) && !(window as any).MSStream)

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setDeferredPrompt(event)
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt)

    const onInstalled = () => setIsStandalone(true)
    window.addEventListener("appinstalled", onInstalled)

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt)
      window.removeEventListener("appinstalled", onInstalled)
    }
  }, [])

  if (isStandalone) return null

  const handleClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      await deferredPrompt.userChoice
      setDeferredPrompt(null)
      return
    }
    // iOS, u otro navegador que no soporta beforeinstallprompt (o todavía no lo
    // disparó) — no hay instalador programático posible, solo mostrar el paso manual.
    setShowIOSInstructions(true)
  }

  return (
    <>
      <div className="md:hidden fixed bottom-4 left-4 right-4 z-40">
        <Button onClick={handleClick} className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
          <Download className="h-4 w-4" />
          {t("install_app_button")}
        </Button>
      </div>

      <Dialog open={showIOSInstructions} onOpenChange={setShowIOSInstructions}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("install_app_dialog_title")}</DialogTitle>
            <DialogDescription className="space-y-3 pt-2 text-left">
              {isIOS ? (
                <span className="flex items-start gap-2">
                  <Share className="h-4 w-4 mt-0.5 shrink-0" />
                  {t("install_app_ios_steps")}
                </span>
              ) : (
                <span>{t("install_app_generic_steps")}</span>
              )}
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </>
  )
}
