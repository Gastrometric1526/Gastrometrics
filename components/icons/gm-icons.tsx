/**
 * Íconos propios de GastroMetrics (docs/307). Pedido del dueño: «iconos únicos y no genéricos,
 * siempre con el mismo estilo minimalista; no quiero iconos de stock».
 *
 * Estilo (no cambiarlo al agregar uno nuevo):
 * - retícula de 24 × 24, trazo 1.6, puntas y uniones redondeadas, sin relleno;
 * - color del tema por `currentColor` (se pinta con las clases text-* de siempre);
 * - se entiende SIN leer la etiqueta (docs/308): el objeto que un chef asocia con ese lugar
 *   (casa = inicio, zanahoria = ingredientes, caja registradora = POS, barras = reportes).
 *   Si hay que leer para saber qué es, se redibuja.
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

/** Dashboard: casa (inicio). */
export const GmDashboard = make(
  "GmDashboard",
  <>
    <path d="M3.5 11L12 4l8.5 7" />
    <path d="M5.5 9.5V19a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V9.5" />
    <path d="M10 20v-5h4v5" />
  </>,
)

/** Ficha Técnica: gorro de chef (crear recetas). */
export const GmTechSheet = make(
  "GmTechSheet",
  <>
    <path d="M7 14v-2.8A3 3 0 0 1 8.2 5.6a3.8 3.8 0 0 1 7.6 0A3 3 0 0 1 17 11.2V14" />
    <path d="M7 14h10v5a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1z" />
    <path d="M7 17h10" />
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

/** Ingredientes: zanahoria. */
export const GmIngredients = make(
  "GmIngredients",
  <>
    <path d="M15.8 8.2a3 3 0 0 0-4.3 0L4.3 18.6a.8.8 0 0 0 1.1 1.1l10.4-7.2a3 3 0 0 0 0-4.3z" />
    <path d="M15.6 8.4L19.5 4.5M16.4 9.5l3.8-1.2M14.5 7.6l1.2-3.8" />
    <path d="M9.6 12.4l1.3 1.3M7.4 15.2l1 1" />
  </>,
)

/** Inventario: cajas apiladas (stock). */
export const GmInventory = make(
  "GmInventory",
  <>
    <rect x="3.5" y="12.5" width="8" height="7.5" rx=".8" />
    <rect x="12.5" y="12.5" width="8" height="7.5" rx=".8" />
    <rect x="8" y="5" width="8" height="7.5" rx=".8" />
    <path d="M7.5 12.5v2M16.5 12.5v2M12 5v2" />
  </>,
)

/** Equipo: dos personas. */
export const GmTeam = make(
  "GmTeam",
  <>
    <circle cx="9" cy="8" r="3" />
    <path d="M3.5 19.5a5.5 5.5 0 0 1 11 0" />
    <circle cx="16.8" cy="9.2" r="2.3" />
    <path d="M15.6 14a4.5 4.5 0 0 1 5.4 5" />
  </>,
)

/** Menús: carta con tenedor y cuchillo. */
export const GmMenus = make(
  "GmMenus",
  <>
    <rect x="5" y="3" width="14" height="18" rx="1.5" />
    <path d="M9 7v2.6M10.2 7v2.6M11.4 7v2.6" />
    <path d="M9 9.6a1.2 1.2 0 0 0 2.4 0M10.2 10.8V17" />
    <path d="M14.8 17V7c-1 .7-1.6 2-1.6 3.6 0 .8.5 1.4 1.6 1.4" />
  </>,
)

/** MEP: cuchillo de chef (preparar). */
export const GmMep = make(
  "GmMep",
  <>
    <path d="M3 20.5L13 10.5l3.5 3.5C13 18.5 8.5 20.5 3 20.5z" />
    <path d="M14 9.5l4.3-4.3a1.5 1.5 0 0 1 2.1 2.1L16.1 11.6" />
    <path d="M17.3 7.4h.01M18.9 5.8h.01" />
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

/** POS: caja registradora (cobrar). */
export const GmPos = make(
  "GmPos",
  <>
    <rect x="13" y="3" width="6" height="4" rx=".8" />
    <path d="M16 7v3" />
    <path d="M4.5 10h15l1.3 6.5H3.2z" />
    <rect x="3" y="16.5" width="18" height="4" rx="1" />
    <path d="M10.5 18.5h3M7.5 13h1M11.5 13h1M15.5 13h1" />
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

/** Reportes: gráfico de barras. */
export const GmReports = make(
  "GmReports",
  <>
    <path d="M3 20h18" />
    <rect x="5.5" y="13" width="3" height="7" rx=".8" />
    <rect x="10.5" y="7.5" width="3" height="12.5" rx=".8" />
    <rect x="15.5" y="10.5" width="3" height="9.5" rx=".8" />
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

/** Invita (regala un mes): regalo. */
export const GmInvite = make(
  "GmInvite",
  <>
    <rect x="4" y="11" width="16" height="9" rx="1" />
    <rect x="3" y="7.5" width="18" height="3.5" rx="1" />
    <path d="M12 7.5V20" />
    <path d="M12 7.5c-1.5-3.5-5-3.5-5-1.2 0 1.2 2.6 1.2 5 1.2zM12 7.5c1.5-3.5 5-3.5 5-1.2 0 1.2-2.6 1.2-5 1.2z" />
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
