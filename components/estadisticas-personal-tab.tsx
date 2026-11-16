"use client"

/**
 * Reportes → Personal (docs/322), solo dentro de un negocio: las personas con su pago por hora
 * y los turnos de cada día. Muestra el costo de personal por día y por semana y su % sobre la
 * venta, con «¿Cómo se calcula?». Finanzas usa estos turnos en el Prime Cost y el P&L.
 * Solo el dueño anota; el equipo lo ve.
 */

import { useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, Plus, UserPlus, Users, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NumericInput } from "@/components/ui/numeric-input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CalcHelp } from "@/components/calc-help"
import { useLanguage } from "@/contexts/language-context"
import { useToast } from "@/hooks/use-toast"
import { useActiveMembership } from "@/lib/plan-access"
import { formatCurrency } from "@/lib/currency"
import { formatWeekdayDate, toIsoDate } from "@/lib/date-format"
import { getDateLocale } from "@/lib/i18n/translations"
import { cn } from "@/lib/utils"
import { getBusinessById, updateBusiness } from "@/lib/storage/businesses"
import { getSalesImports } from "@/lib/storage/sales-imports"
import { addDays, forecastSales, salesByDay, weekdayOf } from "@/lib/forecast"
import { laborInRange, laborPercent, shiftCost, shiftHours, type StaffMember, type StaffShift } from "@/lib/labor"

const noon = (day: string) => `${day}T12:00:00`
/** Lunes de la semana de `day`. */
const mondayOf = (day: string) => addDays(day, -((weekdayOf(day) + 6) % 7))

