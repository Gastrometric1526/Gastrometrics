"use client"

/**
 * Aviso único de subrecetas para las cuentas que ya existían (pedido del dueño, docs/339):
 * «el aviso sobre las subrecetas que sirven como ingrediente, un pop-up que les aparezca a los
 * usuarios existentes la siguiente vez que la app o la página se recargue».
 *
 * - Solo cuentas creadas antes de SUBRECIPE_ANNOUNCEMENT_SINCE (las nuevas lo aprenden en el
 *   tutorial guiado, docs/335); una sola vez por persona y aparato.
 * - Nunca en páginas públicas ni /admin, ni en la Vista previa de equipo, ni a un mesero
 *   (invitado solo del POS), ni encima de otra ventana o tutorial: espera a que se cierren.
 * - «Ver cómo se hace» abre el tutorial de la Ficha Técnica (paso «Nombre y clasificación»).
 */

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/auth-context"
import { useLanguage } from "@/contexts/language-context"
import { useTeamPreview } from "@/lib/plan-access"
import { isQuiet } from "@/components/feedback/feedback-orchestrator"
import { ensureMyMembershipsLoaded } from "@/lib/storage/team"
import { realPosOnlyMember } from "@/components/pos/pos-only-redirect"
import { tourHref } from "@/lib/tour-links"
import { GmSaucepan } from "@/components/icons/gm-icons"

/** Cuentas creadas antes de este día ven el aviso (el tutorial ya lo enseña desde aquí). */
export const SUBRECIPE_ANNOUNCEMENT_SINCE = "2026-11-19T00:00:00-06:00"
const seenKey = (userId: string) => `gm_subrecipe_announcement_v1:${userId}`

export function subrecipeAnnouncementDue(input: { createdAt?: string | null; seen: boolean }): boolean {
  if (input.seen || !input.createdAt) return false
  return new Date(input.createdAt).getTime() < new Date(SUBRECIPE_ANNOUNCEMENT_SINCE).getTime()
}

export function SubrecipeAnnouncement() {
  const { user, userProfile } = useAuth()
  const { t } = useLanguage()
  const pathname = usePathname()
  const router = useRouter()
  const { active: previewActive } = useTeamPreview()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!user || previewActive || isQuiet(pathname) || open) return
    let seen = true
    try {
      seen = window.localStorage.getItem(seenKey(user.id)) === "1"
    } catch {
      return // sin almacenamiento no se puede recordar: mejor no mostrarlo cada vez
    }
    if (!subrecipeAnnouncementDue({ createdAt: userProfile?.createdAt, seen })) return
    let cancelled = false
    let tries = 0
    let timer: ReturnType<typeof setTimeout>
    const decide = async () => {
      if (cancelled) return
      // Novedades, vencimiento, una encuesta o un tutorial abiertos: espera a que se cierren.
      if (document.querySelector('[role="dialog"], [role="alertdialog"], [data-tour-overlay], [data-journey-coach]')) {
        if (++tries < 40) timer = setTimeout(decide, 3000)
        return
      }
      await ensureMyMembershipsLoaded().catch(() => {})
      if (cancelled || realPosOnlyMember()) return
      setOpen(true)
    }
    timer = setTimeout(decide, 2500)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, userProfile?.createdAt, pathname, previewActive])

  const close = () => {
    if (user) {
      try {
        window.localStorage.setItem(seenKey(user.id), "1")
      } catch {
        /* nada */
      }
    }
    setOpen(false)
  }

  if (!open) return null
  return (
    <Dialog open onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <span className="mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <GmSaucepan className="h-5 w-5" />
          </span>
          <DialogTitle>{t("subrecipe_announce_title")}</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>{t("subrecipe_announce_p1")}</p>
              <p>{t("subrecipe_announce_p2")}</p>
              <p>{t("subrecipe_announce_p3")}</p>
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-0">
          <Button variant="ghost" onClick={close}>
            {t("subrecipe_announce_ok")}
          </Button>
          <Button
            onClick={() => {
              close()
              router.push(tourHref("ficha-tecnica"))
            }}
          >
            {t("subrecipe_announce_cta")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
