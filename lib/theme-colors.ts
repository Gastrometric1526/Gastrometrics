// Fuente única de verdad para la paleta de marca curada (ver docs/36). Conecta el slug
// de tema guardado en localStorage (theme-switcher.tsx) con su HSL real y con el PNG del
// logo que le corresponde — usado tanto por el selector de temas como por
// components/gastrometrics-logo.tsx.

export interface CuratedTheme {
  slug: string
  label: string
  /** Triplete hsl() sin la función, listo para --primary. */
  primary: string
  primaryForeground: string
  /** Nombre de archivo dentro de /public/brand/. */
  logo: string
}

export const CURATED_THEMES: CuratedTheme[] = [
  { slug: "naranja-brasa", label: "Naranja Brasa", primary: "14 87% 54%", primaryForeground: "60 9.1% 97.8%", logo: "gm-naranja-brasa.png" },
  { slug: "carbon", label: "Carbón", primary: "240 4% 16%", primaryForeground: "0 0% 98%", logo: "gm-carbon.png" },
  { slug: "azul-acero", label: "Azul Acero", primary: "221.2 83.2% 53.3%", primaryForeground: "210 40% 98%", logo: "gm-azul-acero.png" },
  { slug: "verde-albahaca", label: "Verde Albahaca", primary: "142 72% 29%", primaryForeground: "355.7 100% 97.3%", logo: "gm-verde-albahaca.png" },
  { slug: "vino-borgona", label: "Vino Borgoña", primary: "345 100% 25%", primaryForeground: "355.7 100% 97.3%", logo: "gm-vino-borgona.png" },
  { slug: "teal-especia", label: "Teal Especia", primary: "175 84% 32%", primaryForeground: "355.7 100% 97.3%", logo: "gm-teal-especia.png" },
  { slug: "ambar-miel", label: "Ámbar Miel", primary: "32 95% 44%", primaryForeground: "60 9.1% 97.8%", logo: "gm-ambar-miel.png" },
  // Agregados a pedido del dueño del proyecto, fuera del set original de docs/36 —
  // aclarados/oscurecidos lo suficiente para que el texto blanco de --primary-foreground
  // siga siendo legible encima (mismo criterio que ya se usó para Ámbar Miel).
  { slug: "morado", label: "Morado", primary: "271 65% 48%", primaryForeground: "270 60% 97%", logo: "gm-morado.png" },
  { slug: "lavanda", label: "Lavanda", primary: "258 55% 58%", primaryForeground: "258 60% 97%", logo: "gm-lavanda.png" },
  { slug: "rosa", label: "Rosa", primary: "340 75% 48%", primaryForeground: "340 60% 97%", logo: "gm-rosa.png" },
  { slug: "amarillo", label: "Amarillo", primary: "45 90% 38%", primaryForeground: "45 60% 97%", logo: "gm-amarillo.png" },
  // Pastel de verdad (claro, no solo "menos saturado") — con un fondo tan claro, texto
  // blanco no se lee; usa texto oscuro en vez del blanco que usan los demás.
  { slug: "rosa-pastel", label: "Rosa Pastel", primary: "340 70% 82%", primaryForeground: "340 45% 20%", logo: "gm-rosa-pastel.png" },
]

export const DEFAULT_THEME_SLUG = "naranja-brasa"

// Temas retirados en docs/36 (de 22 a 7): ya no aparecen en el selector, pero una cuenta
// que los tenía guardados en localStorage antes de esta migración no debe quedarse sin
// --primary — sus bloques [data-theme] en globals.css se mantienen, repuntados al valor
// del equivalente de aquí abajo (o a Naranja Brasa si no tenían uno explícito).
const LEGACY_THEME_MAP: Record<string, string> = {
  default: "naranja-brasa",
  orange: "naranja-brasa",
  red: "naranja-brasa",
  lime: "naranja-brasa",
  indigo: "naranja-brasa",
  zinc: "carbon",
  neutral: "carbon",
  gray: "carbon",
  slate: "carbon",
  stone: "carbon",
  blue: "azul-acero",
  green: "verde-albahaca",
  emerald: "verde-albahaca",
  teal: "teal-especia",
  sky: "teal-especia",
  cyan: "teal-especia",
  amber: "ambar-miel",
  // Equivalentes directos con los colores agregados luego, a pedido del dueño (ver arriba).
  violet: "lavanda",
  purple: "morado",
  rose: "rosa",
  pink: "rosa",
  fuchsia: "rosa",
  yellow: "amarillo",
}

export function resolveThemeSlug(stored: string | null | undefined): string {
  if (!stored) return DEFAULT_THEME_SLUG
  if (CURATED_THEMES.some((t) => t.slug === stored)) return stored
  return LEGACY_THEME_MAP[stored] || DEFAULT_THEME_SLUG
}

