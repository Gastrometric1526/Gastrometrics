"use client"

/**
 * Recordatorio de subrecetas para quien ya usa la app (pedido del dueño, docs/300): «incluso
 * para las personas que están en línea… un mensaje que les recuerda que pueden crear recetas
 * para sus recetas, por ejemplo, salsa de tomate para espagueti».
 *
 * Una ventana, UNA vez por cuenta (en este aparato), a quien ya tiene al menos una receta y
 * ninguna subreceta. Las cuentas nuevas sin recetas ya tienen la nota de docs/299.
 * - Nunca en la misma carga que la ventana de Novedades: solo si la última novedad ya estaba
 *   vista al abrir la app.
 * - Nunca encima de otra ventana, del tutorial guiado ni de la vista previa de Equipo.
 * - Cuenta las recetas de la propia cuenta (todos sus negocios), con la clasificación real.
 */

import { useEffect, useRef, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Layers } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/auth-context"
import { useLanguage } from "@/contexts/language-context"
import { useActiveMembership } from "@/lib/plan-access"
import { JOURNEY_ROUTES, journeyControlsTours, readJourney } from "@/lib/journey"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { LATEST_CHANGELOG_VERSION } from "@/lib/changelog"
import { SUBRECIPE_CLASSIFICATION } from "@/types/recipe"

const DIALOG_OPEN = '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"], [data-tour-overlay]'
export const SUBRECIPE_INTRO_KEY = "gm_subrecipe_intro_"

export function SubrecipeIntro() {
  const pathname = usePathname()
  const router = useRouter()
  const { t } = useLanguage()
  const { user } = useAuth()
  const { active: previewActive } = useActiveMembership()
  const [open, setOpen] = useState(false)
  // ¿La última novedad ya estaba vista al cargar la app? Si no, hoy le toca a Novedades.
  const changelogSeenAtLoad = useRef<boolean | null>(null)

  const onAppPage = !!pathname && JOURNEY_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"))

  useEffect(() => {
    if (!user || previewActive || !onAppPage || open) return
    let key: string
    try {
      if (changelogSeenAtLoad.current === null) {
        changelogSeenAtLoad.current = window.localStorage.getItem(`changelog_seen_${user.id}`) === LATEST_CHANGELOG_VERSION
      }
      key = `${SUBRECIPE_INTRO_KEY}${user.id}`
      if (window.localStorage.getItem(key)) return
    } catch {
      return
    }
    if (!changelogSeenAtLoad.current) return
    if (journeyControlsTours(readJourney())) return

    let cancelled = false
    let timer: ReturnType<typeof setTimeout>
    let tries = 0
    const run = async () => {
      if (cancelled) return
      if (document.querySelector(DIALOG_OPEN)) {
        if (++tries < 12) timer = setTimeout(run, 5000)
        return
      }
      const supabase = getSupabaseBrowserClient()
      const [all, subs] = await Promise.all([
        supabase.from("recipes").select("id", { count: "exact", head: true }).eq("owner_id", user.id),
        supabase.from("recipes").select("id", { count: "exact", head: true }).eq("owner_id", user.id).eq("classification", SUBRECIPE_CLASSIFICATION),
      ])
      if (cancelled || all.error || subs.error) return
      if ((subs.count ?? 0) > 0) {
        // Ya sabe hacerlas: no hace falta volver a preguntar.
        try {
          window.localStorage.setItem(key, "has_subrecipes")
        } catch {}
        return
      }
      if ((all.count ?? 0) < 1 || document.querySelector(DIALOG_OPEN)) return
      try {
        window.localStorage.setItem(key, new Date().toISOString())
      } catch {
        // Sin almacenamiento no se muestra, para no repetirla en cada página.
        return
      }
      setOpen(true)
    }
    timer = setTimeout(run, 6000)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
    // Se decide una vez por página.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, previewActive, onAppPage, pathname])

  if (!open) return null

  return (
    <Dialog open onOpenChange={(o) => !o && setOpen(false)}>
      <DialogContent className="max-w-md" data-subrecipe-intro>
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary">
            <Layers className="h-6 w-6" />
          </div>
          <DialogTitle className="text-center">{t("subrecipe_intro_title")}</DialogTitle>
          <DialogDescription className="text-center">{t("subrecipe_intro_body")}</DialogDescription>
        </DialogHeader>
        <p className="text-center text-sm text-muted-foreground">{t("subrecipe_intro_why")}</p>
        <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
          <Button
            className="w-full"
            onClick={() => {
              setOpen(false)
              router.push("/ficha-tecnica")
            }}
          >
            {t("subrecipe_intro_cta")}
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => setOpen(false)}>
            {t("nudge_later")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
