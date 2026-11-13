"use client"

/**
 * Invitación a volver a un módulo (docs/269). A quien usa la app cada semana y nunca usó un
 * módulo de su menú (o, si lo usó, hace más de 90 días, docs/297), le sale una ventana corta
 * que le cuenta para qué le sirve, siguiendo la línea de uso del sistema (lib/module-nudge.ts).
 * Como mucho una cada 7 días; nunca encima de otra ventana, del tutorial guiado o de la
 * vista previa de Equipo. Las visitas salen del registro de actividad («entró a…»).
 */

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/auth-context"
import { useLanguage } from "@/contexts/language-context"
import { useNavigationItems } from "@/components/sidebar"
import { useModuleReveal } from "@/lib/module-reveal"
import { useActiveMembership } from "@/lib/plan-access"
import { JOURNEY_ROUTES, journeyControlsTours, readJourney } from "@/lib/journey"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { logActivity, type ActivityModule } from "@/lib/services/activity-log"
import { isWeeklyUser, markNudgeShown, modulesToLookUp, NUDGE_ORDER, NUDGE_STATE_KEY, parseNudgeState, pickNudge, type NudgePick } from "@/lib/module-nudge"
import type { TranslationKey } from "@/lib/i18n/translations"

const DIALOG_OPEN = '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"], [data-tour-overlay]'

export function ModuleNudge() {
  const pathname = usePathname()
  const router = useRouter()
  const { t } = useLanguage()
  const { user } = useAuth()
  const items = useNavigationItems()
  const { active: previewActive } = useActiveMembership()
  const reveal = useModuleReveal({ disabled: previewActive })
  const [pick, setPick] = useState<NudgePick | null>(null)

  const onAppPage = !!pathname && JOURNEY_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"))
  const available = items.filter((i) => !i.locked && !reveal.hidden.has(i.href)).map((i) => i.href)
  const availableKey = available.join("|")

  useEffect(() => {
    if (!user || previewActive || !onAppPage || pick) return
    if (journeyControlsTours(readJourney())) return
    const key = `${NUDGE_STATE_KEY}:${user.id}`
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>
    let tries = 0
    const run = async () => {
      if (cancelled) return
      if (document.querySelector(DIALOG_OPEN)) {
        if (++tries < 12) timer = setTimeout(run, 5000)
        return
      }
      let state
      try {
        state = parseNudgeState(window.localStorage.getItem(key))
      } catch {
        return
      }
      const since = new Date(Date.now() - 60 * 86_400_000).toISOString()
      const supabase = getSupabaseBrowserClient()
      const { data, error } = await supabase
        .from("activity_log")
        .select("module, created_at")
        .eq("user_id", user.id)
        .eq("action", "entered")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(2000)
      if (cancelled || error || !data) return
      const visits = data.map((r) => ({ module: r.module, at: r.created_at }))
      if (!isWeeklyUser(visits.map((v) => v.at))) return
      // Historial completo de los módulos sin visita reciente (docs/297): si alguna vez lo
      // usó (cualquier acción), solo se invita después de meses sin tocarlo.
      const lastUse: Record<string, string> = {}
      const lookups = await Promise.all(
        modulesToLookUp(visits, availableKey.split("|")).map((module) =>
          supabase
            .from("activity_log")
            .select("module, created_at")
            .eq("user_id", user.id)
            .eq("module", module)
            .not("action", "like", "nudge_%")
            .order("created_at", { ascending: false })
            .limit(1),
        ),
      )
      if (cancelled) return
      // Si una consulta falla no se sabe si lo usó: mejor no invitar hoy.
      if (lookups.some((r) => r.error)) return
      for (const r of lookups) for (const row of r.data ?? []) lastUse[row.module] = row.created_at
      const next = pickNudge({ visits, available: availableKey.split("|"), state, lastUse })
      if (!next || document.querySelector(DIALOG_OPEN)) return
      try {
        window.localStorage.setItem(key, JSON.stringify(markNudgeShown(state, next.href)))
      } catch {
        // Sin almacenamiento no se muestra, para no repetirla en cada página.
        return
      }
      setPick(next)
      const mod = NUDGE_ORDER.find((m) => m.href === next.href)?.module
      if (mod) logActivity({ user: { id: user.id, email: user.email ?? "" }, businessId: null, module: mod as ActivityModule, action: "nudge_shown" })
    }
    timer = setTimeout(run, 8000)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
    // Se decide una vez por página; `pick` evita volver a decidir con la ventana abierta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, previewActive, onAppPage, pathname, availableKey])

  if (!pick) return null
  const item = items.find((i) => i.href === pick.href)
  if (!item || !NUDGE_ORDER.some((m) => m.href === pick.href)) return null
  const Icon = item.icon
  const close = () => setPick(null)

  return (
    <Dialog open onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary">
            <Icon className="h-6 w-6" />
          </div>
          <DialogTitle className="text-center">{t("nudge_title").replace("{module}", item.title)}</DialogTitle>
          <DialogDescription className="text-center">{t(`nudge_why_${pick.slug}` as TranslationKey)}</DialogDescription>
        </DialogHeader>
        <p className="text-center text-xs text-muted-foreground">
          {pick.idleDays === null ? t("nudge_never") : t("nudge_idle").replace("{n}", String(pick.idleDays))}
        </p>
        <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
          <Button
            className="w-full"
            onClick={() => {
              close()
              const mod = NUDGE_ORDER.find((m) => m.href === pick.href)?.module
              if (mod && user) logActivity({ user: { id: user.id, email: user.email ?? "" }, businessId: null, module: mod as ActivityModule, action: "nudge_opened" })
              router.push(pick.href)
            }}
          >
            {t("nudge_open").replace("{module}", item.title)}
          </Button>
          <Button variant="ghost" className="w-full" onClick={close}>
            {t("nudge_later")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
