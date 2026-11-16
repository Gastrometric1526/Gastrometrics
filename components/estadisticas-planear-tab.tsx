"use client"

/**
 * Reportes → Planear (docs/322): pronóstico de ventas de los próximos 7 días y presupuesto del
 * mes. Todo número tiene su «¿Cómo se calcula?» con las cifras reales. Las cuentas viven en
 * lib/forecast.ts (y lib/labor.ts para el personal); aquí solo se muestran.
 */

import { useMemo, useState } from "react"
import Link from "next/link"
import { CalendarDays, PiggyBank, ShoppingCart } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { NumericInput } from "@/components/ui/numeric-input"
import { Progress } from "@/components/ui/progress"
import { CalcHelp } from "@/components/calc-help"
import { CostOnly } from "@/components/cost-gate"
import { useLanguage } from "@/contexts/language-context"
import { useAuth } from "@/contexts/auth-context"
import { useToast } from "@/hooks/use-toast"
import { useActiveMembership, useFeatureAccess } from "@/lib/plan-access"
import { formatCurrency } from "@/lib/currency"
import { formatMonthYear, formatWeekdayDate, toIsoDate } from "@/lib/date-format"
import { getDateLocale } from "@/lib/i18n/translations"
import { cn } from "@/lib/utils"
import { getSalesImports } from "@/lib/storage/sales-imports"
import { getBusinessById } from "@/lib/storage/businesses"
import { budgetFoodCost, budgetLine, dayOf, forecastSales, monthDays, type BudgetLine, type MonthlyBudget } from "@/lib/forecast"
import { laborInRange } from "@/lib/labor"
import { useBudget } from "@/lib/budget-setting"
import { useStaffSchedule } from "@/lib/staff-schedule-store"

const noon = (day: string) => `${day}T12:00:00`

