/**
 * Íconos propios de GastroMetrics (docs/307). Pedido del dueño: «iconos únicos y no genéricos,
 * siempre con el mismo estilo minimalista; no quiero iconos de stock».
 *
 * Estilo (no cambiarlo al agregar uno nuevo):
 * - retícula de 24 × 24, trazo 1.6, puntas y uniones redondeadas, sin relleno;
 * - color del tema por `currentColor` (se pinta con las clases text-* de siempre);
 * - cada ícono es un objeto de cocina, no un símbolo de oficina.
 *
 * Misma forma de uso que lucide-react (`className`, `strokeWidth`, `aria-*`), así que se cambian
 * uno por uno sin tocar el resto del componente.
 */
import { forwardRef, type SVGProps } from "react"

export type GmIconProps = SVGProps<SVGSVGElement> & { size?: number | string }
export type GmIcon = ReturnType<typeof make>

function make(displayName: string, body: React.ReactNode) {
  const Icon = forwardRef<SVGSVGElement, GmIconProps>(function Icon({ size = 24, strokeWidth = 1.6, ...props }, ref) {
    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden={props["aria-label"] ? undefined : true}
        {...props}
      >
        {body}
      </svg>
    )
  })
  Icon.displayName = displayName
  return Icon
}

/** Dashboard: campana de servicio (cloche) sobre su base. */
export const GmDashboard = make(
  "GmDashboard",
  <>
    <path d="M4 16a8 8 0 0 1 16 0" />
    <path d="M2.5 16h19" />
    <path d="M5.5 19h13" />
    <circle cx="12" cy="6.6" r="1.1" />
  </>,
)

/** Ficha Técnica: gorro de chef con banda de medida. */
export const GmTechSheet = make(
  "GmTechSheet",
  <>
    <path d="M7 13a3.2 3.2 0 0 1-.8-6.2A4 4 0 0 1 12 4a4 4 0 0 1 5.8 2.8A3.2 3.2 0 0 1 17 13" />
    <path d="M7 13h10v6a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1z" />
    <path d="M9.5 20v-2M12 20v-3M14.5 20v-2" />
  </>,
)

/** Mis Recetas: libro de recetas abierto con su cinta. */
export const GmRecipes = make(
  "GmRecipes",
  <>
    <path d="M12 6.5C10.3 5.2 7.8 4.6 4 4.8v13.4c3.8-.2 6.3.4 8 1.7" />
    <path d="M12 6.5c1.7-1.3 4.2-1.9 8-1.7v13.4c-3.8-.2-6.3.4-8 1.7" />
    <path d="M12 6.5v13.4" />
    <path d="M15.5 5.2v4.6l1.25-.9 1.25.9V5" />
  </>,
)

/** Ingredientes: frasco con tapa y una hoja. */
export const GmIngredients = make(
  "GmIngredients",
  <>
    <path d="M8.5 3.5h7a.5.5 0 0 1 .5.5v2H8V4a.5.5 0 0 1 .5-.5z" />
    <path d="M7.5 6h9A1.5 1.5 0 0 1 18 7.5v11a2.5 2.5 0 0 1-2.5 2.5h-7A2.5 2.5 0 0 1 6 18.5v-11A1.5 1.5 0 0 1 7.5 6z" />
    <path d="M10 16.5c0-2.8 1.8-4.5 4.5-4.5 0 2.8-1.8 4.5-4.5 4.5z" />
    <path d="M10 16.5l2.4-2.4" />
  </>,
)

/** Inventario: estante con envases de distinto tamaño. */
export const GmInventory = make(
  "GmInventory",
  <>
    <path d="M3 11h18M3 20.5h18" />
    <rect x="5.5" y="6" width="4" height="5" rx=".6" />
    <rect x="12" y="7.5" width="5.5" height="3.5" rx=".6" />
    <rect x="5" y="15" width="3.5" height="5.5" rx=".6" />
    <path d="M11 20.5v-5.2a1.5 1.5 0 0 1 3 0v5.2" />
    <rect x="16" y="16" width="3" height="4.5" rx=".6" />
  </>,
)

/** Equipo: dos personas, una con gorro de chef. */
export const GmTeam = make(
  "GmTeam",
  <>
    <path d="M7 7.2a1.6 1.6 0 0 1 1.1-2.6 1.8 1.8 0 0 1 3.4 0A1.6 1.6 0 0 1 12.4 7.2z" />
    <circle cx="9.7" cy="9.8" r="2.4" />
    <path d="M4.7 19.5a5 5 0 0 1 10 0" />
    <circle cx="16.6" cy="10.6" r="2" />
    <path d="M15.3 15.1a4.2 4.2 0 0 1 4.9 4.4" />
  </>,
)

