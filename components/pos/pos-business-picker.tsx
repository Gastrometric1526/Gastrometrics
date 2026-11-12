"use client"

/**
 * El POS trabaja siempre dentro de UN negocio a la vez (pedido del dueño, docs/276): cada uno
 * tiene su salón, su carta, sus extras, su caja, sus ventas y sus reportes, y nada se mezcla.
 * El espacio principal es el primer negocio de la cuenta (ahí viven sus recetas y menús).
 * /salon sin negocio muestra esta pantalla; con un solo negocio disponible entra directo, y a
 * un invitado con alcance de un negocio se le abre el suyo.
 */

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Armchair, ArrowLeft, Building2, Lock, Store } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Sidebar } from "@/components/sidebar"
import { useLanguage } from "@/contexts/language-context"
import { useAllBusinesses } from "@/lib/storage/businesses"
import { useLockedBusinessIds } from "@/components/business-lock-overlay"
import { getActiveMemberScope } from "@/lib/plan-access"
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
  const [last, setLast] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setScope(getActiveMemberScope())
    try {
      setLast(localStorage.getItem(POS_BUSINESS_KEY))
    } catch {}
    // La lista de negocios llega en segundo plano: se espera un momento antes de entrar solo.
    const id = setTimeout(() => setReady(true), 1200)
    return () => clearTimeout(id)
  }, [])

  // El espacio principal es el primer negocio de la cuenta (ahí viven sus recetas y menús).
  // Un invitado con alcance de un negocio solo ve ese negocio.
  const options = useMemo(() => {
    const own = [{ id: "main", name: t("pos_main_space") }, ...businesses.map((b) => ({ id: b.id, name: b.name }))]
    const list = scope && scope !== "dashboard" ? own.filter((b) => b.id === scope) : own
    return [...list].sort((a, b) => (a.id === last ? -1 : b.id === last ? 1 : a.id === "main" ? -1 : b.id === "main" ? 1 : a.name.localeCompare(b.name)))
  }, [businesses, scope, last, t])
  const usable = options.filter((b) => !locked.includes(b.id))

  // Con un solo negocio disponible se entra directo.
  useEffect(() => {
    if (ready && usable.length === 1) router.replace(`/salon?business=${usable[0].id}`)
  }, [ready, usable, router])

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

          {options.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                <Store className="h-10 w-10 text-muted-foreground" />
                <p className="text-base font-semibold">{t("pos_pick_none_title")}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {options.map((b) => {
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
                      {isLocked ? <Lock className="h-5 w-5" /> : b.id === "main" ? <Store className="h-5 w-5" /> : <Building2 className="h-5 w-5" />}
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
        </div>
      </div>
    </div>
  )
}
