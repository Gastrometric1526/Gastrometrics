"use client"

import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sidebar } from "@/components/sidebar"
import { AuthGuard } from "@/components/auth-guard"
import { PlansGrid } from "@/components/plans-grid"
import { useLanguage } from "@/contexts/language-context"

// Página de plan dentro del dashboard — antes, "Plan: X" en el sidebar y el CTA de
// las pantallas bloqueadas por plan (components/feature-locked.tsx) mandaban a /planes,
// la página pública de marketing (sin Sidebar, con el nav de /about, /contacto...).
// Para un usuario que YA tiene cuenta y solo quiere cambiar de plan, eso significaba
// salir por completo del dashboard para volver a entrar después — la grilla de planes
// es la misma (components/plans-grid.tsx), pero esta vive dentro del shell de la app.
export default function MiPlanPage() {
  const { t } = useLanguage()
  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <div className="flex-1 p-4 md:p-8">
          <div className="max-w-7xl mx-auto space-y-8">
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

            <PlansGrid freeRedirectTo="/mi-plan" />
          </div>
        </div>
      </div>
    </AuthGuard>
  )
}
