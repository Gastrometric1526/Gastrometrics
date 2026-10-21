import { formatDate as formatDMY } from "@/lib/date-format"

// Día/mes/año en todo el proyecto (docs/170); `locale` se ignora y queda por compatibilidad.
export const formatDate = (dateString: string, _locale?: string): string => formatDMY(dateString, { fallback: dateString })

export const inventoryTypes = ["inicial", "final", "nueva compra"] as const
export const inventoryPeriods = ["diario", "semanal", "mensual"] as const
