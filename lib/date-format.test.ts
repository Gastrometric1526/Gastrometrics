import { describe, it, expect } from "vitest"
import {
  formatDate,
  formatDateTime,
  formatDayMonth,
  formatMonthYear,
  formatDateRange,
  formatWeekdayDate,
  parseDayMonthYear,
  toIsoDate,
} from "./date-format"

describe("fechas siempre día/mes/año (docs/170)", () => {
  const d = new Date(2026, 9, 3, 9, 5) // 3 de octubre de 2026, 09:05 local

  it("formatos básicos", () => {
    expect(formatDate(d)).toBe("03/10/2026")
    expect(formatDateTime(d)).toBe("03/10/2026 09:05")
    expect(formatDayMonth(d)).toBe("03/10")
    expect(formatMonthYear(d)).toBe("10/2026")
    expect(formatDateRange(d, new Date(2026, 9, 9))).toBe("03/10/2026 – 09/10/2026")
  })

  it("una fecha sola YYYY-MM-DD no se corre un día", () => {
    expect(formatDate("2026-10-20")).toBe("20/10/2026")
  })

  it("con zona horaria (Honduras = UTC−6)", () => {
    expect(formatDateTime("2026-10-21T03:30:00Z", { timeZone: "America/Tegucigalpa" })).toBe("20/10/2026 21:30")
    expect(formatDate("2026-10-21T03:30:00Z", { timeZone: "America/Tegucigalpa" })).toBe("20/10/2026")
  })

  it("el idioma no cambia el orden", () => {
    expect(formatWeekdayDate("2026-10-23", "en-US")).toBe("Friday 23/10/2026")
    expect(formatWeekdayDate("2026-10-23", "es-HN")).toBe("viernes 23/10/2026")
  })

  it("vacío o inválido", () => {
    expect(formatDate(null)).toBe("")
    expect(formatDate("no es fecha", { fallback: "—" })).toBe("—")
  })

  it("leer lo que escribe la persona", () => {
    expect(parseDayMonthYear("3/10/2026")).toBe("2026-10-03")
    expect(parseDayMonthYear("31/02/2026")).toBeNull()
    expect(parseDayMonthYear("10-2026")).toBeNull()
    expect(toIsoDate(d)).toBe("2026-10-03")
  })
})
