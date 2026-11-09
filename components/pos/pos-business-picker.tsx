"use client"

/**
 * El POS trabaja siempre dentro de un negocio (pedido del dueño, docs/276): cada negocio tiene
 * su salón, su carta, sus extras, su caja, sus ventas y sus reportes, y nada se mezcla entre
 * negocios. /salon sin negocio muestra esta pantalla para elegirlo:
 * - con un solo negocio disponible, entra directo;
 * - a un invitado con alcance de un negocio, se le abre el suyo;
 * - sin negocios, invita a crear el primero;
 * - si quedó un POS en el espacio principal (de antes de docs/276) con cuentas abiertas, deja
 *   entrar a cerrarlas.
 */

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Armchair, ArrowLeft, Building2, Lock, Plus, Store } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Sidebar } from "@/components/sidebar"
import { useLanguage } from "@/contexts/language-context"
import { useAllBusinesses } from "@/lib/storage/businesses"
import { useLockedBusinessIds } from "@/components/business-lock-overlay"
import { getActiveMemberScope, hasActiveMembership } from "@/lib/plan-access"
import { fetchPosData } from "@/lib/storage/pos"
import { cn } from "@/lib/utils"

export const POS_BUSINESS_KEY = "gm_pos_business"

export function rememberPosBusiness(businessId: string) {
  try {
    localStorage.setItem(POS_BUSINESS_KEY, businessId)
  } catch {}
}

export function PosBusinessPicker() {
  const { t } = useLanguage()
  const router = useRouter()
  const businesses = useAllBusinesses()
  const locked = useLockedBusinessIds()
  const [scope, setScope] = useState<string | null>(null)
  const [member, setMember] = useState(false)
  const [last, setLast] = useState<string | null>(null)
  const [legacyOpen, setLegacyOpen] = useState(0)
  const [legacyFloor, setLegacyFloor] = useState(false)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    setScope(getActiveMemberScope())
    setMember(hasActiveMembership())
    try {
      setLast(localStorage.getItem(POS_BUSINESS_KEY))
    } catch {}
  }, [])

  // POS que quedó en el espacio principal (solo el dueño lo tenía ahí).
  useEffect(() => {
    if (member) {
      setChecked(true)
      return
    }
    fetchPosData("main")
      .then((d) => {
        setLegacyOpen(d.orders.filter((o) => o.items.length > 0).length)
        setLegacyFloor(!!d.floor)
      })
      .catch(() => {})
      .finally(() => setChecked(true))
  }, [member])

  const available = useMemo(() => {
    const list = scope && scope !== "dashboard" ? businesses.filter((b) => b.id === scope) : businesses
    return [...list].sort((a, b) => (a.id === last ? -1 : b.id === last ? 1 : a.name.localeCompare(b.name)))
  }, [businesses, scope, last])
  const usable = available.filter((b) => !locked.includes(b.id))

  // Un solo negocio disponible (y nada pendiente de antes): se entra directo.
  useEffect(() => {
    if (checked && usable.length === 1 && legacyOpen === 0) router.replace(`/salon?business=${usable[0].id}`)
  }, [checked, usable, legacyOpen, router])

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto p-4 md:p-6 lg:p-8 space-y-6">
          <div className="flex items-center gap-2 md:gap-4" data-tour="salon-header">
            <Link href="/dashboard">
              <Button variant="outline" size="sm" className="gap-2 bg-transparent">
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">{t("mi_plan_back_to_dashboard")}</span>
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-chart-6/10 rounded-lg flex items-center justify-center">
                <Armchair className="h-6 w-6 text-chart-6" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-foreground">{t("pos_pick_title")}</h1>
                <p className="text-sm md:text-base text-muted-foreground">{t("pos_pick_desc")}</p>
              </div>
            </div>
          </div>

          {legacyOpen > 0 && (
            <div className="flex flex-col gap-3 rounded-lg border border-warning/40 bg-warning-soft p-4 text-sm text-warning sm:flex-row sm:items-center sm:justify-between">
              <span>{t("pos_pick_legacy").replace("{n}", String(legacyOpen))}</span>
              <Button size="sm" variant="outline" className="shrink-0 self-start sm:self-auto" onClick={() => router.push("/salon?business=main&legacy=1")}>
                {t("pos_pick_legacy_open")}
              </Button>
            </div>
          )}

          {available.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                <Store className="h-10 w-10 text-muted-foreground" />
                <p className="text-base font-semibold">{t("pos_pick_none_title")}</p>
                <p className="max-w-md text-sm text-muted-foreground">{t("pos_pick_none_desc")}</p>
                {!member && (
                  <Link href="/negocios">
                    <Button className="gap-2">
                      <Plus className="h-4 w-4" />
                      {t("pos_pick_create")}
                    </Button>
                  </Link>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {available.map((b) => {
                const isLocked = locked.includes(b.id)
                return (
                  <button
                    key={b.id}
                    type="button"
                    disabled={isLocked}
                    onClick={() => {
                      rememberPosBusiness(b.id)
                      router.push(`/salon?business=${b.id}`)
                    }}
                    className={cn(
                      "flex items-start gap-3 rounded-xl border bg-card p-4 text-left transition",
                      isLocked ? "cursor-not-allowed opacity-60" : "hover:border-primary hover:shadow-sm",
                    )}
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      {isLocked ? <Lock className="h-5 w-5" /> : <Building2 className="h-5 w-5" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-foreground">{b.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {isLocked ? t("pos_pick_locked") : b.id === last ? t("pos_pick_last") : t("pos_pick_open")}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          {legacyFloor && available.length > 0 && <p className="text-xs text-muted-foreground">{t("pos_pick_legacy_floor")}</p>}
        </div>
      </div>
    </div>
  )
}
