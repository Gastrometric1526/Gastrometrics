"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { AlertTriangle, Info, Percent, Scale } from "lucide-react"
import { MERMA_CATEGORIES, getMermaLevel } from "@/lib/merma-categories"
import { getCategoryLabel, getMermaLevelLabel } from "@/lib/ingredient-labels"
import { useLanguage } from "@/contexts/language-context"

interface MermaInfoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MermaInfoDialog({ open, onOpenChange }: MermaInfoDialogProps) {
  const { t, language } = useLanguage()

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
            {t("merma_info_title")}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1">
          <div className="space-y-6 p-1">
            {/* Explicación General */}
            <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
              <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                <Info className="h-4 w-4 text-primary" />
                {t("merma_info_what_is_title")}
              </h3>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>{t("merma_info_what_is_body")}</p>
                <ul className="list-disc list-inside ml-4 space-y-1">
                  <li>{t("merma_info_what_is_item1")}</li>
                  <li>{t("merma_info_what_is_item2")}</li>
                  <li>{t("merma_info_what_is_item3")}</li>
                  <li>{t("merma_info_what_is_item4")}</li>
                </ul>
              </div>
            </div>

            {/* Tipos de Merma */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-success-soft rounded-lg border">
                <h4 className="font-semibold text-success mb-2 flex items-center gap-2">
                  <Percent className="h-4 w-4" />
                  {t("merma_info_global_title")}
                </h4>
                <div className="text-sm text-success space-y-2">
                  <p>{t("merma_info_global_body")}</p>
                  <p>
                    <strong>{t("merma_info_advantages_label")}</strong>
                  </p>
                  <ul className="list-disc list-inside ml-2">
                    <li>{t("merma_info_global_advantage1")}</li>
                    <li>{t("merma_info_global_advantage2")}</li>
                    <li>{t("merma_info_global_advantage3")}</li>
                  </ul>
                </div>
              </div>

              <div className="p-4 bg-orange-50 dark:bg-orange-950/40 rounded-lg border border-orange-200 dark:border-orange-900">
                <h4 className="font-semibold text-orange-900 dark:text-orange-300 mb-2 flex items-center gap-2">
                  <Scale className="h-4 w-4" />
                  {t("merma_info_custom_title")}
                </h4>
                <div className="text-sm text-orange-800 dark:text-orange-300 space-y-2">
                  <p>{t("merma_info_custom_body")}</p>
                  <p>
                    <strong>{t("merma_info_options_label")}</strong>
                  </p>
                  <ul className="list-disc list-inside ml-2">
                    <li>
                      <strong>{t("merma_info_custom_percentage_label")}</strong> {t("merma_info_custom_percentage_desc")}
                    </li>
                    <li>
                      <strong>{t("merma_info_custom_quantity_label")}</strong> {t("merma_info_custom_quantity_desc")}
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
                {t("merma_info_top10_title")}
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
                        <span className="text-sm font-medium text-warning">{getCategoryLabel(category, language)}</span>
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
                        <span className="text-xs text-amber-600 dark:text-amber-300">
                          {getMermaLevelLabel(level, language)}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <Separator />

            {/* Todas las Categorías */}
            <div>
              <h3 className="font-semibold text-foreground mb-3">{t("merma_info_all_categories_title")}</h3>
              <div className="overflow-x-auto">
                <table className="w-full border border-border rounded-lg">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-4 py-2 text-left text-sm font-semibold text-foreground border-b border-border">
                        {t("merma_info_table_category")}
                      </th>
                      <th className="px-4 py-2 text-center text-sm font-semibold text-foreground border-b border-border">
                        {t("merma_info_table_percentage")}
                      </th>
                      <th className="px-4 py-2 text-center text-sm font-semibold text-foreground border-b border-border">
                        {t("merma_info_table_level")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {getAllCategories().map(({ category, percentage }, index) => {
                      const level = getMermaLevel(percentage)
                      return (
                        <tr key={category} className={index % 2 === 0 ? "bg-card" : "bg-muted/30"}>
                          <td className="px-4 py-2 text-sm text-foreground border-b border-border">
                            {getCategoryLabel(category, language)}
                          </td>
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
                            {getMermaLevelLabel(level, language)}
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
              <h3 className="font-semibold text-foreground mb-3">{t("merma_info_levels_title")}</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="text-center p-2 bg-success-soft rounded border">
                  <div className="font-semibold text-success">{getMermaLevelLabel("Baja", language)}</div>
                  <div className="text-xs text-green-600 dark:text-green-300">0% - 10%</div>
                </div>
                <div className="text-center p-2 bg-yellow-100 dark:bg-yellow-950/40 rounded border border-yellow-300 dark:border-yellow-900">
                  <div className="font-semibold text-yellow-700 dark:text-yellow-300">
                    {getMermaLevelLabel("Media", language)}
                  </div>
                  <div className="text-xs text-yellow-600 dark:text-yellow-300">11% - 25%</div>
                </div>
                <div className="text-center p-2 bg-orange-100 dark:bg-orange-950/40 rounded border border-orange-300 dark:border-orange-900">
                  <div className="font-semibold text-orange-700 dark:text-orange-300">
                    {getMermaLevelLabel("Alta", language)}
                  </div>
                  <div className="text-xs text-orange-600 dark:text-orange-300">26% - 40%</div>
                </div>
                <div className="text-center p-2 bg-danger-soft rounded border">
                  <div className="font-semibold text-destructive">{getMermaLevelLabel("Muy Alta", language)}</div>
                  <div className="text-xs text-destructive dark:text-red-300">41%+</div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Importante: Fuentes y Limitaciones */}
            <div className="p-4 bg-yellow-50 dark:bg-yellow-950/40 rounded-lg border border-yellow-200 dark:border-yellow-900">
              <h3 className="font-semibold text-yellow-900 dark:text-yellow-300 mb-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                {t("merma_info_sources_title")}
              </h3>
              <div className="space-y-2 text-sm text-yellow-800 dark:text-yellow-300">
                <p>
                  <strong>{t("merma_info_sources_label")}</strong> {t("merma_info_sources_intro")}
                </p>
                <ul className="list-disc list-inside ml-4 space-y-1">
                  <li>
                    <strong>{t("merma_info_source1_name")}</strong> - {t("merma_info_source1_desc")}
                  </li>
                  <li>{t("merma_info_source2")}</li>
                  <li>{t("merma_info_source3")}</li>
                  <li>{t("merma_info_source4")}</li>
                </ul>
                <div className="mt-3 p-3 bg-yellow-100 dark:bg-yellow-900/40 rounded border border-yellow-300 dark:border-yellow-800">
                  <p className="font-medium text-yellow-900 dark:text-yellow-300">
                    ⚠️ {t("merma_info_considerations_title")}
                  </p>
                  <ul className="list-disc list-inside ml-2 mt-1 space-y-1 text-xs">
                    <li>{t("merma_info_consideration1")}</li>
                    <li>{t("merma_info_consideration2")}</li>
                    <li>{t("merma_info_consideration3")}</li>
                    <li>{t("merma_info_consideration4")}</li>
                    <li>{t("merma_info_consideration5")}</li>
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
