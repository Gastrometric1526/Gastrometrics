"use client"

/**
 * Pantalla de un negocio que supera el plan de su cuenta (docs/243). Cubre cualquier pantalla
 * abierta con ese negocio, por la ruta /business/<id> o por ?business=<id>. El dueño puede
 * descargar lo que tenía; quien fue invitado solo ve que está fuera de servicio.
 */

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { ArrowRight, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DownloadBackupButton } from "@/components/download-backup-button"
import { useAuth } from "@/contexts/auth-context"
import { useLanguage } from "@/contexts/language-context"
import { getBusinessById, useAllBusinesses } from "@/lib/storage/businesses"

export function useLockedBusinessIds(): string[] {
  const { isLoggedIn } = useAuth()
  const businesses = useAllBusinesses()
  const [locked, setLocked] = useState<string[]>([])
  const hasSeveral = businesses.length > 1

  useEffect(() => {
    if (!isLoggedIn || !hasSeveral) return setLocked([])
    let alive = true
    fetch("/api/plan/locks", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => alive && data && setLocked(data.lockedBusinessIds ?? []))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [isLoggedIn, hasSeveral])

  return locked
}

export function BusinessLockOverlay() {
  const { t } = useLanguage()
  const { userProfile } = useAuth()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const locked = useLockedBusinessIds()

  const businessId = pathname.match(/^\/business\/([^/]+)/)?.[1] ?? searchParams.get("business")
  if (!businessId || !locked.includes(businessId)) return null

  const business = getBusinessById(businessId)
  const isOwner = !business?.ownerId || business.ownerId === userProfile?.id

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background p-6" data-business-locked={businessId}>
      <div className="max-w-md w-full flex flex-col items-center text-center gap-4">
        <div className="w-16 h-16 rounded-full bg-primary-soft flex items-center justify-center">
          <Lock className="h-7 w-7 text-primary" />
        </div>
        <h1 className="text-xl font-bold text-foreground">{isOwner ? t("plan_lock_title").replace("{name}", business?.name ?? "") : t("plan_lock_guest_title")}</h1>
        <p className="text-sm text-text-3">{isOwner ? t("plan_lock_desc") : t("plan_lock_guest_desc")}</p>
        <div className="flex flex-wrap justify-center gap-2">
          {isOwner && <DownloadBackupButton />}
          {isOwner && (
            <Link href="/mi-plan">
              <Button className="gap-2">
                {t("landing_hero_cta_secondary")}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          )}
          <Link href="/dashboard">
            <Button variant="ghost">{t("plan_lock_back")}</Button>
          </Link>
        </div>
      </div>
    </div>
  )
}

/** Aviso en el Dashboard del dueño, para que no lo descubra al abrir el negocio. */
export function BusinessLockedNotice() {
  const { t } = useLanguage()
  const { userProfile } = useAuth()
  const businesses = useAllBusinesses()
  const locked = useLockedBusinessIds()
  const own = businesses.filter((b) => locked.includes(b.id) && (!b.ownerId || b.ownerId === userProfile?.id))
  if (own.length === 0) return null

  return (
    <div className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning-soft p-4">
      <Lock className="h-5 w-5 text-warning shrink-0 mt-0.5" />
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">{t("plan_lock_notice").replace("{names}", own.map((b) => b.name).join(", "))}</p>
        <DownloadBackupButton />
      </div>
    </div>
  )
}
