"use client"

/**
 * Campo de fecha que siempre muestra día/mes/año (docs/170). Reemplaza <input type="date">,
 * que el navegador dibuja según su propio idioma (mes/día/año en un navegador en inglés).
 * Mismo contrato que el input nativo: `value` y `onChange` en "YYYY-MM-DD" ("" = vacío).
 * Se puede escribir (dd/mm/aaaa) o elegir en el calendario.
 */

import { useEffect, useState } from "react"
import { CalendarIcon } from "lucide-react"
import { es, enUS, da, fr, ptBR, zhCN } from "date-fns/locale"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useLanguage } from "@/contexts/language-context"
import { cn } from "@/lib/utils"
import { formatDate, parseDayMonthYear, toDate, toIsoDate } from "@/lib/date-format"

const CALENDAR_LOCALES = { es, en: enUS, da, fr, pt: ptBR, zh: zhCN }

export interface DateFieldProps {
  value: string
  onChange: (value: string) => void
  id?: string
  className?: string
  /** "YYYY-MM-DD" */
  min?: string
  max?: string
  disabled?: boolean
  required?: boolean
  autoFocus?: boolean
  placeholder?: string
}

export function DateField({ value, onChange, id, className, min, max, disabled, required, autoFocus, placeholder }: DateFieldProps) {
  const { language, t } = useLanguage()
  const [text, setText] = useState(formatDate(value))
  const [open, setOpen] = useState(false)

  useEffect(() => setText(formatDate(value)), [value])

  const inRange = (iso: string) => (!min || iso >= min) && (!max || iso <= max)

  const commitText = (raw: string) => {
    if (!raw.trim()) {
      onChange("")
      return
    }
    const iso = parseDayMonthYear(raw)
    if (iso && inRange(iso)) onChange(iso)
    else setText(formatDate(value)) // no válido: vuelve a lo que había
  }

  const selected = toDate(value) ?? undefined
  const minDate = toDate(min) ?? undefined
  const maxDate = toDate(max) ?? undefined

  return (
    <div className={cn("relative", className)}>
      <Input
        id={id}
        inputMode="numeric"
        placeholder={placeholder ?? t("date_field_placeholder")}
        value={text}
        disabled={disabled}
        required={required}
        autoFocus={autoFocus}
        onChange={(e) => {
          setText(e.target.value)
          const iso = parseDayMonthYear(e.target.value)
          if (iso && inRange(iso)) onChange(iso)
        }}
        onBlur={(e) => commitText(e.target.value)}
        className="pr-9"
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled}
            className="absolute right-0 top-0 h-full w-9"
            aria-label={t("inventario_register_select_date_aria")}
          >
            <CalendarIcon className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            autoFocus
            mode="single"
            selected={selected}
            defaultMonth={selected}
            disabled={[...(minDate ? [{ before: minDate }] : []), ...(maxDate ? [{ after: maxDate }] : [])]}
            onSelect={(d) => {
              if (!d) return
              onChange(toIsoDate(d))
              setOpen(false)
            }}
            locale={CALENDAR_LOCALES[language as keyof typeof CALENDAR_LOCALES] ?? es}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
