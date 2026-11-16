"use client"

/**
 * Reportes → Personal (docs/322, docs/323), solo dentro de un negocio: el horario del personal
 * con el costo de cada día y de la semana y su % sobre la venta (o la venta esperada). Es el
 * mismo horario que la pestaña Horario del POS (components/staff-schedule-board.tsx).
 * Lo cambian el dueño y quien tenga la parte «Horario del personal» en Equipo.
 */

import { useMemo } from "react"
import { StaffScheduleBoard } from "@/components/staff-schedule-board"
import { useCanSeeCosts } from "@/components/cost-gate"
import { useLanguage } from "@/contexts/language-context"
import { useActiveMembership, usePart, usePdfAccess } from "@/lib/plan-access"
import { toIsoDate } from "@/lib/date-format"
import { getSalesImports } from "@/lib/storage/sales-imports"
import { forecastSales, salesByDay } from "@/lib/forecast"

export function EstadisticasPersonalTab({ businessId }: { businessId: string }) {
  const { t } = useLanguage()
  const { active: isMember } = useActiveMembership()
  const canSchedule = usePart("pos.schedule") === true
  const canPdf = usePdfAccess("schedule", "export") === true
  const showCosts = useCanSeeCosts()
  const today = toIsoDate(new Date())
  const imports = getSalesImports(businessId)
  const byDay = useMemo(() => salesByDay(imports), [imports])
  const forecastByDay = useMemo(() => new Map(forecastSales(imports, today, { horizon: 14 }).map((d) => [d.day, d.revenue])), [imports, today])
  const daySales = (d: string) => {
    const real = Math.round((byDay.get(d)?.revenue || 0) * 100) / 100
    return d < today ? real : forecastByDay.get(d) || real
  }

  return (
    <div className="space-y-6" data-testid="personal-tab" data-tour="stats-personal">
      <div>
        <h2 className="text-lg font-bold">{t("labor_title")}</h2>
        <p className="text-sm text-muted-foreground">{t("labor_subtitle")}</p>
      </div>
      <StaffScheduleBoard businessId={businessId} canEdit={!isMember || canSchedule} showCosts={showCosts} canPdf={canPdf} daySales={daySales} />
      <p className="text-xs text-muted-foreground">{t("labor_finance_note")}</p>
    </div>
  )
}