export function EstadisticasPersonalTab({ businessId }: { businessId: string }) {
  const { t, language } = useLanguage()
  const { toast } = useToast()
  const { active: isMember } = useActiveMembership()
  const locale = getDateLocale(language)
  const today = toIsoDate(new Date())
  const [version, setVersion] = useState(0)
  const business = useMemo(() => getBusinessById(businessId), [businessId, version])
  const staff = business?.staff ?? []
  const shifts = business?.shifts ?? []
  const [weekStart, setWeekStart] = useState(() => mondayOf(today))
  const [personDialog, setPersonDialog] = useState<StaffMember | "new" | null>(null)
  const [shiftDay, setShiftDay] = useState<string | null>(null)

  const imports = getSalesImports(businessId)
  const byDay = useMemo(() => salesByDay(imports), [imports])
  const forecastByDay = useMemo(() => new Map(forecastSales(imports, today, { horizon: 14 }).map((d) => [d.day, d.revenue])), [imports, today])
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const weekEnd = days[6]
  const week = laborInRange(shifts, weekStart, weekEnd)
  const daySales = (d: string) => (d < today ? Math.round((byDay.get(d)?.revenue || 0) * 100) / 100 : forecastByDay.get(d) || Math.round((byDay.get(d)?.revenue || 0) * 100) / 100)
  const weekSales = Math.round(days.reduce((s, d) => s + daySales(d), 0) * 100) / 100
  const staffName = (id: string) => staff.find((s) => s.id === id)?.name || "—"

  const save = async (patch: { staff?: StaffMember[]; shifts?: StaffShift[] }) => {
    // Turnos de más de 400 días se dejan de guardar para que el negocio no crezca sin fin.
    const cutoff = addDays(today, -400)
    const ok = await updateBusiness(businessId, { ...patch, ...(patch.shifts ? { shifts: patch.shifts.filter((s) => s.date >= cutoff) } : {}) })
    if (!ok) toast({ title: t("labor_save_error"), variant: "destructive" })
    setVersion((v) => v + 1)
    return ok
  }

  if (!business) return null

  return (
    <div className="space-y-6" data-testid="personal-tab">
      <div>
        <h2 className="text-lg font-bold">{t("labor_title")}</h2>
        <p className="text-sm text-muted-foreground">{t("labor_subtitle")}</p>
      </div>

      {/* Personas */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-5 w-5 text-primary" />
              {t("labor_staff_title")}
            </CardTitle>
            {!isMember && (
              <Button variant="outline" className="gap-2" onClick={() => setPersonDialog("new")} data-testid="labor-add-person">
                <UserPlus className="h-4 w-4" />
                {t("labor_add_person")}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {staff.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">{t("labor_staff_empty")}</p>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {staff.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  disabled={isMember}
                  onClick={() => setPersonDialog(p)}
                  className={cn("rounded-lg border border-border p-3 text-left transition-colors", !isMember && "hover:bg-muted/50", p.active === false && "opacity-60")}
                >
                  <p className="font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.role || t("labor_no_role")} · {t("labor_rate_per_hour").replace("{rate}", formatCurrency(p.hourlyRate))}
                  </p>
                  {p.active === false && <p className="text-xs text-muted-foreground">{t("labor_inactive")}</p>}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Semana */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <Button variant="ghost" size="icon" onClick={() => setWeekStart(addDays(weekStart, -7))} aria-label={t("labor_prev_week")}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <CardTitle className="text-center text-base">
              {t("labor_week").replace("{from}", formatWeekdayDate(noon(weekStart), locale, { short: true })).replace("{to}", formatWeekdayDate(noon(weekEnd), locale, { short: true }))}
            </CardTitle>
            <Button variant="ghost" size="icon" onClick={() => setWeekStart(addDays(weekStart, 7))} aria-label={t("labor_next_week")}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {days.map((d) => {
            const dayShifts = shifts.filter((s) => s.date === d)
            const cost = Math.round(dayShifts.reduce((s, x) => s + shiftCost(x), 0) * 100) / 100
            const sales = daySales(d)
            const pct = laborPercent(cost, sales)
            return (
              <div key={d} className={cn("rounded-lg border p-3", d === today ? "border-primary" : "border-border")} data-testid="labor-day">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium capitalize">{formatWeekdayDate(noon(d), locale)}</p>
                  {!isMember && staff.some((p) => p.active !== false) && (
                    <Button variant="ghost" size="sm" className="h-8 gap-1" onClick={() => setShiftDay(d)} data-testid="labor-add-shift">
                      <Plus className="h-4 w-4" />
                      {t("labor_add_shift")}
                    </Button>
                  )}
                </div>
                {dayShifts.length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {dayShifts.map((s) => (
                      <li key={s.id} className="flex items-center gap-1 rounded-full border border-border bg-muted/40 py-1 pl-3 pr-1 text-xs">
                        <span>
                          {staffName(s.staffId)} · {s.start}–{s.end} · {s.hours} h · {formatCurrency(shiftCost(s))}
                        </span>
                        {!isMember && (
                          <button
                            type="button"
                            className="rounded-full p-1 text-muted-foreground hover:bg-muted"
                            aria-label={t("labor_remove_shift")}
                            onClick={() => save({ shifts: shifts.filter((x) => x.id !== s.id) })}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-2 text-xs text-muted-foreground">
                  {t("labor_day_line")
                    .replace("{cost}", formatCurrency(cost))
                    .replace("{sales}", formatCurrency(sales))
                    .replace("{pct}", String(pct))}
                  {d >= today && sales > 0 ? ` · ${t("labor_forecast_sales")}` : ""}
                </p>
              </div>
            )
          })}

          <div className="flex items-start justify-between gap-2 rounded-lg border border-border bg-muted/30 p-3">
            <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">{t("labor_week_hours")}</p>
                <p className="font-semibold tabular-nums">{week.hours} h</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t("labor_week_cost")}</p>
                <p className="font-semibold tabular-nums">{formatCurrency(week.cost)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t("labor_week_sales")}</p>
                <p className="font-semibold tabular-nums">{formatCurrency(weekSales)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t("labor_week_pct")}</p>
                <p className="font-semibold tabular-nums">{laborPercent(week.cost, weekSales)} %</p>
              </div>
            </div>
            <CalcHelp
              title={t("labor_calc_title")}
              intro={t("labor_calc_intro")}
              steps={[
                ...shifts
                  .filter((s) => s.date >= weekStart && s.date <= weekEnd)
                  .slice(0, 3)
                  .map((s) => ({
                    label: `${staffName(s.staffId)} · ${formatWeekdayDate(noon(s.date), locale, { short: true })}`,
                    formula: `${s.start}–${s.end} = ${s.hours} h × ${formatCurrency(s.rate)} = ${formatCurrency(shiftCost(s))}`,
                  })),
                { label: t("labor_week_cost"), formula: `${t("labor_calc_sum")} = ${formatCurrency(week.cost)}` },
                { label: t("labor_week_pct"), formula: `${formatCurrency(week.cost)} ÷ ${formatCurrency(weekSales)} × 100 = ${laborPercent(week.cost, weekSales)} %`, note: t("labor_calc_pct_note") },
              ]}
            />
          </div>
          <p className="text-xs text-muted-foreground">{t("labor_finance_note")}</p>
        </CardContent>
      </Card>

      <PersonDialog
        person={personDialog}
        onClose={() => setPersonDialog(null)}
        onSave={async (p) => {
          const exists = staff.some((s) => s.id === p.id)
          const ok = await save({ staff: exists ? staff.map((s) => (s.id === p.id ? p : s)) : [...staff, p] })
          if (ok) setPersonDialog(null)
        }}
      />
      <ShiftDialog
        day={shiftDay}
        staff={staff.filter((p) => p.active !== false)}
        onClose={() => setShiftDay(null)}
        onSave={async (s) => {
          const ok = await save({ shifts: [...shifts, s] })
          if (ok) setShiftDay(null)
        }}
      />
    </div>
  )
}

function PersonDialog({ person, onClose, onSave }: { person: StaffMember | "new" | null; onClose: () => void; onSave: (p: StaffMember) => void | Promise<void> }) {
  const { t } = useLanguage()
  const editing = person && person !== "new" ? person : null
  const [name, setName] = useState("")
  const [role, setRole] = useState("")
  const [rate, setRate] = useState(0)
  const [active, setActive] = useState(true)
  const open = person !== null
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
    >
      <DialogContent
        className="max-w-md"
        onOpenAutoFocus={() => {
          setName(editing?.name || "")
          setRole(editing?.role || "")
          setRate(editing?.hourlyRate || 0)
          setActive(editing?.active !== false)
        }}
      >
        <DialogHeader>
          <DialogTitle>{editing ? t("labor_edit_person") : t("labor_add_person")}</DialogTitle>
          <DialogDescription>{t("labor_person_desc")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">{t("labor_person_name")}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">{t("labor_person_role")}</Label>
            <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder={t("labor_person_role_placeholder")} />
          </div>
          <div>
            <Label className="text-xs">{t("labor_person_rate")}</Label>
            <NumericInput value={rate} onChange={(v) => setRate(Math.max(0, Number(v) || 0))} decimalPlaces={2} min={0} />
            <p className="mt-1 text-xs text-muted-foreground">{t("labor_person_rate_note")}</p>
          </div>
          {editing && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!active} onChange={(e) => setActive(!e.target.checked)} />
              {t("labor_person_inactive")}
            </label>
          )}
        </div>
        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
          <Button variant="outline" onClick={onClose}>
            {t("common_cancel")}
          </Button>
          <Button
            disabled={!name.trim() || !(rate > 0)}
            onClick={() => onSave({ id: editing?.id || `st-${Date.now()}`, name: name.trim(), role: role.trim(), hourlyRate: rate, ...(active ? {} : { active: false }) })}
            data-testid="labor-save-person"
          >
            {t("labor_save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ShiftDialog({ day, staff, onClose, onSave }: { day: string | null; staff: StaffMember[]; onClose: () => void; onSave: (s: StaffShift) => void | Promise<void> }) {
  const { t, language } = useLanguage()
  const [staffId, setStaffId] = useState("")
  const [start, setStart] = useState("08:00")
  const [end, setEnd] = useState("16:00")
  const person = staff.find((p) => p.id === staffId)
  const hours = shiftHours(start, end)
  const cost = person ? Math.round(hours * person.hourlyRate * 100) / 100 : 0
  return (
    <Dialog
      open={day !== null}
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
    >
      <DialogContent className="max-w-md" onOpenAutoFocus={() => setStaffId(staff[0]?.id || "")}>
        <DialogHeader>
          <DialogTitle>{t("labor_add_shift")}</DialogTitle>
          <DialogDescription className="capitalize">{day ? formatWeekdayDate(noon(day), getDateLocale(language)) : ""}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">{t("labor_shift_person")}</Label>
            <Select value={staffId} onValueChange={setStaffId}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {staff.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">{t("labor_shift_start")}</Label>
              <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">{t("labor_shift_end")}</Label>
              <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            {t("labor_shift_preview")
              .replace("{hours}", String(hours))
              .replace("{rate}", formatCurrency(person?.hourlyRate || 0))
              .replace("{cost}", formatCurrency(cost))}
          </p>
        </div>
        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
          <Button variant="outline" onClick={onClose}>
            {t("common_cancel")}
          </Button>
          <Button
            disabled={!person || !(hours > 0) || !day}
            onClick={() => person && day && onSave({ id: `sh-${Date.now()}`, staffId: person.id, date: day, start, end, hours, rate: person.hourlyRate })}
            data-testid="labor-save-shift"
          >
            {t("labor_save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
