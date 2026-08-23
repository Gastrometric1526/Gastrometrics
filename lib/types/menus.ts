export type MenuSection = "entrada" | "fuerte" | "postre" | "bebida"

// Tipo de menú elegido en el primer paso del asistente de creación.
export const menuTypes = [
  "Almuerzo",
  "Cena",
  "Brunch",
  "Buffet",
  "Degustación",
  "Catering",
  "Evento especial",
  "Otro",
] as const

export type MenuTypeOption = (typeof menuTypes)[number]

// Un "paso" de menú definido por el usuario (Entrada, Plato Fuerte, Postre, o
// cualquier nombre libre) — reemplaza al modelo anterior de 4 secciones fijas.
// Puede contener múltiples platos (MenuItem) seleccionados por el usuario.
export type MenuStep = {
  id: string
  name: string // "Entrada", "Plato Fuerte", o texto libre
  order: number
}

export type MenuItem = {
  id: string // id estable del ítem dentro del menú
  recipeId: string // id en Mis Recetas
  stepId: string // a qué paso del menú pertenece (lib/types/menus.ts MenuStep.id)
  section: MenuSection // bucket fijo derivado del paso/receta, usado solo por analytics de mezcla
  label?: string // "Postre 1…", editable
  priceOverride?: number | null // null => usa priceBase de Ficha
  enabled: boolean // activar/desactivar sin borrar
  // Cuántas porciones de ESTE plato se necesitan para el evento/corrida de este menú —
  // independiente de menu.plannedServings (no todo plato sirve 1:1 por comensal, ej. un
  // postre compartido). Solo se usa para escalar la lista de compras (ver
  // lib/menus.ts generateMenuIngredientList); NUNCA debe escribirse de vuelta a la
  // receta original (recipe.yieldAmount, etc.) — es una escala de solo lectura aplicada
  // al momento de generar la orden de compra, igual que el modificador de PAX de Ficha
  // Técnica escala sin persistir en la receta base.
  plannedQuantity?: number | null
}

export type Menu = {
  id: string
  businessId: string
  name: string // "Almuerzo Ejecutivo", "Degustación 12 tiempos"
  menuType?: MenuTypeOption | string
  serviceDate?: string | null // ISO yyyy-mm-dd, editable en cualquier momento
  // Para cuántas personas es esta corrida del menú — default sugerido para
  // MenuItem.plannedQuantity cuando el usuario no ajusta un plato en particular.
  plannedServings?: number | null
  steps: MenuStep[]
  items: MenuItem[]
  createdAt: string // ISO
  updatedAt: string // ISO
}

export type ScenarioMixMethod = "ventas" | "inventario" | "heuristica" | "capacidad"

export type ScenarioParams = {
  businessId: string
  menuId: string
  capacity: { seats: number; servicesPerDay: number; daysOpen: number; occupancy: number } // occupancy 0–1
  mixMethod: ScenarioMixMethod
  categoryWeights?: Partial<Record<MenuSection, number>> // sliders 0–100; normalizar internamente
  upsellBebidas?: boolean // si true ⇒ +10% relativo al peso de bebidas y renormalizar
  // hooks futuros opcionales:
  salesHistoryByRecipe?: Record<string, number>
  inventoryDerivedPortions?: Record<string, number>
}

export type ScenarioResult = {
  businessId: string
  menuId: string
  timestamp: string // ISO
  TP: number // ticket promedio
  CVp: number // costo variable promedio por plato (porción)
  MC: number // margen medio = TP - CVp
  PE_plates: number // punto de equilibrio en platos/mes
  PE_revenue: number // punto de equilibrio en L/mes
  PVm_est?: number // platos/mes estimados (capacidad u otra fuente)
  confidence: "alta" | "media" | "baja"
  notes: string[] // explicación de fuente y supuestos
  hasOverrides: boolean // el menú activo tenía overrides
  params: ScenarioParams // parámetros usados
}
