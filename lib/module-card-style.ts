/**
 * Color de la tarjeta de cada módulo en las Acciones Rápidas del Dashboard y en los módulos de
 * un negocio. Desde docs/309 todas usan el color elegido (el de la persona, o el del negocio si
 * tiene uno propio): pedido del dueño, «asegúrate que los iconos vayan con los colores
 * seleccionables». Antes cada módulo tenía un color fijo de gráfico (chart-1…7) que no cambiaba
 * al elegir otro color.
 */
const PRIMARY = { bgColor: "bg-primary/10 group-hover:bg-primary/20", textColor: "text-primary" }

export function moduleCardStyle(_href: string): { bgColor: string; textColor: string } {
  return PRIMARY
}
