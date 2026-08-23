"use client"

import { Label } from "@/components/ui/label"

import { categories } from "@/types/inventory"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useLanguage } from "@/contexts/language-context"

interface InventoryFiltersProps {
  category: string
  setCategory: (category: string) => void
  status: string
  setStatus: (status: string) => void
}

export function InventoryFilters({ category, setCategory, status, setStatus }: InventoryFiltersProps) {
  const { t } = useLanguage()
  return (
    <div className="flex flex-wrap items-center justify-start gap-2 sm:gap-3">
      <div className="flex items-center space-x-2">
        <Label htmlFor="category">{t("inventario_table_category")}:</Label>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger id="category" className="w-full sm:w-auto sm:min-w-[160px] md:min-w-[180px]">
            <SelectValue placeholder={t("inventario_filter_all_feminine")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("inventario_filter_all_feminine")}</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center space-x-2">
        <Label htmlFor="status">{t("inventario_status_label")}:</Label>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger id="status" className="w-full sm:w-auto sm:min-w-[160px] md:min-w-[180px]">
            <SelectValue placeholder={t("inventario_filter_all")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("inventario_filter_all")}</SelectItem>
            <SelectItem value="normal">{t("inventario_status_normal")}</SelectItem>
            <SelectItem value="low">{t("inventario_status_low")}</SelectItem>
            <SelectItem value="critical">{t("inventario_status_critical")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
