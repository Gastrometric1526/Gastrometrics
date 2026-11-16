"use client"

/**
 * Horario del personal (pedido del dueño, docs/323): «poner y quitar personas de fecha en fecha,
 * colocar los nombres y luego moverlos… y crear un PDF».
 *
 * - En la computadora: se arrastra una persona a un día para ponerla, y un turno de un día a
 *   otro para moverlo.
 * - En el celular (o sin arrastrar): se toca una persona y luego «Poner aquí» en el día; se toca
 *   un turno para cambiar sus horas, moverlo a otro día o quitarlo.
 * - «Copiar la semana anterior» y «Descargar PDF» (lib/pdf/staff-schedule-pdf-generator.ts).
 * Lo usan la pestaña Horario del POS y Reportes → Personal (con costos y venta del día).
 */

import { useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, Copy, Download, Pencil, Plus, UserPlus, X } from "lucide-react"
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
import { formatCurrency } from "@/lib/currency"
import { formatWeekdayDate, toIsoDate } from "@/lib/date-format"
import { getDateLocale } from "@/lib/i18n/translations"
import { cn } from "@/lib/utils"
import { addDays } from "@/lib/forecast"
import { laborPercent, shiftCost, shiftHours, type StaffMember, type StaffShift } from "@/lib/labor"
import { addPersonToDay, copyWeek, mondayOf, moveShift, removeShift, updateShiftTimes, weekByPerson, weekDays } from "@/lib/staff-schedule"
import { useStaffSchedule } from "@/lib/staff-schedule-store"
import { downloadStaffSchedulePDF } from "@/lib/pdf/staff-schedule-pdf-generator"
import { getBusinessById } from "@/lib/storage/businesses"

const noon = (day: string) => `${day}T12:00:00`
type Drag = { type: "person" | "shift"; id: string }

