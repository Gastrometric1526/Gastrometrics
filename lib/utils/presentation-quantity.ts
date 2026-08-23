import type { Ingredient } from "@/types/ingredient"

// Convierte una cantidad en la unidad base del ingrediente (gramos, mililitros, etc.)
// a cuántas unidades de su presentación de compra (Saco, Caja, Botella...) hacen falta.
// Se redondea siempre hacia arriba — igual que el resto de la app nunca sugiere comprar
// menos de lo que realmente se necesita (ver escalado de recetas/menús).
export interface PresentationQuantity {
  presentation: string | null // null si el ingrediente todavia no tiene presentacion configurada
  presentationQuantity: number | null // null si no hay presentacion; en ese caso usar baseQuantity/baseUnit
  baseQuantity: number
  baseUnit: string
}

export function computePresentationQuantity(
  ingredient: Pick<Ingredient, "presentation" | "unit"> & { pricing?: { netContent?: number } },
  baseQuantity: number,
): PresentationQuantity {
  const presentation = ingredient?.presentation || null
  const netContent = ingredient?.pricing?.netContent

  if (!presentation || !netContent || netContent <= 0) {
    return { presentation, presentationQuantity: null, baseQuantity, baseUnit: ingredient?.unit || "" }
  }

  return {
    presentation,
    presentationQuantity: Math.ceil(baseQuantity / netContent),
    baseQuantity,
    baseUnit: ingredient?.unit || "",
  }
}
