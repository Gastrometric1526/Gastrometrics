"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Info } from "lucide-react"
import { useLanguage } from "@/contexts/language-context"

interface InventarioInfoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

// Explica los cálculos reales de la pantalla de Inventario — mismos umbrales que usa
// app/inventario/page.tsx (currentStock <= minStock → Crítico, <= minStock*2 → Bajo,
// si no Normal) y la misma fórmula de valor total (currentStock × precio, sin costo
// promedio ponderado) — no son cifras inventadas, son las que ya calcula esa pantalla.
export function InventarioInfoDialog({ open, onOpenChange }: InventarioInfoDialogProps) {
  const { t } = useLanguage()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Info className="h-5 w-5 text-primary" />
            {t("inventario_info_title")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 text-sm">
          <div>
            <h3 className="font-semibold text-foreground mb-2">{t("inventario_info_status_title")}</h3>
            <p className="text-muted-foreground mb-3">{t("inventario_info_status_body")}</p>
            <div className="space-y-2">
              <div className="flex items-center gap-3 p-2 rounded-lg border border-border">
                <Badge variant="outline" className="bg-danger-soft text-destructive shrink-0">
                  {t("inventario_status_critical")}
                </Badge>
                <span className="text-muted-foreground">{t("inventario_info_status_critical_desc")}</span>
              </div>
              <div className="flex items-center gap-3 p-2 rounded-lg border border-border">
                <Badge variant="outline" className="bg-warning-soft text-warning shrink-0">
                  {t("inventario_status_low")}
                </Badge>
                <span className="text-muted-foreground">{t("inventario_info_status_low_desc")}</span>
              </div>
              <div className="flex items-center gap-3 p-2 rounded-lg border border-border">
                <Badge variant="outline" className="bg-success-soft text-success shrink-0">
                  {t("inventario_status_normal")}
                </Badge>
                <span className="text-muted-foreground">{t("inventario_info_status_normal_desc")}</span>
              </div>
            </div>
          </div>

          <div className="p-4 bg-muted rounded-lg border border-border">
            <h3 className="font-semibold text-foreground mb-2">{t("inventario_info_value_title")}</h3>
            <p className="text-muted-foreground">{t("inventario_info_value_body")}</p>
            <p className="font-mono text-xs mt-2 text-foreground">{t("inventario_info_value_formula")}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
