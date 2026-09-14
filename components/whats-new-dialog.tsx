"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Sparkles } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { useLanguage } from "@/contexts/language-context"
import { LATEST_CHANGELOG_VERSION, getChangelogContent } from "@/lib/changelog"

const SEEN_KEY_PREFIX = "changelog_seen_"

/**
 * Pop-up de "novedades" al entrar — se muestra una sola vez por versión de
 * changelog y por cuenta (bandera en localStorage, mismo patrón que los tours
 * guiados de components/page-tour.tsx). Vive montado en el Dashboard, igual que
 * OnboardingTour — nunca se dispara en /login ni en la landing.
 */
export function WhatsNewDialog() {
  const { user } = useAuth()
  const { language, t } = useLanguage()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!user) return
    // Si el tour de bienvenida (components/onboarding-tour.tsx) todavía no se vio,
    // no se apila este pop-up encima — a alguien completamente nuevo ya le está
    // explicando la app ese otro flujo. No se marca como "visto" en este caso: en su
    // próximo ingreso, ya con el tour completado, sí lo verá.
    const onboardingDone = localStorage.getItem("onboarding_completed") === "true"
    if (!onboardingDone) return

    const key = `${SEEN_KEY_PREFIX}${user.id}`
    const seenVersion = typeof window !== "undefined" ? localStorage.getItem(key) : LATEST_CHANGELOG_VERSION
    if (seenVersion !== LATEST_CHANGELOG_VERSION) {
      setOpen(true)
    }
  }, [user])

  const handleClose = () => {
    if (user) {
      localStorage.setItem(`${SEEN_KEY_PREFIX}${user.id}`, LATEST_CHANGELOG_VERSION)
    }
    setOpen(false)
  }

  const content = getChangelogContent(language)

  return (
    <Dialog open={open} onOpenChange={(next) => !next && handleClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {content.title}
          </DialogTitle>
        </DialogHeader>
        <ul className="space-y-3 py-2">
          {content.items.map((item, index) => (
            <li key={index} className="flex items-start gap-2.5 text-sm text-foreground">
              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <DialogFooter>
          <Button onClick={handleClose} className="w-full sm:w-auto">
            {t("whats_new_close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
