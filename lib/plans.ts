// Catalogo de planes y matriz de funciones por plan. Fuente unica de verdad para
// /planes, el flujo de pago simulado, y el bloqueo real de funciones en la app
// (lib/plan-access.ts). Ver docs para el detalle de la conversacion que definio
// esta tabla — no cambiar los limites/features sin confirmar con el dueno del
// proyecto, es una decision de negocio, no un detalle tecnico.

export type FeatureKey =
  | "merma"
  | "pdf_admin"
  | "purchase_orders_manual"
  | "purchase_orders_auto"
  | "inventory"
  | "menus"
  | "stats_panorama"
  | "stats_finance"
  | "team"
  // "recipes"/"ingredients" no son parte de la matriz de planes de arriba — Ficha
  // Técnica/Mis Recetas/Ingredientes están disponibles en TODOS los planes, incluido
  // Foodie gratis (ver DEFAULT_ALWAYS_ON_FEATURES en lib/plan-access.ts). Existen como
  // FeatureKey únicamente para poder restringirlas por persona en el panel de Equipo
  // (ver /equipo) — no aparecen en ningún Plan.unlockedFeatures.
  | "recipes"
  | "ingredients"
  // Igual que "recipes"/"ingredients": no es parte de la matriz de planes (exportar
  // PDF de receta en nivel empleado/normal, sin costos, es una función incluida
  // incluso en Foodie gratis — ver Plan.features de "foodie"). Existe como FeatureKey
  // únicamente para que la vista previa de Equipo pueda bloquear TODA exportación de
  // PDF para un miembro con pdfAccess "ninguno" (antes solo se bloqueaba el nivel
  // administrativo — alguien con "ninguno" podía igual exportar PDF de empleado/normal
  // sin ningún control, ver docs/referencia-sistema-de-importaciones.md sección 3.9).
  | "pdf_export"

export interface Plan {
  slug: string
  name: string
  price: string
  priceUsdCents: number
  tagline: string
  description: string
  features: string[]
  locked: string[]
  maxBusinesses: number
  maxUsers: number
  unlockedFeatures: FeatureKey[]
  comingSoon?: boolean
  highlighted?: boolean
}

export const plans: Plan[] = [
  {
    slug: "foodie",
    name: "Foodie",
    price: "Gratis",
    priceUsdCents: 0,
    tagline: "Para empezar a organizar tus recetas",
    description: "Base de datos, fichas técnicas ilimitadas, exportación de receta en PDF de cocina.",
    features: [
      "Base de datos de ingredientes",
      "Fichas técnicas ilimitadas",
      "Importación desde Excel",
      "Exportar PDF de cocina (ingredientes y procedimiento, sin costos)",
    ],
    locked: [
      "Sistema de merma",
      "PDF administrativo (con costos y rentabilidad)",
      "Órdenes de compra",
      "Inventario",
      "Menús",
      "Estadísticas y Finanzas",
    ],
    maxBusinesses: 1,
    maxUsers: 1,
    unlockedFeatures: [],
  },
  {
    slug: "home-cook",
    name: "Home Cook",
    price: "$15/mes",
    priceUsdCents: 1500,
    tagline: "Para quien ya calcula costos en serio",
    description: "Todo lo de Foodie, más sistema de merma, órdenes de compra manuales y PDF administrativo.",
    features: [
      "Todo lo del plan Foodie",
      "Sistema de merma",
      "Órdenes de compra manuales",
      "PDF administrativo (con costos y rentabilidad)",
    ],
    locked: ["Inventario y auto-sugerencia de órdenes", "Menús", "Estadísticas y Finanzas avanzadas", "Multi-negocio"],
    maxBusinesses: 1,
    maxUsers: 1,
    unlockedFeatures: ["merma", "purchase_orders_manual", "pdf_admin"],
  },
  {
    slug: "chef-de-partie",
    name: "Chef de Partie",
    price: "$35/mes",
    priceUsdCents: 3500,
    tagline: "Para operar una cocina completa",
    description: "Todo lo anterior, más inventario completo, órdenes automáticas, menús y estadísticas de uso.",
    features: [
      "Todo lo del plan Home Cook",
      "Inventario completo (stock y alertas)",
      "Órdenes de compra automáticas (desde menús y stock bajo)",
      "Menús completos (con escalado por PAX)",
      "1 negocio",
      "Estadísticas de uso (panorama del negocio)",
    ],
    locked: ["Finanzas completas (P&L, importación de POS, Menu Engineering)", "Multi-negocio", "Usuarios extra"],
    maxBusinesses: 1,
    maxUsers: 1,
    unlockedFeatures: ["merma", "purchase_orders_manual", "purchase_orders_auto", "pdf_admin", "inventory", "menus", "stats_panorama"],
  },
  {
    slug: "sous-chef",
    name: "Sous Chef",
    price: "$70/mes",
    priceUsdCents: 7000,
    tagline: "El control total de tu negocio",
    description:
      "Todo lo anterior, más finanzas completas: P&L real, importación de ventas del POS, Menu Engineering y varianza de precios de proveedores.",
    features: [
      "Todo lo del plan Chef de Partie",
      "Finanzas completas: P&L, importación de ventas del POS",
      "Menu Engineering (Estrellas, Vacas, Puzzles, Perros)",
      "Varianza de precios de proveedores",
      "Dashboard financiero histórico",
      "Hasta 2 negocios sincronizados",
      "Hasta 2 usuarios en la misma cuenta",
    ],
    locked: ["Multi-negocio masivo (+5)", "Soporte prioritario", "Usuarios ilimitados"],
    maxBusinesses: 2,
    maxUsers: 2,
    unlockedFeatures: ["merma", "purchase_orders_manual", "purchase_orders_auto", "pdf_admin", "inventory", "menus", "stats_panorama", "stats_finance"],
    highlighted: true,
  },
  {
    slug: "chef-ejecutivo",
    name: "Chef Ejecutivo",
    price: "$120/mes",
    priceUsdCents: 12000,
    tagline: "Para grupos y cadenas",
    description: "Todo lo anterior, más hasta 5 negocios, 5 usuarios, soporte prioritario y onboarding personalizado.",
    features: [
      "Todo lo del plan Sous Chef",
      "Hasta 5 negocios sincronizados",
      "Hasta 5 usuarios",
      "Soporte prioritario",
      "Onboarding personalizado",
      "Importación de datos asistida",
    ],
    locked: [],
    maxBusinesses: 5,
    maxUsers: 5,
    unlockedFeatures: ["merma", "purchase_orders_manual", "purchase_orders_auto", "pdf_admin", "inventory", "menus", "stats_panorama", "stats_finance", "team"],
    comingSoon: true,
  },
]

export function getPlanBySlug(slug: string | null | undefined): Plan {
  return plans.find((plan) => plan.slug === slug) ?? plans[0]
}
