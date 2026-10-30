"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Sparkles } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { useLanguage } from "@/contexts/language-context"
import { PLAN_TOUR_PENDING_KEY } from "@/lib/plan-tour"
import { LATEST_CHANGELOG_VERSION, changelogDate, getChangelogEntry } from "@/lib/changelog"
import { parseTourHref, TOUR_KEY_PREFIX } from "@/lib/tour-links"
import { formatDate } from "@/lib/date-format"
import { usePathname, useRouter } from "next/navigation"
import { GraduationCap } from "lucide-react"

const SEEN_KEY_PREFIX = "changelog_seen_"

/** Abre la ventana con una novedad concreta: `{ detail: { version } }` (docs/208, desde Notificaciones). */
export const WHATS_NEW_OPEN_EVENT = "gm:whats-new:open"

/**
 * Pop-up de "novedades" al entrar — se muestra una sola vez por versión de
 * changelog y por cuenta (bandera en localStorage, mismo patrón que los tours
 * guiados de components/page-tour.tsx). Vive montado en el Dashboard, igual que
 * OnboardingTour — nunca se dispara en /login ni en la landing.
 * Desde docs/208 también se reabre al tocar una novedad en «Notificaciones», con su
 * botón «Ver el tutorial».
 */
export function WhatsNewDialog() {
  const { user } = useAuth()
  const { language, t } = useLanguage()
  const [open, setOpen] = useState(false)
  const [version, setVersion] = useState<string>(LATEST_CHANGELOG_VERSION)
  const router = useRouter()
  const pathname = usePathname()
  const entry = getChangelogEntry(version)
  const tutorialHref = entry.tutorialHref ?? null

  useEffect(() => {
    if (!user) return
    // Si el tour de bienvenida (components/onboarding-tour.tsx) todavía no se vio,
    // no se apila este pop-up encima — a alguien completamente nuevo ya le está
    // explicando la app ese otro flujo. No se marca como "visto" en este caso: en su
    // próximo ingreso, ya con el tour completado, sí lo verá.
    const onboardingDone = localStorage.getItem("onboarding_completed") === "true"
    if (!onboardingDone) return
    // Mismo criterio con el tutorial de plan nuevo (components/plan-tour.tsx, docs/157):
    // si hay uno pendiente, las novedades esperan a la próxima visita.
    if (localStorage.getItem(PLAN_TOUR_PENDING_KEY)) return

    const key = `${SEEN_KEY_PREFIX}${user.id}`
    const seenVersion = typeof window !== "undefined" ? localStorage.getItem(key) : LATEST_CHANGELOG_VERSION
    if (seenVersion !== LATEST_CHANGELOG_VERSION) {
      setVersion(LATEST_CHANGELOG_VERSION)
      setOpen(true)
    }
  }, [user])

  useEffect(() => {
    const onOpen = (e: Event) => {
      const wanted = (e as CustomEvent<{ version?: string }>).detail?.version
      setVersion(wanted || LATEST_CHANGELOG_VERSION)
      setOpen(true)
    }
    window.addEventListener(WHATS_NEW_OPEN_EVENT, onOpen)
    return () => window.removeEventListener(WHATS_NEW_OPEN_EVENT, onOpen)
  }, [])

  const handleClose = () => {
    if (user && version === LATEST_CHANGELOG_VERSION) {
      localStorage.setItem(`${SEEN_KEY_PREFIX}${user.id}`, LATEST_CHANGELOG_VERSION)
    }
    setOpen(false)
  }

  // «Ver el tutorial» (docs/167): lleva a la sección y abre su tutorial desde el paso 1.
  const openTutorial = () => {
    if (!tutorialHref) return
    handleClose()
    const { path, slug } = parseTourHref(tutorialHref)
    if (slug && path === pathname) {
      window.dispatchEvent(new CustomEvent("gm:tour:restart", { detail: { storageKey: `${TOUR_KEY_PREFIX}${slug}` } }))
      return
    }
    router.push(tutorialHref)
  }

  const content = entry.content[language] || entry.content.es

  return (
    <Dialog open={open} onOpenChange={(next) => !next && handleClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {content.title}
          </DialogTitle>
          <DialogDescription>{formatDate(changelogDate(entry.version))}</DialogDescription>
        </DialogHeader>
        <ul className="space-y-3 py-2">
          {content.items.map((item, index) => (
            <li key={index} className="flex items-start gap-2.5 text-sm text-foreground">
              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <DialogFooter className="gap-2 sm:gap-2">
          {tutorialHref ? (
            <>
              <Button variant="outline" onClick={handleClose} className="w-full sm:w-auto">
                {t("whats_new_close")}
              </Button>
              <Button onClick={openTutorial} className="w-full sm:w-auto gap-2" data-tour="whats-new-tutorial">
                <GraduationCap className="h-4 w-4" />
                {t("whats_new_tutorial")}
              </Button>
            </>
          ) : (
            <Button onClick={handleClose} className="w-full sm:w-auto">
              {t("whats_new_close")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
