"use client"

import { Card, CardContent } from "@/components/ui/card"
import { DollarSign, Package, AlertTriangle } from "lucide-react"
import { formatCurrency } from "@/lib/currency"
import { useLanguage } from "@/contexts/language-context"

interface InventoryReportsProps {
  totalItems: number
  criticalItems: number
  totalValue: number
}

export function InventoryReports({ totalItems, criticalItems, totalValue }: InventoryReportsProps) {
  const { t } = useLanguage()
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 sm:gap-4">
      <Card className="bg-white">
        <CardContent className="flex items-center p-4 md:p-6">
          <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-blue-50 flex items-center justify-center mr-3 sm:mr-4">
            <Package className="h-6 w-6 text-blue-600 dark:text-blue-300" />
          </div>
          <div>
            <p className="text-xs sm:text-sm font-medium text-muted-foreground">
              {t("inventario_stat_total_products")}
            </p>
            <h3 className="text-xl sm:text-2xl font-bold">{totalItems}</h3>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white">
        <CardContent className="flex items-center p-4 md:p-6">
          <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-danger-soft flex items-center justify-center mr-3 sm:mr-4">
            <AlertTriangle className="h-6 w-6 text-destructive dark:text-red-300" />
          </div>
          <div>
            <p className="text-xs sm:text-sm font-medium text-muted-foreground">
              {t("inventario_stat_critical_products")}
            </p>
            <h3 className="text-xl sm:text-2xl font-bold">{criticalItems}</h3>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white">
        <CardContent className="flex items-center p-4 md:p-6">
          <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-success-soft flex items-center justify-center mr-3 sm:mr-4">
            <DollarSign className="h-6 w-6 text-green-600 dark:text-green-300" />
          </div>
          <div>
            <p className="text-xs sm:text-sm font-medium text-muted-foreground">{t("inventario_stat_total_value")}</p>
            <h3 className="text-xl sm:text-2xl font-bold">{formatCurrency(totalValue)}</h3>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
