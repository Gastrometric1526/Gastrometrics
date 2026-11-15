"use client"

/**
 * Valor del inventario en los tres métodos, lado a lado, y cuál usa el negocio (docs/313).
 * Solo para quien ve costos (la página lo envuelve en <CostOnly>); solo el dueño cambia el
 * método, que también valora los conteos y el costo real (COGS) de Reportes.
 */

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useLanguage } from "@/contexts/language-context"
import { useAuth } from "@/contexts/auth-context"
import { useToast } from "@/hooks/use-toast"
import { formatCurrency } from "@/lib/currency"
import { cn } from "@/lib/utils"
import { useActiveMembership } from "@/lib/plan-access"
import { VALUATION_METHODS, valueInventory, type ValuationMethod } from "@/lib/inventory-valuation"
import { useValuationMethod } from "@/lib/inventory-valuation-setting"
import type { Ingredient } from "@/types/ingredient"
import type { InventoryItem } from "@/types/inventory"
import type { PackageContentLookup } from "@/lib/inventory-value"

export function InventoryValuationCard({
  items,
  ingredients,
  packageLookup,
  businessId,
}: {
  items: InventoryItem[]
  ingredients: Ingredient[]
  packageLookup: PackageContentLookup
  businessId: string | null
}) {
  const { t } = useLanguage()
  const { toast } = useToast()
  const { user } = useAuth()
  const { active: isMember } = useActiveMembership()
  const [method, setMethod] = useValuationMethod(businessId, user?.user_metadata as Record<string, unknown> | undefined)
  const valuation = useMemo(() => valueInventory(items, ingredients, packageLookup), [items, ingredients, packageLookup])

  const choose = async (m: ValuationMethod) => {
    if (isMember || m === method) return
    const ok = await setMethod(m)
    if (!ok) toast({ title: t("valuation_save_error"), variant: "destructive" })
  }

  return (
    <Card className="border border-border bg-card" data-testid="inventory-valuation">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t("valuation_title")}</CardTitle>
        <p className="text-sm text-muted-foreground">{t("valuation_desc")}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {VALUATION_METHODS.map((m) => {
            const selected = m === method
            return (
              <button
                key={m}
                type="button"
                onClick={() => choose(m)}
                disabled={isMember}
                aria-pressed={selected}
                data-testid={`valuation-${m}`}
                className={cn(
                  "rounded-lg border p-3 text-left transition-colors",
                  selected ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50",
                  isMember && "cursor-default",
                )}
              >
                <p className="text-sm font-medium text-foreground">{t(`valuation_method_${m}`)}</p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">{formatCurrency(valuation.totals[m])}</p>
                <p className="mt-1 text-xs text-muted-foreground">{t(`valuation_method_${m}_desc`)}</p>
                {valuation.fallbacks[m] > 0 && (
                  <p className="mt-1 text-xs text-warning">{t("valuation_fallback").replace("{count}", String(valuation.fallbacks[m]))}</p>
                )}
                {selected && <p className="mt-2 text-xs font-medium text-primary">{t("valuation_in_use")}</p>}
              </button>
            )
          })}
        </div>
        <p className="text-xs text-muted-foreground">{isMember ? t("valuation_owner_only") : t("valuation_cogs_note")}</p>
      </CardContent>
    </Card>
  )
}
