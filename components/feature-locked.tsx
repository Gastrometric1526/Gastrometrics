"use client"

import Link from "next/link"
import { Lock, ArrowRight } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Sidebar } from "@/components/sidebar"
import { getMinimumPlanForFeature } from "@/lib/plan-access"
import type { FeatureKey } from "@/lib/plans"
import { useLanguage } from "@/contexts/language-context"

// Pantalla de bloqueo por plan — reemplaza el contenido completo de una pagina
// cuando el plan actual no incluye la funcion. No oculta la existencia de la
// funcion (mala UX/confuso), la muestra con un CTA claro a /planes.
export function FeatureLockedPage({ feature, title, description }: { feature: FeatureKey; title: string; description: string }) {
  const minPlan = getMinimumPlanForFeature(feature)
  const { t } = useLanguage()
  const [availableFromBefore, availableFromAfterRaw] = t("featurelocked_available_from_plan").split("{name}")
  const availableFromAfter = availableFromAfterRaw?.replace("{price}", minPlan?.price ?? "")

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex items-center justify-center p-6">
        <Card className="max-w-md w-full border-border bg-card">
          <CardContent className="pt-8 pb-8 flex flex-col items-center text-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Lock className="h-7 w-7 text-primary" />
            </div>
            <h2 className="text-xl font-bold text-foreground">{title}</h2>
            <p className="text-muted-foreground text-sm">{description}</p>
            {minPlan && (
              <p className="text-sm text-foreground">
                {availableFromBefore}
                <span className="font-semibold">{minPlan.name}</span>
                {availableFromAfter}
              </p>
            )}
            <Link href="/mi-plan">
              <Button className="gap-2">
                {t("landing_hero_cta_secondary")}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// Version compacta (inline, no pantalla completa) para bloquear una seccion o
// boton dentro de una pagina que por lo demas si es accesible en el plan actual.
export function FeatureLockedInline({ feature, title, description }: { feature: FeatureKey; title: string; description: string }) {
  const minPlan = getMinimumPlanForFeature(feature)
  const { t } = useLanguage()
  const [availableFromBefore, availableFromAfterRaw] = t("featurelocked_available_from").split("{name}")
  const availableFromAfter = availableFromAfterRaw?.replace("{price}", minPlan?.price ?? "")

  return (
    <Card className="border-2 border-dashed border-border bg-muted/20">
      <CardContent className="py-6 flex flex-col items-center text-center gap-3">
        <Lock className="h-5 w-5 text-muted-foreground" />
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground max-w-sm">{description}</p>
        {minPlan && (
          <p className="text-xs text-muted-foreground">
            {availableFromBefore}
            <span className="font-medium text-foreground">{minPlan.name}</span>
            {availableFromAfter}
          </p>
        )}
        <Link href="/mi-plan">
          <Button size="sm" variant="outline" className="gap-1.5">
            {t("landing_hero_cta_secondary")}
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  )
}
