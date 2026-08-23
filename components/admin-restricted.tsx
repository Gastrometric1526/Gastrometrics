"use client"

import { ShieldAlert } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Sidebar } from "@/components/sidebar"
import { useTeamPreview } from "@/lib/plan-access"

// Pantalla de bloqueo cuando el dueño de la cuenta desactivó una sección para esta
// persona invitada (ver /equipo) — distinta de FeatureLockedPage (components/
// feature-locked.tsx), que bloquea por PLAN, no por decisión del administrador. Mismo
// patrón visual, mensaje distinto: acá no hay ningún CTA de "actualizar plan" porque
// no es un límite de plan, es una restricción explícita que solo el administrador de
// la cuenta puede levantar (editando el acceso de esta persona en /equipo).
export function AdminRestrictedPage({ sectionName }: { sectionName?: string }) {
  const { member } = useTeamPreview()

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex items-center justify-center p-6">
        <Card className="max-w-md w-full border-2 border-border shadow-lg bg-card">
          <CardContent className="pt-8 pb-8 flex flex-col items-center text-center gap-4">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <ShieldAlert className="h-7 w-7 text-destructive" />
            </div>
            <h2 className="text-xl font-bold text-foreground">
              {sectionName ? `${sectionName} fue deshabilitado por el administrador` : "Esto fue deshabilitado por el administrador"}
            </h2>
            <p className="text-muted-foreground text-sm">
              El administrador de esta cuenta no te dio acceso a esta sección. Contacta al administrador de la
              cuenta para solicitar acceso.
            </p>
            {member?.email && (
              <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                Estás viendo la app como <span className="font-medium text-foreground">{member.name || member.email}</span>
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// Version compacta (inline), para cuando solo una parte de una pantalla que por lo
// demás sí es visible está restringida.
export function AdminRestrictedInline({ sectionName }: { sectionName?: string }) {
  return (
    <Card className="border-2 border-dashed border-destructive/30 bg-destructive/5">
      <CardContent className="py-6 flex flex-col items-center text-center gap-3">
        <ShieldAlert className="h-5 w-5 text-destructive" />
        <p className="text-sm font-semibold text-foreground">
          {sectionName ? `${sectionName} fue deshabilitado por el administrador` : "Esto fue deshabilitado por el administrador"}
        </p>
        <p className="text-xs text-muted-foreground max-w-sm">
          Contacta al administrador de la cuenta para solicitar acceso.
        </p>
      </CardContent>
    </Card>
  )
}
