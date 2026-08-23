export const formatDate = (dateString: string, locale = "es-ES"): string => {
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString(locale, {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  } catch (error) {
    return dateString
  }
}

export const inventoryTypes = ["inicial", "final", "nueva compra"] as const
export const inventoryPeriods = ["diario", "semanal", "mensual"] as const
