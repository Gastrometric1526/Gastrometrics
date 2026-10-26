/**
 * Color de la tarjeta de cada módulo en las Acciones Rápidas del Dashboard y en los módulos de
 * un negocio (docs/203). Los módulos salen de la lista del menú lateral (useNavigationItems,
 * components/sidebar.tsx); aquí solo se decide el color. Un módulo sin color usa el primario.
 */
const STYLE: Record<string, number> = {
  "/ingredientes": 2,
  "/ficha-tecnica": 1,
  "/mis-recetas": 5,
  "/inventario": 6,
  "/equipo": 1,
  "/menus": 3,
  "/mep": 3,
  "/menu-y-compras": 4,
  "/ventas": 2,
  "/estadisticas": 7,
  "/negocios": 5,
  "/mi-plan#invita": 4,
}

const CLASSES: Record<number, { bgColor: string; textColor: string }> = {
  1: { bgColor: "bg-chart-1/10 group-hover:bg-chart-1/20", textColor: "text-chart-1" },
  2: { bgColor: "bg-chart-2/10 group-hover:bg-chart-2/20", textColor: "text-chart-2" },
  3: { bgColor: "bg-chart-3/10 group-hover:bg-chart-3/20", textColor: "text-chart-3" },
  4: { bgColor: "bg-chart-4/10 group-hover:bg-chart-4/20", textColor: "text-chart-4" },
  5: { bgColor: "bg-chart-5/10 group-hover:bg-chart-5/20", textColor: "text-chart-5" },
  6: { bgColor: "bg-chart-6/10 group-hover:bg-chart-6/20", textColor: "text-chart-6" },
  7: { bgColor: "bg-chart-7/10 group-hover:bg-chart-7/20", textColor: "text-chart-7" },
}

export function moduleCardStyle(href: string): { bgColor: string; textColor: string } {
  const n = STYLE[href.split("?")[0]]
  return n ? CLASSES[n] : { bgColor: "bg-primary/10 group-hover:bg-primary/20", textColor: "text-primary" }
}
