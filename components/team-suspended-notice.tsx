"use client"

/**
 * Aviso para la persona invitada cuando el plan de la cuenta que la invitó ya no incluye
 * Equipo (docs/236): perdió el acceso a esos negocios, sin que se borre nada, y lo recupera
 * si el dueño vuelve a un plan con Equipo. Se muestra en el Dashboard.
 */

import { useEffect, useState } from "react"
import { Users } from "lucide-react"
import { useLanguage } from "@/contexts/language-context"
import { ensureMyMembershipsLoaded, getSuspendedMemberships } from "@/lib/storage/team"
import type { TeamMember } from "@/types/team"

export function TeamSuspendedNotice() {
  const { t } = useLanguage()
  const [suspended, setSuspended] = useState<TeamMember[]>([])

  useEffect(() => {
    let alive = true
    ensureMyMembershipsLoaded()
      .then(() => alive && setSuspended(getSuspendedMemberships()))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  if (suspended.length === 0) return null
  return (
    <div className="space-y-2">
      {suspended.map((m) => (
        <div key={m.id} className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning-soft p-4">
          <Users className="h-5 w-5 text-warning shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="text-sm font-medium text-foreground">{t("team_suspended_title").replace("{owner}", m.ownerName || "—")}</p>
            <p className="text-sm text-text-3">{t("team_suspended_desc")}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
