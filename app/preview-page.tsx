"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ThemeSwitcher } from "@/components/theme-switcher"

export default function ThemeSwitcherPreview() {
  const [businessId, setBusinessId] = useState<string | undefined>(undefined)

  return (
    <div className="min-h-screen bg-background p-8">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Selector de Temas Gastrometrics</span>
            <ThemeSwitcher businessId={businessId} />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-8">
            <div>
              <h2 className="text-xl font-bold mb-4">Previsualización del Tema</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-primary text-primary-foreground p-4 rounded">Color Primario</div>
                <div className="bg-secondary text-secondary-foreground p-4 rounded">Color Secundario</div>
                <div className="bg-accent text-accent-foreground p-4 rounded">Color Acento</div>
                <div className="bg-muted text-muted-foreground p-4 rounded">Color Muted</div>
              </div>
            </div>

            <div>
              <h2 className="text-xl font-bold mb-4">Simular Dashboard de Negocio</h2>
              <div className="flex gap-4">
                <button
                  onClick={() => setBusinessId(undefined)}
                  className={`px-4 py-2 rounded ${!businessId ? "bg-primary text-primary-foreground" : "bg-muted"}`}
                >
                  Dashboard Principal
                </button>
                <button
                  onClick={() => setBusinessId("business1")}
                  className={`px-4 py-2 rounded ${businessId === "business1" ? "bg-primary text-primary-foreground" : "bg-muted"}`}
                >
                  Negocio 1
                </button>
                <button
                  onClick={() => setBusinessId("business2")}
                  className={`px-4 py-2 rounded ${businessId === "business2" ? "bg-primary text-primary-foreground" : "bg-muted"}`}
                >
                  Negocio 2
                </button>
              </div>
              <p className="mt-4 text-muted-foreground">
                {businessId
                  ? `Mostrando el tema para el negocio: ${businessId}`
                  : "Mostrando el tema para el dashboard principal"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