export function EstadisticasPlanearTab({ businessId }: { businessId: string }) {
  const { t, language } = useLanguage()
  const { user } = useAuth()
  const { toast } = useToast()
  const { active: isMember } = useActiveMembership()
  const canAutoOrder = useFeatureAccess("purchase_orders_auto")
  const [budget, saveBudget] = useBudget(businessId, user?.user_metadata as Record<string, unknown> | undefined)
  const [editing, setEditing] = useState(false)
  // Turnos del horario del personal (docs/323), los mismos de Reportes → Personal y del POS.
  const { schedule: staffSchedule } = useStaffSchedule(businessId)

  const today = toIsoDate(new Date())
  const imports = getSalesImports(businessId)
  const business = businessId !== "main" ? getBusinessById(businessId) : null
  const locale = getDateLocale(language)
  const forecast = useMemo(() => forecastSales(imports, today, { horizon: 7, weeks: 4 }), [imports, today])
  const weekTotal = Math.round(forecast.reduce((s, d) => s + d.revenue, 0) * 100) / 100
  const hasForecast = forecast.some((d) => d.basis.length > 0)
  const bizParam = businessId !== "main" ? `&business=${businessId}` : ""

  // Lo que va del mes
  const { start, daysInMonth, elapsed } = monthDays(today)
  const month = useMemo(() => {
    let sales = 0
    let foodCost = 0
    for (const imp of imports) {
      for (const line of imp.lines ?? []) {
        if (!(line.quantity > 0)) continue
        const d = dayOf(line.date || imp.periodEnd || imp.importedAt)
        if (d < start || d > today) continue
        sales += line.revenue || 0
        foodCost += line.theoreticalCost || 0
      }
    }
    return { sales: Math.round(sales * 100) / 100, foodCost: Math.round(foodCost * 100) / 100 }
  }, [imports, start, today])
  const shiftsMonth = staffSchedule.shifts.length ? laborInRange(staffSchedule.shifts, start, today) : null
  const laborActual = shiftsMonth && shiftsMonth.shifts > 0 ? shiftsMonth.cost : Math.round(((business?.expenses?.laborCosts || 0) * elapsed) / daysInMonth * 100) / 100
  const laborFromShifts = !!shiftsMonth && shiftsMonth.shifts > 0

  const lines = budget
    ? {
        sales: budgetLine(budget.sales, month.sales, elapsed, daysInMonth),
        food: budgetLine(budgetFoodCost(budget), month.foodCost, elapsed, daysInMonth),
        labor: budgetLine(budget.labor, laborActual, elapsed, daysInMonth),
      }
    : null
  const expectedProfit = budget && lines ? Math.round((lines.sales.projected - lines.food.projected - lines.labor.projected - budget.otherExpenses) * 100) / 100 : 0

  return (
    <div className="space-y-6" data-testid="planear-tab" data-tour="stats-plan">
      <div>
        <h2 className="text-lg font-bold">{t("plan_title")}</h2>
        <p className="text-sm text-muted-foreground">{t("plan_subtitle")}</p>
      </div>

      {/* Pronóstico */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarDays className="h-5 w-5 text-primary" />
                {t("forecast_title")}
              </CardTitle>
              <p className="text-sm text-muted-foreground">{t("forecast_desc")}</p>
            </div>
            <CalcHelp
              title={t("forecast_calc_title")}
              intro={t("forecast_calc_intro")}
              steps={forecast
                .filter((d) => d.basis.length > 0)
                .slice(0, 2)
                .map((d) => ({
                  label: formatWeekdayDate(noon(d.day), locale),
                  formula: `(${d.basis.map((b) => formatCurrency(b.revenue)).join(" + ")}) ÷ ${d.basis.length} = ${formatCurrency(d.revenue)}`,
                  note: t("forecast_calc_basis").replace("{days}", d.basis.map((b) => formatWeekdayDate(noon(b.day), locale, { short: true })).join(", ")),
                }))
                .concat([{ label: t("forecast_week_total"), formula: `${forecast.map((d) => formatCurrency(d.revenue)).join(" + ")} = ${formatCurrency(weekTotal)}`, note: t("forecast_calc_closed_note") }])}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {!hasForecast ? (
            <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">{t("forecast_empty")}</p>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {forecast.map((d) => (
                  <div key={d.day} className={cn("rounded-lg border p-3", d.day === today ? "border-primary bg-primary/5" : "border-border")} data-testid="forecast-day">
                    <p className="text-sm font-medium capitalize">{formatWeekdayDate(noon(d.day), locale)}</p>
                    <p className="mt-1 text-xl font-semibold tabular-nums">{d.basis.length ? formatCurrency(d.revenue) : "—"}</p>
                    <p className="text-xs text-muted-foreground">
                      {d.basis.length ? t("forecast_based_on").replace("{count}", String(d.basis.length)) : t("forecast_no_history")}
                    </p>
                    {d.items.length > 0 && (
                      <p className="mt-1 truncate text-xs text-muted-foreground" title={d.items.map((i) => `${i.quantity} ${i.name}`).join(", ")}>
                        {d.items
                          .slice(0, 3)
                          .map((i) => `${Math.round(i.quantity)} ${i.name}`)
                          .join(" · ")}
                      </p>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{t("forecast_week_total")}</p>
                  <p className="text-lg font-semibold tabular-nums">{formatCurrency(weekTotal)}</p>
                </div>
                {canAutoOrder && (
                  <Link href={`/ordenes-compra?forecast=7${bizParam}`}>
                    <Button className="w-full gap-2 sm:w-auto" data-testid="forecast-order">
                      <ShoppingCart className="h-4 w-4" />
                      {t("forecast_order_button")}
                    </Button>
                  </Link>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Presupuesto del mes */}
      <CostOnly>
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <PiggyBank className="h-5 w-5 text-primary" />
                  {t("budget_title").replace("{month}", formatMonthYear(noon(today)))}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {t("budget_desc").replace("{elapsed}", String(elapsed)).replace("{days}", String(daysInMonth))}
                </p>
              </div>
              {!isMember && (
                <Button variant={budget ? "outline" : "default"} onClick={() => setEditing(true)} data-testid="budget-edit">
                  {budget ? t("budget_edit") : t("budget_set")}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {!budget || !lines ? (
              <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">{isMember ? t("budget_empty_member") : t("budget_empty")}</p>
            ) : (
              <>
                <BudgetRow label={t("budget_sales")} line={lines.sales} higherIsGood elapsed={elapsed} days={daysInMonth} />
                <BudgetRow
                  label={t("budget_food").replace("{pct}", String(budget.foodCostPercent))}
                  line={lines.food}
                  elapsed={elapsed}
                  days={daysInMonth}
                 
                  budgetFormula={`${formatCurrency(budget.sales)} × ${budget.foodCostPercent} % = ${formatCurrency(lines.food.budget)}`}
                  note={t("budget_food_note")}
                />
                <BudgetRow label={t("budget_labor")} line={lines.labor} elapsed={elapsed} days={daysInMonth} note={laborFromShifts ? t("budget_labor_from_shifts") : t("budget_labor_estimated")} />
                <div className="flex items-start justify-between gap-2 rounded-lg border border-border bg-muted/30 p-3">
                  <div>
                    <p className="text-xs text-muted-foreground">{t("budget_expected_profit")}</p>
                    <p className={cn("text-lg font-semibold tabular-nums", expectedProfit < 0 ? "text-destructive" : "text-foreground")}>{formatCurrency(expectedProfit)}</p>
                  </div>
                  <CalcHelp
                    title={t("budget_expected_profit")}
                    intro={t("budget_profit_intro")}
                    steps={[
                      {
                        label: t("budget_expected_profit"),
                        formula: `${formatCurrency(lines.sales.projected)} − ${formatCurrency(lines.food.projected)} − ${formatCurrency(lines.labor.projected)} − ${formatCurrency(budget.otherExpenses)} = ${formatCurrency(expectedProfit)}`,
                        note: t("budget_profit_note"),
                      },
                    ]}
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </CostOnly>

      <BudgetDialog
        open={editing}
        onOpenChange={setEditing}
        initial={
          budget ?? {
            sales: Math.round(month.sales && elapsed ? (month.sales / elapsed) * daysInMonth : 0),
            foodCostPercent: business?.targetFoodCostPercent || 30,
            labor: business?.expenses?.laborCosts || 0,
            otherExpenses:
              (business?.expenses?.rent || 0) + (business?.expenses?.utilities || 0) + (business?.expenses?.operationalCosts || 0) + (business?.expenses?.marketing || 0) + (business?.expenses?.otherExpenses || 0),
          }
        }
        onSave={async (b) => {
          const ok = await saveBudget(b)
          toast(ok ? { title: t("budget_saved") } : { title: t("budget_save_error"), variant: "destructive" })
          if (ok) setEditing(false)
        }}
      />
    </div>
  )
}

function BudgetRow({
  label,
  line,
  higherIsGood,
  elapsed,
  days,
  budgetFormula,
  note,
}: {
  label: string
  line: BudgetLine
  higherIsGood?: boolean
  elapsed: number
  days: number
  budgetFormula?: string
  note?: string
}) {
  const { t } = useLanguage()
  const good = higherIsGood ? line.projectedDiff >= 0 : line.projectedDiff <= 0
  return (
    <div className="space-y-1.5" data-testid="budget-row">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">
            {t("budget_so_far").replace("{actual}", formatCurrency(line.actual)).replace("{budget}", formatCurrency(line.budget))}
          </p>
        </div>
        <CalcHelp
          title={label}
          steps={[
            ...(budgetFormula ? [{ label: t("budget_month_budget"), formula: budgetFormula }] : []),
            { label: t("budget_projection"), formula: `${formatCurrency(line.actual)} ÷ ${elapsed} × ${days} = ${formatCurrency(line.projected)}`, note },
            { label: t("budget_vs"), formula: `${formatCurrency(line.projected)} − ${formatCurrency(line.budget)} = ${formatCurrency(line.projectedDiff)}` },
          ]}
        />
      </div>
      <Progress value={Math.min(100, line.usedPercent)} className="h-2" />
      <p className={cn("text-xs", good ? "text-success" : "text-warning")}>
        {t("budget_projection_text")
          .replace("{projected}", formatCurrency(line.projected))
          .replace("{diff}", `${line.projectedDiff > 0 ? "+" : ""}${formatCurrency(line.projectedDiff)}`)}
      </p>
    </div>
  )
}

function BudgetDialog({
  open,
  onOpenChange,
  initial,
  onSave,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  initial: MonthlyBudget
  onSave: (b: MonthlyBudget) => void | Promise<void>
}) {
  const { t } = useLanguage()
  const [b, setB] = useState<MonthlyBudget>(initial)
  const [saving, setSaving] = useState(false)
  const set = (k: keyof MonthlyBudget, v: number) => setB((p) => ({ ...p, [k]: Math.max(0, Number(v) || 0) }))
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) setB(initial)
        onOpenChange(o)
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("budget_dialog_title")}</DialogTitle>
          <DialogDescription>{t("budget_dialog_desc")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {(
            [
              ["sales", t("budget_field_sales")],
              ["foodCostPercent", t("budget_field_food")],
              ["labor", t("budget_field_labor")],
              ["otherExpenses", t("budget_field_other")],
            ] as const
          ).map(([k, label]) => (
            <div key={k}>
              <Label className="text-xs">{label}</Label>
              <NumericInput value={b[k]} onChange={(v) => set(k, v)} decimalPlaces={k === "foodCostPercent" ? 1 : 2} min={0} max={k === "foodCostPercent" ? 100 : undefined} />
            </div>
          ))}
        </div>
        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common_cancel")}
          </Button>
          <Button
            disabled={saving}
            onClick={async () => {
              setSaving(true)
              try {
                await onSave(b)
              } finally {
                setSaving(false)
              }
            }}
          >
            {t("budget_save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
