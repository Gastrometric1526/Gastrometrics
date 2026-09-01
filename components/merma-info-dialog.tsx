"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { AlertTriangle, Info, Percent, Scale } from "lucide-react"
import { MERMA_CATEGORIES, getMermaLevel } from "@/lib/merma-categories"

interface MermaInfoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MermaInfoDialog({ open, onOpenChange }: MermaInfoDialogProps) {
  const getTopMermaCategories = () => {
    return Object.entries(MERMA_CATEGORIES)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([category, percentage]) => ({ category, percentage }))
  }

  const getAllCategories = () => {
    return Object.entries(MERMA_CATEGORIES)
      .sort(([, a], [, b]) => b - a)
      .map(([category, percentage]) => ({ category, percentage }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Info className="h-5 w-5 text-primary" />
            Información del Sistema de Mermas
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1">
          <div className="space-y-6 p-1">
            {/* Explicación General */}
            <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
              <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                <Info className="h-4 w-4 text-primary" />
                ¿Qué es el Sistema de Mermas?
              </h3>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  El sistema de mermas es una herramienta que ajusta automáticamente el contenido neto de los
                  ingredientes para compensar las pérdidas naturales que ocurren durante:
                </p>
                <ul className="list-disc list-inside ml-4 space-y-1">
                  <li>Preparación y limpieza de ingredientes</li>
                  <li>Procesos de cocción (evaporación, reducción)</li>
                  <li>Almacenamiento y manipulación</li>
                  <li>Desperdicios inevitables en la cocina</li>
                </ul>
              </div>
            </div>

            {/* Tipos de Merma */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-success-soft rounded-lg border">
                <h4 className="font-semibold text-success mb-2 flex items-center gap-2">
                  <Percent className="h-4 w-4" />
                  Merma Global
                </h4>
                <div className="text-sm text-success space-y-2">
                  <p>Utiliza porcentajes predefinidos basados en la categoría del ingrediente.</p>
                  <p>
                    <strong>Ventajas:</strong>
                  </p>
                  <ul className="list-disc list-inside ml-2">
                    <li>Configuración automática</li>
                    <li>Basada en estándares de la industria</li>
                    <li>Consistente entre ingredientes similares</li>
                  </ul>
                </div>
              </div>

              <div className="p-4 bg-orange-50 dark:bg-orange-950/40 rounded-lg border border-orange-200 dark:border-orange-900">
                <h4 className="font-semibold text-orange-900 dark:text-orange-300 mb-2 flex items-center gap-2">
                  <Scale className="h-4 w-4" />
                  Merma Personalizada
                </h4>
                <div className="text-sm text-orange-800 dark:text-orange-300 space-y-2">
                  <p>Permite configurar valores específicos para cada ingrediente.</p>
                  <p>
                    <strong>Opciones:</strong>
                  </p>
                  <ul className="list-disc list-inside ml-2">
                    <li>
                      <strong>Porcentaje (%):</strong> Reduce por porcentaje del total
                    </li>
                    <li>
                      <strong>Cantidad:</strong> Reduce una cantidad fija en la unidad del ingrediente
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <Separator />

            {/* Top 10 Categorías */}
            <div className="p-4 bg-warning-soft dark:bg-amber-950/40 rounded-lg border border-amber-200 dark:border-amber-900">
              <h3 className="font-semibold text-warning mb-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Top 10 Categorías con Mayor Merma
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {getTopMermaCategories().map(({ category, percentage }, index) => {
                  const level = getMermaLevel(percentage)
                  return (
                    <div
                      key={category}
                      className="flex items-center justify-between p-2 bg-card rounded border border-border"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-warning bg-amber-200 dark:bg-amber-900 rounded-full w-6 h-6 flex items-center justify-center">
                          {index + 1}
                        </span>
                        <span className="text-sm font-medium text-warning">{category}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={`text-xs ${
                            percentage <= 10
                              ? "bg-success-soft text-success"
                              : percentage <= 25
                                ? "bg-yellow-100 dark:bg-yellow-950/40 text-yellow-700 dark:text-yellow-300 border-yellow-300 dark:border-yellow-900"
                                : percentage <= 40
                                  ? "bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-900"
                                  : "bg-danger-soft text-destructive"
                          }`}
                        >
                          {percentage}%
                        </Badge>
                        <span className="text-xs text-amber-600 dark:text-amber-300">{level}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <Separator />

            {/* Todas las Categorías */}
            <div>
              <h3 className="font-semibold text-foreground mb-3">Tabla Completa de Mermas por Categoría</h3>
              <div className="overflow-x-auto">
                <table className="w-full border border-border rounded-lg">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-4 py-2 text-left text-sm font-semibold text-foreground border-b border-border">
                        Categoría
                      </th>
                      <th className="px-4 py-2 text-center text-sm font-semibold text-foreground border-b border-border">
                        Porcentaje
                      </th>
                      <th className="px-4 py-2 text-center text-sm font-semibold text-foreground border-b border-border">
                        Nivel
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {getAllCategories().map(({ category, percentage }, index) => {
                      const level = getMermaLevel(percentage)
                      return (
                        <tr key={category} className={index % 2 === 0 ? "bg-card" : "bg-muted/30"}>
                          <td className="px-4 py-2 text-sm text-foreground border-b border-border">{category}</td>
                          <td className="px-4 py-2 text-center border-b border-border">
                            <Badge
                              variant="outline"
                              className={`text-xs ${
                                percentage === 0
                                  ? "bg-muted text-muted-foreground border-border"
                                  : percentage <= 10
                                    ? "bg-success-soft text-success"
                                    : percentage <= 25
                                      ? "bg-yellow-100 dark:bg-yellow-950/40 text-yellow-700 dark:text-yellow-300 border-yellow-300 dark:border-yellow-900"
                                      : percentage <= 40
                                        ? "bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-900"
                                        : "bg-danger-soft text-destructive"
                              }`}
                            >
                              {percentage}%
                            </Badge>
                          </td>
                          <td className="px-4 py-2 text-center text-xs text-muted-foreground border-b border-border">
                            {level}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <Separator />

            {/* Niveles de Merma */}
            <div className="p-4 bg-muted rounded-lg border border-border">
              <h3 className="font-semibold text-foreground mb-3">Niveles de Merma</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="text-center p-2 bg-success-soft rounded border">
                  <div className="font-semibold text-success">Baja</div>
                  <div className="text-xs text-green-600 dark:text-green-300">0% - 10%</div>
                </div>
                <div className="text-center p-2 bg-yellow-100 dark:bg-yellow-950/40 rounded border border-yellow-300 dark:border-yellow-900">
                  <div className="font-semibold text-yellow-700 dark:text-yellow-300">Media</div>
                  <div className="text-xs text-yellow-600 dark:text-yellow-300">11% - 25%</div>
                </div>
                <div className="text-center p-2 bg-orange-100 dark:bg-orange-950/40 rounded border border-orange-300 dark:border-orange-900">
                  <div className="font-semibold text-orange-700 dark:text-orange-300">Alta</div>
                  <div className="text-xs text-orange-600 dark:text-orange-300">26% - 40%</div>
                </div>
                <div className="text-center p-2 bg-danger-soft rounded border">
                  <div className="font-semibold text-destructive">Muy Alta</div>
                  <div className="text-xs text-destructive dark:text-red-300">41%+</div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Importante: Fuentes y Limitaciones */}
            <div className="p-4 bg-yellow-50 dark:bg-yellow-950/40 rounded-lg border border-yellow-200 dark:border-yellow-900">
              <h3 className="font-semibold text-yellow-900 dark:text-yellow-300 mb-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Importante: Fuentes y Limitaciones
              </h3>
              <div className="space-y-2 text-sm text-yellow-800 dark:text-yellow-300">
                <p>
                  <strong>Fuentes de Datos:</strong> Los porcentajes de merma han sido extraídos y adaptados de fuentes
                  reconocidas en la industria gastronómica, incluyendo:
                </p>
                <ul className="list-disc list-inside ml-4 space-y-1">
                  <li>
                    <strong>The Book of Yields</strong> - Estándares de rendimiento en cocina profesional
                  </li>
                  <li>Estudios de la industria alimentaria y hotelera</li>
                  <li>Mejores prácticas de cocinas comerciales</li>
                  <li>Datos históricos de operaciones gastronómicas</li>
                </ul>
                <div className="mt-3 p-3 bg-yellow-100 dark:bg-yellow-900/40 rounded border border-yellow-300 dark:border-yellow-800">
                  <p className="font-medium text-yellow-900 dark:text-yellow-300">⚠️ Consideraciones Importantes:</p>
                  <ul className="list-disc list-inside ml-2 mt-1 space-y-1 text-xs">
                    <li>
                      Los porcentajes son <strong>estimaciones</strong> y pueden variar significativamente
                    </li>
                    <li>
                      Factores como ubicación geográfica, estación del año y proveedores locales afectan las mermas
                    </li>
                    <li>Las prácticas de preparación y habilidades del personal influyen en los desperdicios</li>
                    <li>Se recomienda ajustar los valores según la experiencia específica de cada establecimiento</li>
                    <li>Utilice la opción de"Merma Personalizada"para valores más precisos según su operación</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