export function StaffScheduleBoard({
  businessId,
  canEdit,
  showCosts,
  canPdf,
  daySales,
}: {
  businessId: string
  canEdit: boolean
  showCosts: boolean
  canPdf: boolean
  /** Venta (o venta esperada) de cada día, para el % de personal. Solo en Reportes. */
  daySales?: (day: string) => number
}) {
  const { t, language } = useLanguage()
  const { toast } = useToast()
  const locale = getDateLocale(language)
  const today = toIsoDate(new Date())
  const { schedule, save } = useStaffSchedule(businessId)
  const [monday, setMonday] = useState(() => mondayOf(today))
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)
  const [personDialog, setPersonDialog] = useState<StaffMember | "new" | null>(null)
  const [shiftDialog, setShiftDialog] = useState<StaffShift | null>(null)
  const days = weekDays(monday)
  const people = schedule.staff.filter((p) => p.active !== false)
  const byPerson = useMemo(() => weekByPerson(schedule, monday), [schedule, monday])
  const weekHours = Math.round(byPerson.reduce((s, r) => s + r.hours, 0) * 100) / 100
  const weekCost = Math.round(byPerson.reduce((s, r) => s + r.cost, 0) * 100) / 100
  const weekSales = daySales ? Math.round(days.reduce((s, d) => s + daySales(d), 0) * 100) / 100 : 0
  const name = (id: string) => schedule.staff.find((p) => p.id === id)?.name || "—"

  const commit = async (next: typeof schedule) => {
    const ok = await save(next)
    if (!ok) toast({ title: t("labor_save_error"), variant: "destructive" })
  }
  const placePerson = (staffId: string, day: string) => {
    if (schedule.shifts.some((s) => s.staffId === staffId && s.date === day)) {
      toast({ title: t("schedule_already_that_day").replace("{name}", name(staffId)) })
      return
    }
    commit(addPersonToDay(schedule, staffId, day))
  }
  const onDrop = (day: string, raw: string) => {
    setDragOver(null)
    if (!canEdit) return
    try {
      const d = JSON.parse(raw) as Drag
      if (d.type === "person") placePerson(d.id, day)
      else if (d.type === "shift") commit(moveShift(schedule, d.id, day))
    } catch {
      /* no es un arrastre del horario */
    }
  }
  const dragProps = (d: Drag) =>
    canEdit
      ? {
          draggable: true,
          onDragStart: (e: React.DragEvent) => {
            e.dataTransfer.setData("text/plain", JSON.stringify(d))
            e.dataTransfer.effectAllowed = "move"
          },
        }
      : {}
  const business = getBusinessById(businessId)

  return (
    <div className="space-y-4" data-testid="staff-schedule">
      {/* Semana y acciones */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => setMonday(addDays(monday, -7))} aria-label={t("labor_prev_week")}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <p className="min-w-0 text-sm font-medium">
            {t("labor_week").replace("{from}", formatWeekdayDate(noon(days[0]), locale, { short: true })).replace("{to}", formatWeekdayDate(noon(days[6]), locale, { short: true }))}
          </p>
          <Button variant="ghost" size="icon" onClick={() => setMonday(addDays(monday, 7))} aria-label={t("labor_next_week")}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          {monday !== mondayOf(today) && (
            <Button variant="link" size="sm" onClick={() => setMonday(mondayOf(today))}>
              {t("schedule_this_week")}
            </Button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => commit(copyWeek(schedule, addDays(monday, -7), monday))} data-testid="schedule-copy-week">
              <Copy className="h-4 w-4" />
              {t("schedule_copy_last_week")}
            </Button>
          )}
          {canPdf && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => downloadStaffSchedulePDF(schedule, { businessId, businessName: business?.name, businessLogo: business?.logo, monday, showCosts })}
              data-testid="schedule-pdf"
            >
              <Download className="h-4 w-4" />
              {t("schedule_pdf")}
            </Button>
          )}
        </div>
      </div>

      {/* Personas para poner */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">{t("labor_staff_title")}</CardTitle>
              {canEdit && people.length > 0 && <p className="text-xs text-muted-foreground">{t("schedule_people_hint")}</p>}
            </div>
            {canEdit && (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setPersonDialog("new")} data-testid="labor-add-person">
                <UserPlus className="h-4 w-4" />
                {t("labor_add_person")}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {schedule.staff.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">{t("labor_staff_empty")}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {schedule.staff.map((p) => (
                <div
                  key={p.id}
                  {...dragProps({ type: "person", id: p.id })}
                  className={cn(
                    "flex items-center gap-1 rounded-full border py-1 pl-3 pr-1 text-sm",
                    selectedPerson === p.id ? "border-primary bg-primary/10" : "border-border bg-muted/40",
                    canEdit && p.active !== false && "cursor-grab active:cursor-grabbing",
                    p.active === false && "opacity-50",
                  )}
                  data-testid="schedule-person"
                >
                  <button
                    type="button"
                    disabled={!canEdit || p.active === false}
                    onClick={() => setSelectedPerson((s) => (s === p.id ? null : p.id))}
                    className="text-left"
                    aria-pressed={selectedPerson === p.id}
                  >
                    <span className="font-medium">{p.name}</span>
                    {p.role && <span className="text-xs text-muted-foreground"> · {p.role}</span>}
                  </button>
                  {canEdit && (
                    <button type="button" className="rounded-full p-1 text-muted-foreground hover:bg-muted" onClick={() => setPersonDialog(p)} aria-label={t("labor_edit_person")}>
                      <Pencil className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          {selectedPerson && <p className="mt-2 text-xs text-primary">{t("schedule_tap_day").replace("{name}", name(selectedPerson))}</p>}
        </CardContent>
      </Card>

      {/* La semana */}
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-7">
        {days.map((d) => {
          const dayShifts = schedule.shifts.filter((s) => s.date === d).sort((a, b) => a.start.localeCompare(b.start))
          const cost = Math.round(dayShifts.reduce((s, x) => s + shiftCost(x), 0) * 100) / 100
          const sales = daySales ? daySales(d) : 0
          return (
            <div
              key={d}
              onDragOver={(e) => {
                if (!canEdit) return
                e.preventDefault()
                setDragOver(d)
              }}
              onDragLeave={() => setDragOver((x) => (x === d ? null : x))}
              onDrop={(e) => {
                e.preventDefault()
                onDrop(d, e.dataTransfer.getData("text/plain"))
              }}
              className={cn(
                "flex min-h-[8rem] flex-col rounded-lg border p-2 transition-colors",
                d === today ? "border-primary" : "border-border",
                dragOver === d && "bg-primary/10",
              )}
              data-testid="schedule-day"
            >
              <p className="mb-2 text-sm font-medium capitalize">{formatWeekdayDate(noon(d), locale, { short: true })}</p>
              <div className="flex flex-1 flex-col gap-1.5">
                {dayShifts.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    {...dragProps({ type: "shift", id: s.id })}
                    onClick={() => canEdit && setShiftDialog(s)}
                    className={cn("rounded-md border border-border bg-primary/5 px-2 py-1.5 text-left text-xs", canEdit && "cursor-grab hover:bg-primary/10 active:cursor-grabbing")}
                    data-testid="schedule-shift"
                  >
                    <span className="block font-medium">{name(s.staffId)}</span>
                    <span className="text-muted-foreground">
                      {s.start}–{s.end} · {s.hours} h{showCosts ? ` · ${formatCurrency(shiftCost(s))}` : ""}
                    </span>
                  </button>
                ))}
                {canEdit && selectedPerson && (
                  <Button variant="ghost" size="sm" className="h-8 justify-start gap-1 text-primary" onClick={() => placePerson(selectedPerson, d)}>
                    <Plus className="h-4 w-4" />
                    {t("schedule_put_here")}
                  </Button>
                )}
                {dayShifts.length === 0 && !selectedPerson && <p className="text-xs text-muted-foreground">{canEdit ? t("schedule_drop_here") : "—"}</p>}
              </div>
              {(showCosts || daySales) && dayShifts.length > 0 && (
                <p className="mt-2 border-t border-border pt-1 text-xs text-muted-foreground">
                  {showCosts ? formatCurrency(cost) : `${Math.round(dayShifts.reduce((s, x) => s + x.hours, 0) * 100) / 100} h`}
                  {daySales && showCosts && sales > 0 ? ` · ${laborPercent(cost, sales)} %` : ""}
                </p>
              )}
            </div>
          )
        })}
      </div>

      {/* Totales de la semana */}
      <div className="flex items-start justify-between gap-2 rounded-lg border border-border bg-muted/30 p-3">
        <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">{t("labor_week_hours")}</p>
            <p className="font-semibold tabular-nums">{weekHours} h</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t("schedule_people_working")}</p>
            <p className="font-semibold tabular-nums">{byPerson.filter((r) => r.hours > 0).length}</p>
          </div>
          {showCosts && (
            <div>
              <p className="text-xs text-muted-foreground">{t("labor_week_cost")}</p>
              <p className="font-semibold tabular-nums">{formatCurrency(weekCost)}</p>
            </div>
          )}
          {showCosts && daySales && (
            <div>
              <p className="text-xs text-muted-foreground">{t("labor_week_pct")}</p>
              <p className="font-semibold tabular-nums">{laborPercent(weekCost, weekSales)} %</p>
            </div>
          )}
        </div>
        <CalcHelp
          title={t("labor_calc_title")}
          intro={t("labor_calc_intro")}
          steps={[
            ...byPerson
              .filter((r) => r.hours > 0)
              .slice(0, 4)
              .map((r) => ({
                label: r.person.name,
                formula: showCosts
                  ? `${r.hours} h × ${formatCurrency(r.person.hourlyRate)} = ${formatCurrency(r.cost)}`
                  : `${r.days.flat().map((s) => `${s.hours} h`).join(" + ")} = ${r.hours} h`,
              })),
            ...(showCosts ? [{ label: t("labor_week_cost"), formula: `${t("labor_calc_sum")} = ${formatCurrency(weekCost)}` }] : []),
            ...(showCosts && daySales
              ? [{ label: t("labor_week_pct"), formula: `${formatCurrency(weekCost)} ÷ ${formatCurrency(weekSales)} × 100 = ${laborPercent(weekCost, weekSales)} %`, note: t("labor_calc_pct_note") }]
              : []),
          ]}
        />
      </div>

      <PersonDialog
        person={personDialog}
        showRate={showCosts}
        onClose={() => setPersonDialog(null)}
        onSave={async (p) => {
          const exists = schedule.staff.some((s) => s.id === p.id)
          await commit({ ...schedule, staff: exists ? schedule.staff.map((s) => (s.id === p.id ? p : s)) : [...schedule.staff, p] })
          setPersonDialog(null)
        }}
      />
      <ShiftDialog
        shift={shiftDialog}
        name={shiftDialog ? name(shiftDialog.staffId) : ""}
        days={days}
        locale={locale}
        onClose={() => setShiftDialog(null)}
        onSave={async (start, end, day) => {
          if (!shiftDialog) return
          let next = updateShiftTimes(schedule, shiftDialog.id, start, end)
          if (day !== shiftDialog.date) next = moveShift(next, shiftDialog.id, day)
          await commit(next)
          setShiftDialog(null)
        }}
        onRemove={async () => {
          if (!shiftDialog) return
          await commit(removeShift(schedule, shiftDialog.id))
          setShiftDialog(null)
        }}
      />
    </div>
  )
}

