"use client"

/**
 * El mesero entra directo al POS (pedido del dueño, docs/302): un invitado del equipo que
 * solo tiene el POS (`isPosOnlyMember`) no tiene nada que hacer en el Dashboard, así que al
 * llegar ahí se le lleva al salón. La Vista previa de Equipo del dueño no redirige (el dueño
 * sigue pudiendo moverse por la app mientras prueba).
 */

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { ensureMyMembershipsLoaded, getMyMemberships } from "@/lib/storage/team"
import { getActivePreviewMember } from "@/lib/storage/team-preview"
import { isPosOnlyMember } from "@/lib/pos-waiter"

/** La membresía real que manda en la sesión, si la hay (misma regla que lib/plan-access.ts). */
export function realPosOnlyMember(): boolean {
  if (getActivePreviewMember()) return false
  const member = getMyMemberships().filter((m) => m.ownerTeamActive !== false)[0]
  return !!member && isPosOnlyMember(member.allowedFeatures)
}

export function PosOnlyRedirect() {
  const router = useRouter()
  useEffect(() => {
    let alive = true
    ensureMyMembershipsLoaded()
      .then(() => {
        if (alive && realPosOnlyMember()) router.replace("/salon")
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [router])
  return null
}