/** Menús: carta plegada en tres. */
export const GmMenus = make(
  "GmMenus",
  <>
    <path d="M3.5 5l5.5 1.5 6-1.5 5.5 1.5V20l-5.5-1.5-6 1.5L3.5 18.5z" />
    <path d="M9 6.5V20M15 5v13.5" />
    <path d="M11 10.5h2M11 13.5h2" />
  </>,
)

/** MEP: tabla de picar con tres bowls listos. */
export const GmMep = make(
  "GmMep",
  <>
    <path d="M3.5 14.5h17a1 1 0 0 1 1 1v2.5a2.5 2.5 0 0 1-2.5 2.5H5a2.5 2.5 0 0 1-2.5-2.5v-2.5a1 1 0 0 1 1-1z" />
    <circle cx="18.5" cy="17.5" r=".6" />
    <path d="M4 9h4a2 2 0 0 1-4 0zM10 9h4a2 2 0 0 1-4 0zM16 9h4a2 2 0 0 1-4 0z" />
  </>,
)

/** Órdenes de compra: canasta de mercado. */
export const GmPurchase = make(
  "GmPurchase",
  <>
    <path d="M3.5 10h17l-1.6 8.4a2 2 0 0 1-2 1.6H7.1a2 2 0 0 1-2-1.6z" />
    <path d="M8 10l2.6-5.5M16 10l-2.6-5.5" />
    <path d="M9.5 13.5v3.5M12 13.5v3.5M14.5 13.5v3.5" />
  </>,
)

/** POS: mesa vista desde arriba, con su plato y cuatro sillas. */
export const GmPos = make(
  "GmPos",
  <>
    <circle cx="12" cy="12" r="4.6" />
    <circle cx="12" cy="12" r="1.5" />
    <rect x="10" y="2.8" width="4" height="2.4" rx="1" />
    <rect x="10" y="18.8" width="4" height="2.4" rx="1" />
    <rect x="2.8" y="10" width="2.4" height="4" rx="1" />
    <rect x="18.8" y="10" width="2.4" height="4" rx="1" />
  </>,
)

/** Ventas: ticket de caja con el borde cortado. */
export const GmSales = make(
  "GmSales",
  <>
    <path d="M6 3h12v18l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3L6 21z" />
    <path d="M9 7.5h6M9 11h6M9 14.5h3.5" />
  </>,
)

/** Reportes: plato visto desde arriba con una porción servida (gráfico de torta). */
export const GmReports = make(
  "GmReports",
  <>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="5.6" />
    <path d="M12 12V6.4a5.6 5.6 0 0 1 5.6 5.6z" />
  </>,
)

/** Negocios: local con toldo. */
export const GmBusinesses = make(
  "GmBusinesses",
  <>
    <path d="M3.5 9.5L5 4.5h14l1.5 5" />
    <path d="M3.5 9.5a2.13 2.13 0 0 0 4.25 0 2.13 2.13 0 0 0 4.25 0 2.13 2.13 0 0 0 4.25 0 2.13 2.13 0 0 0 4.25 0" />
    <path d="M5 11.8V20h14v-8.2" />
    <path d="M10 20v-4.5h4V20" />
  </>,
)

/** Invita: sobre con su sello. */
export const GmInvite = make(
  "GmInvite",
  <>
    <rect x="3.5" y="6" width="17" height="12" rx="1.5" />
    <path d="M3.8 6.6L12 12.5l8.2-5.9" />
    <circle cx="12" cy="13.6" r="1.4" />
  </>,
)

/** Íconos de cada módulo, por ruta: una sola fuente para menú, Dashboard y encabezados. */
export const MODULE_ICONS = {
  "/dashboard": GmDashboard,
  "/ficha-tecnica": GmTechSheet,
  "/mis-recetas": GmRecipes,
  "/ingredientes": GmIngredients,
  "/inventario": GmInventory,
  "/equipo": GmTeam,
  "/menus": GmMenus,
  "/mep": GmMep,
  "/menu-y-compras": GmPurchase,
  "/salon": GmPos,
  "/ventas": GmSales,
  "/estadisticas": GmReports,
  "/negocios": GmBusinesses,
  "/mi-plan#invita": GmInvite,
} as const
