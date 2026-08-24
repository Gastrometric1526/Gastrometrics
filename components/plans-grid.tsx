"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { plans } from "@/lib/plans"
import { useAuth } from "@/contexts/auth-context"
import { useLanguage } from "@/contexts/language-context"
import { useCurrentPlanSlug, setCurrentPlanSlug } from "@/lib/plan-access"
import { Check, X } from "lucide-react"

// Grilla de planes compartida entre /planes (pública, para visitantes sin sesión) y
// /mi-plan (dentro del dashboard, para quien ya tiene cuenta) — mismo contenido, solo
// cambia a dónde vuelve un plan gratis aplicado directo. Ver docs/38.
interface PlansGridProps {
  freeRedirectTo?: string
}

export function PlansGrid({ freeRedirectTo = "/dashboard" }: PlansGridProps) {
  const router = useRouter()
  const { isLoggedIn, authChecked } = useAuth()
  const { t } = useLanguage()
  const currentPlanSlug = useCurrentPlanSlug()
  // Mientras no se sabe con certeza que el visitante ya tiene sesion (authChecked +
  // currentPlanSlug ya montado), se muestra el mismo CTA de "no autenticado" que ve
  // un visitante anonimo — es exactamente lo que el servidor ya mando, asi que no hay
  // salto de hidratacion. Recien despues de eso se revela el flujo real.
  const knowsLoginState = authChecked && currentPlanSlug !== null

  const handleSelectPlan = async (planSlug: string, isFree: boolean) => {
    if (isFree) {
      const result = await fetch("/api/plan/set-free", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planSlug }),
      })
        .then((res) => res.json())
        .catch(() => null)
      setCurrentPlanSlug(result?.planSlug || planSlug)
      router.push(freeRedirectTo)
    } else {
      // "from=account": distingue a alguien que ya tenía cuenta y solo quiere subir de
      // plan (llegó hasta acá con isLoggedIn=true desde antes) de alguien completando
      // el registro por primera vez — que en /signup/payment.tsx TAMBIÉN tiene
      // isLoggedIn=true en ese punto, porque app/signup/page.tsx ya llamó login() antes
      // de redirigir acá. Sin esta marca, /signup/payment no puede distinguir los dos
      // casos para decidir a dónde vuelve "Volver"/"Cambiar de plan".
      router.push(`/signup/payment?plan=${planSlug}&from=account`)
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-5 max-w-7xl mx-auto items-stretch">
      {plans.map((plan) => (
        <Card
          key={plan.slug}
          className={`flex flex-col relative ${
            plan.highlighted ? "border-primary shadow-xl ring-1 ring-primary/30" : "border-border shadow-lg"
          }`}
        >
          {plan.highlighted && (
            <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground">
              {t("planes_most_chosen_badge")}
            </Badge>
          )}
          <CardHeader className="space-y-2">
            <CardTitle className="text-xl">{plan.name}</CardTitle>
            <p className="text-2xl font-bold text-foreground">{plan.price}</p>
            <CardDescription>{plan.tagline}</CardDescription>
          </CardHeader>
          <CardContent className="flex-grow flex flex-col">
            <ul className="space-y-2 text-sm flex-grow">
              {plan.features.map((feature, index) => (
                <li key={index} className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <span className="text-foreground">{feature}</span>
                </li>
              ))}
              {plan.locked.map((feature, index) => (
                <li key={index} className="flex items-start gap-2 opacity-50">
                  <X className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <span className="text-muted-foreground">{feature}</span>
                </li>
              ))}
            </ul>
            <div className="pt-6 mt-auto">
              {plan.comingSoon ? (
                <Button className="w-full" variant="outline" disabled>
                  {t("planes_available_for_businesses")}
                </Button>
              ) : knowsLoginState && isLoggedIn ? (
                currentPlanSlug === plan.slug ? (
                  <Button className="w-full" variant="outline" disabled>
                    {t("planes_current_plan")}
                  </Button>
                ) : (
                  <Button
                    className="w-full"
                    variant={plan.highlighted ? "default" : "outline"}
                    onClick={() => handleSelectPlan(plan.slug, plan.priceUsdCents === 0)}
                  >
                    {plan.priceUsdCents === 0 ? t("planes_switch_to_plan") : t("planes_upgrade_to_plan")}
                  </Button>
                )
              ) : (
                <Link href={`/signup?plan=${plan.slug}`}>
                  <Button className="w-full" variant={plan.highlighted ? "default" : "outline"}>
                    {t("planes_login_or_signup")}
                  </Button>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