export function getThemeLogoSrc(stored: string | null | undefined): string {
  const slug = resolveThemeSlug(stored)
  const theme = CURATED_THEMES.find((t) => t.slug === slug) || CURATED_THEMES[0]
  return `/brand/${theme.logo}`
}

function hslStringToRgb(hslTriplet: string): [number, number, number] {
  const [h, sPct, lPct] = hslTriplet.split(" ").map((v) => Number.parseFloat(v))
  const s = sPct / 100
  const l = lPct / 100
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  let r = 0
  let g = 0
  let b = 0
  if (h < 60) [r, g, b] = [c, x, 0]
  else if (h < 120) [r, g, b] = [x, c, 0]
  else if (h < 180) [r, g, b] = [0, c, x]
  else if (h < 240) [r, g, b] = [0, x, c]
  else if (h < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)]
}

function getBusinessThemeSlug(businessId?: string | null): string {
  if (typeof window === "undefined") return DEFAULT_THEME_SLUG
  const themeKey = businessId ? `business_${businessId}_color_theme` : "main_color_theme"
  return resolveThemeSlug(localStorage.getItem(themeKey))
}

/**
 * Color de acento del tema activo del negocio, en RGB — para los generadores de PDF
 * (lib/pdf/*.ts), que dibujan con jsPDF y no pueden leer variables CSS. Lee la misma
 * clave de localStorage que ThemeSwitcher (ver docs/36, sección 5: "el color de acento
 * del PDF sale del tema del negocio, no de una constante").
 */
export function getBusinessThemeRgb(businessId?: string | null): [number, number, number] {
  const theme = CURATED_THEMES.find((t) => t.slug === getBusinessThemeSlug(businessId)) || CURATED_THEMES[0]
  return hslStringToRgb(theme.primary)
}

/**
 * Mismo color, aclarado hacia blanco — para fondos de resaltado sutiles en el PDF
 * (ej. la fila de un total, una franja de cifra clave) que necesitan quedar pálidos sin
 * importar qué tan oscuro sea el tema elegido.
 */
export function getBusinessThemeTintRgb(businessId?: string | null, towardWhite = 0.85): [number, number, number] {
  const [r, g, b] = getBusinessThemeRgb(businessId)
  return [
    Math.round(r + (255 - r) * towardWhite),
    Math.round(g + (255 - g) * towardWhite),
    Math.round(b + (255 - b) * towardWhite),
  ]
}

/**
 * Aplica el tema al `<html>` y fuerza un repintado completo. Sin el repintado forzado,
 * cualquier elemento ya pintado que use `transition-colors` (todos los Button de shadcn)
 * se queda congelado con el color del tema ANTERIOR hasta la próxima recarga completa de
 * página — un elemento recién creado sí toma el color nuevo (confirmado con
 * `document.createElement`), pero uno que ya existía en el DOM al momento del cambio de
 * `--primary` no se repinta solo, aunque `getComputedStyle` confirme que la variable CSS
 * en sí ya cambió correctamente en todo el árbol. Es una particularidad real del
 * navegador con transiciones de CSS sobre valores derivados de custom properties, no un
 * bug de React/Radix — reproducido con un <button> aislado, sin ningún componente de la
 * app de por medio. El truco de forzar reflow (display:none → reflow → restaurar) es el
 * mismo que ya usa el resto del ecosistema web para este caso.
 */
export function applyThemeAttribute(themeSlug: string): void {
  document.documentElement.setAttribute("data-theme", themeSlug)
  // BUG EVITADO: esto se llama tanto al montar ThemeSwitcher (carga inicial, con el
  // tema ya guardado en localStorage) como al hacer clic en una tarjeta — un logo que
  // ya estaba montado (ej. el del sidebar) solo se entera del cambio si escucha este
  // evento; sin dispararlo aquí también en la carga inicial, cualquier usuario que ya
  // hubiera elegido un tema no-default veía el logo en naranja hasta interactuar con el
  // selector, aunque el color de --primary en toda la app ya fuera el correcto.
  window.dispatchEvent(new CustomEvent("gm:theme-changed", { detail: themeSlug }))
  if (!document.body) return
  const previousDisplay = document.body.style.display
  document.body.style.display = "none"
  void document.body.offsetHeight
  document.body.style.display = previousDisplay
}

// #F05423 — mismo naranja exacto que rellena los PNG de marca (ver docs/36). Para
// documentos/superficies "fuera de la sesión" (PDF de cara al cliente, landing, íconos
// de sistema) que deben quedar siempre en la marca, sin importar el tema del negocio.
export const BRAND_ORANGE_RGB: [number, number, number] = [240, 84, 35]

export const BRAND_LOGO_SRC = "/brand/gm-naranja-brasa.png"
export const BRAND_LOGO_MONO_WHITE_SRC = "/brand/gm-mono-blanco.png"
export const BRAND_LOGO_MONO_BLACK_SRC = "/brand/gm-mono-negro.png"
