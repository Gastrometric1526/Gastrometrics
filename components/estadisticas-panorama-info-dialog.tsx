"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Info } from "lucide-react"
import { useLanguage } from "@/contexts/language-context"

interface EstadisticasPanoramaInfoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

// Explica los cálculos reales de la pestaña Panorama de Estadísticas (app/estadisticas/
// page.tsx, líneas ~238-357) — mismas fórmulas que ya corren ahí, no cifras inventadas.
export function EstadisticasPanoramaInfoDialog({ open, onOpenChange }: EstadisticasPanoramaInfoDialogProps) {
  const { t } = useLanguage()

  const sections = [
    { titleKey: "estadisticas_panorama_info_avgcost_title", bodyKey: "estadisticas_panorama_info_avgcost_body" },
    { titleKey: "estadisticas_panorama_info_avgmargin_title", bodyKey: "estadisticas_panorama_info_avgmargin_body" },
    { titleKey: "estadisticas_panorama_info_topmargin_title", bodyKey: "estadisticas_panorama_info_topmargin_body" },
    { titleKey: "estadisticas_panorama_info_mostused_title", bodyKey: "estadisticas_panorama_info_mostused_body" },
    {
      titleKey: "estadisticas_panorama_info_inventoryvalue_title",
      bodyKey: "estadisticas_panorama_info_inventoryvalue_body",
    },
    {
      titleKey: "estadisticas_panorama_info_pricehistory_title",
      bodyKey: "estadisticas_panorama_info_pricehistory_body",
    },
  ] as const

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Info className="h-5 w-5 text-primary" />
            {t("estadisticas_panorama_info_title")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          {sections.map((section) => (
            <div key={section.titleKey} className="p-3 bg-muted/40 rounded-lg border border-border">
              <h3 className="font-semibold text-foreground mb-1">{t(section.titleKey)}</h3>
              <p className="text-muted-foreground">{t(section.bodyKey)}</p>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
