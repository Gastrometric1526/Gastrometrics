"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Settings2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sidebar } from "@/components/sidebar"
import { AuthGuard } from "@/components/auth-guard"
import { PlansGrid } from "@/components/plans-grid"
import { useLanguage } from "@/contexts/language-context"
import { useToast } from "@/hooks/use-toast"

// Página de plan dentro del dashboard — antes, "Plan: X" en el sidebar y el CTA de
// las pantallas bloqueadas por plan (components/feature-locked.tsx) mandaban a /planes,
// la página pública de marketing (sin Sidebar, con el nav de /about, /contacto...).
// Para un usuario que YA tiene cuenta y solo quiere cambiar de plan, eso significaba
// salir por completo del dashboard para volver a entrar después — la grilla de planes
// es la misma (components/plans-grid.tsx), pero esta vive dentro del shell de la app.
export default function MiPlanPage() {
  const { t } = useLanguage()
  const { toast } = useToast()
  const [stripeCustomerId, setStripeCustomerId] = useState<string | null>(null)
  const [isOpeningPortal, setIsOpeningPortal] = useState(false)

  // El botón de Portal de Cliente solo aparece para quien ya completó un pago real por
  // Stripe Checkout (ver app/dashboard/page.tsx, que guarda esto al volver del pago) —
  // alguien en el plan Foodie gratis nunca tiene un customer id de Stripe.
  useEffect(() => {
    setStripeCustomerId(localStorage.getItem("stripe_customer_id"))
  }, [])

  const handleManageSubscription = async () => {
    if (!stripeCustomerId) return
    setIsOpeningPortal(true)
    try {
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: stripeCustomerId }),
      })
      const data = await res.json()
      if (!res.ok || !data.url) {
        toast({
          title: t("mi_plan_portal_error_title"),
          description: data.error || t("mi_plan_portal_error_desc"),
          variant: "destructive",
        })
        setIsOpeningPortal(false)
        return
      }
      window.location.href = data.url
    } catch {
      toast({
        title: t("mi_plan_portal_error_title"),
        description: t("mi_plan_portal_error_desc"),
        variant: "destructive",
      })
      setIsOpeningPortal(false)
    }
  }

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <div className="flex-1 p-4 md:p-8">
          <div className="max-w-7xl mx-auto space-y-8">
            <div className="flex items-center justify-between gap-2 md:gap-4 flex-wrap">
              <div className="flex items-center gap-2 md:gap-4">
                <Link href="/dashboard">
                  <Button variant="outline" size="sm" className="gap-2 hover:bg-accent border-2 shadow-sm bg-transparent">
                    <ArrowLeft className="h-4 w-4" />
                    <span className="hidden sm:inline">{t("mi_plan_back_to_dashboard")}</span>
                    <span className="sm:hidden">{t("common_back")}</span>
                  </Button>
                </Link>
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold text-foreground">{t("mi_plan_title")}</h1>
                  <p className="text-sm md:text-base text-muted-foreground">{t("mi_plan_subtitle")}</p>
                </div>
              </div>
              {stripeCustomerId && (
                <Button variant="outline" size="sm" className="gap-2" onClick={handleManageSubscription} disabled={isOpeningPortal}>
                  <Settings2 className="h-4 w-4" />
                  {isOpeningPortal ? t("mi_plan_portal_opening") : t("mi_plan_manage_subscription")}
                </Button>
              )}
            </div>

            <PlansGrid freeRedirectTo="/mi-plan" />
          </div>
        </div>
      </div>
    </AuthGuard>
  )
}