function PersonDialog({ person, showRate, onClose, onSave }: { person: StaffMember | "new" | null; showRate: boolean; onClose: () => void; onSave: (p: StaffMember) => void | Promise<void> }) {
  const { t } = useLanguage()
  const editing = person && person !== "new" ? person : null
  const [name, setName] = useState("")
  const [role, setRole] = useState("")
  const [rate, setRate] = useState(0)
  const [start, setStart] = useState("08:00")
  const [end, setEnd] = useState("16:00")
  const [active, setActive] = useState(true)
  return (
    <Dialog open={person !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-w-md"
        onOpenAutoFocus={() => {
          setName(editing?.name || "")
          setRole(editing?.role || "")
          setRate(editing?.hourlyRate || 0)
          setStart(editing?.defaultStart || "08:00")
          setEnd(editing?.defaultEnd || "16:00")
          setActive(editing?.active !== false)
        }}
      >
        <DialogHeader>
          <DialogTitle>{editing ? t("labor_edit_person") : t("labor_add_person")}</DialogTitle>
          <DialogDescription>{t("schedule_person_desc")}</DialogDescription>
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
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">{t("schedule_default_start")}</Label>
              <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">{t("schedule_default_end")}</Label>
              <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
          {showRate && (
            <div>
              <Label className="text-xs">{t("labor_person_rate")}</Label>
              <NumericInput value={rate} onChange={(v) => setRate(Math.max(0, Number(v) || 0))} decimalPlaces={2} min={0} />
              <p className="mt-1 text-xs text-muted-foreground">{t("labor_person_rate_note")}</p>
            </div>
          )}
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
            disabled={!name.trim() || !(shiftHours(start, end) > 0)}
            onClick={() =>
              onSave({
                id: editing?.id || `st-${Date.now()}`,
                name: name.trim(),
                role: role.trim(),
                // Quien no ve costos no cambia el pago: se conserva el que había.
                hourlyRate: showRate ? rate : editing?.hourlyRate || 0,
                defaultStart: start,
                defaultEnd: end,
                ...(active ? {} : { active: false }),
              })
            }
            data-testid="labor-save-person"
          >
            {t("labor_save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ShiftDialog({
  shift,
  name,
  days,
  locale,
  onClose,
  onSave,
  onRemove,
}: {
  shift: StaffShift | null
  name: string
  days: string[]
  locale: string
  onClose: () => void
  onSave: (start: string, end: string, day: string) => void | Promise<void>
  onRemove: () => void | Promise<void>
}) {
  const { t } = useLanguage()
  const [start, setStart] = useState("08:00")
  const [end, setEnd] = useState("16:00")
  const [day, setDay] = useState("")
  const options = shift && !days.includes(shift.date) ? [shift.date, ...days] : days
  return (
    <Dialog open={shift !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-w-md"
        onOpenAutoFocus={() => {
          setStart(shift?.start || "08:00")
          setEnd(shift?.end || "16:00")
          setDay(shift?.date || "")
        }}
      >
        <DialogHeader>
          <DialogTitle>{name}</DialogTitle>
          <DialogDescription>{t("schedule_shift_desc")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">{t("schedule_shift_day")}</Label>
            <Select value={day} onValueChange={setDay}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {options.map((d) => (
                  <SelectItem key={d} value={d}>
                    <span className="capitalize">{formatWeekdayDate(noon(d), locale)}</span>
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
          <p className="text-sm text-muted-foreground">{t("schedule_hours_preview").replace("{hours}", String(shiftHours(start, end)))}</p>
        </div>
        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button variant="ghost" className="gap-1.5 text-destructive" onClick={onRemove} data-testid="schedule-remove-shift">
            <X className="h-4 w-4" />
            {t("labor_remove_shift")}
          </Button>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button variant="outline" onClick={onClose}>
              {t("common_cancel")}
            </Button>
            <Button disabled={!(shiftHours(start, end) > 0) || !day} onClick={() => onSave(start, end, day)}>
              {t("labor_save")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
