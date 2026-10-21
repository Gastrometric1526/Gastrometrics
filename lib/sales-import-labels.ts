import type { SalesImport } from "@/types/sales-import"
import type { LanguageCode } from "@/lib/i18n/translations"
import { formatDate } from "@/lib/date-format"

// Un registro manual de ventas guarda su nombre ("Registro manual — 22 sept 2026") en el
// idioma de quien lo creó. Para que en pantalla siempre salga en el idioma actual y con
// el mismo formato de fecha (docs/156: aparecía "Manual entry — Sep 29, 2026" en la
// interfaz en español), el nombre de los registros manuales se arma al mostrarlo.
export function salesImportDisplayName(
  imp: Pick<SalesImport, "fileName" | "source" | "periodStart">,
  t: (key: "manual_sales_entry_label") => string,
  language: LanguageCode,
): string {
  if (imp.source !== "manual" || !imp.periodStart) return imp.fileName
  const date = new Date(`${imp.periodStart.slice(0, 10)}T12:00:00`)
  if (Number.isNaN(date.getTime())) return imp.fileName
  const label = formatDate(date)
  return `${t("manual_sales_entry_label")} — ${label}`
}
