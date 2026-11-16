/**
 * Íconos propios de alérgenos y tipo de plato (pedido del dueño, docs/324: «crea iconos
 * únicos»). Mismo estilo que components/icons/gm-icons.tsx (docs/307): retícula 24 × 24, trazo
 * 1.6, puntas redondeadas y sin relleno. Se guardan como trazados para usarlos igual en la
 * pantalla (components/icons/diet-icon.tsx) y en los PDF (`dietIconPng`), que los dibuja en un
 * canvas con el color del negocio.
 */

import type { AllergenKey } from "@/lib/allergens"
import type { Protein } from "@/lib/diet"

export type DietIconKey = AllergenKey | Protein | "vegan" | "vegetarian" | "gluten_free" | "allergen_free" | "may_contain"

const WHEAT =
  "M12 21V7M12 9c-2-1-3-3-3-5 2 1 3 3 3 5zM12 9c2-1 3-3 3-5-2 1-3 3-3 5zM12 14c-2-1-3-3-3-5 2 1 3 3 3 5zM12 14c2-1 3-3 3-5-2 1-3 3-3 5zM12 19c-2-1-3-3-3-5 2 1 3 3 3 5zM12 19c2-1 3-3 3-5-2 1-3 3-3 5z"
const FISH =
  "M3 12c3-4 8-5 12-3l4-3v12l-4-3c-4 2-9 1-12-3zM8 11h.01"

export const DIET_ICON_PATHS: Record<DietIconKey, string> = {
  // Alérgenos
  gluten: WHEAT,
  crustaceans: "M6 14a6 4 0 1 0 12 0 6 4 0 1 0-12 0M6 11c-2-1-2.5-3-1-5 .5 1.5 1.5 2 2.5 2M18 11c2-1 2.5-3 1-5-.5 1.5-1.5 2-2.5 2M6 17l-2.5 1.5M18 17l2.5 1.5M8 18.5l-1 2.5M16 18.5l1 2.5M10 10.5V9M14 10.5V9",
  eggs: "M12 3c3.5 0 6.5 5.5 6.5 10a6.5 6.5 0 0 1-13 0C5.5 8.5 8.5 3 12 3z",
  fish: FISH,
  peanuts: "M12 3a4 4 0 0 0-3 6.6 4.2 4.2 0 1 0 6 0A4 4 0 0 0 12 3zM10.5 6h.01M13.5 6h.01M11 15h.01M13.5 16.5h.01",
  soy: "M4 16c1.5-5.5 6-10 11.5-11 2.8-.5 4.6 1.2 4.4 3.4-1 5.6-5.8 10.1-11.4 11.1-2.8.5-4.8-1-4.5-3.5zM8.4 15.2a1.6 1.6 0 1 0 0 .01M12 12a1.6 1.6 0 1 0 0 .01M15.6 8.8a1.6 1.6 0 1 0 0 .01",
  milk: "M8 3h8v3l2 3v12H6V9l2-3zM8 6h8M6 13h12",
  tree_nuts: "M5 10c0-3 3-5 7-5s7 2 7 5H5zM7 10c0 5 2 9 5 10 3-1 5-5 5-10M12 5V3",
  celery: "M8 21c0-6-1-11-3-14M12 21V5M16 21c0-6 1-11 3-14M9 7c1-2 2-3 3-3s2 1 3 3",
  mustard: "M10 3h4v3h-4zM9 6h6l1 3v11a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V9zM8.5 13h7",
  sesame: "M8 4c1.6 1 2.2 2.8 1.6 4.4S7 10.5 6 10s-1.2-2.6-.2-4.2S7 4 8 4zM16 8c1.6 1 2.2 2.8 1.6 4.4S15 14.5 14 14s-1.2-2.6-.2-4.2S15 8 16 8zM9 14c1.6 1 2.2 2.8 1.6 4.4S8 20.5 7 20s-1.2-2.6-.2-4.2S8 14 9 14z",
  sulphites: "M8 3h8c0 5-1.5 8-4 8s-4-3-4-8zM12 11v8M8 21h8M8.5 6.5h7",
  lupin: "M12 21V10M11 5a1 1 0 1 0 2 0 1 1 0 1 0-2 0M9 8.5a1 1 0 1 0 2 0 1 1 0 1 0-2 0M13 8.5a1 1 0 1 0 2 0 1 1 0 1 0-2 0M9 12a1 1 0 1 0 2 0 1 1 0 1 0-2 0M13 12a1 1 0 1 0 2 0 1 1 0 1 0-2 0M8 21c1-3 2.5-4.5 4-5M16 21c-1-3-2.5-4.5-4-5",
  molluscs: "M4 13c0-5 3.5-8 8-8s8 3 8 8l-8 7zM12 5v15M8 6.5l4 13.5M16 6.5l-4 13.5",
  // Proteínas
  beef: "M7 8C5 8 4 7 3 5c2 0 3 .5 4 1.5M17 8c2 0 3-1 4-3-2 0-3 .5-4 1.5M7 6.5h10V13a5 5 0 0 1-10 0zM9.5 16h5M10.5 18h.01M13.5 18h.01M9.5 10h.01M14.5 10h.01",
  pork: "M12 5.5c3.9 0 7 2.7 7 6s-3.1 6-7 6-7-2.7-7-6 3.1-6 7-6zM9.5 12.5c0-1.1 1.1-2 2.5-2s2.5.9 2.5 2-1.1 2-2.5 2-2.5-.9-2.5-2zM11 12.5h.01M13 12.5h.01M6.5 7.5 5.5 4.5l3 1.8M17.5 7.5l1-3-3 1.8",
  poultry: "M14.5 3.5a5.5 5.5 0 0 1 0 11c-.8 0-1.6-.2-2.3-.5L9 17.2l.8 1.8-1.8 1-1-1.8-1.8.8-1-1.8L6 16l-.5-1.8 3.3-3.3a5.5 5.5 0 0 1 5.7-7.4z",
  seafood: "M17 5c-4 0-9 3-9 9 0 3 2 5 5 5h2M17 5c2 0 3 1 3 2.5S19 10 17 10c-3 0-5 2-5 5M17 5l3-2M10.5 10l-2-1M9 13.5H7",
  game: "M10 14h4l-.8 6h-2.4zM10 14C8.2 12.2 7 9.4 7 4.5M7 9.2 4.4 7.4M7 6.6 5.2 4.2M14 14c1.8-1.8 3-4.6 3-9.5M17 9.2l2.6-1.8M17 6.6l1.8-2.4",
  cured: "M5 15c0-4 3-8 8-9 3-.5 5 1 5 3s-1.5 3-4 3.5C11 13 9 16 9 18c0 2.5-4 1.5-4-3zM18 9l2.5-1M8.5 12.5h.01M11.5 9.5h.01",
  // Tipo de plato
  vegan: "M5 19c0-9 6-14 14-14 0 9-6 14-14 14zM5 19l9-9M9 9.5l1.5 3 3-6",
  vegetarian: "M12 21v-9M12 12c0-4-3-6-7-6 0 4 3 6 7 6zM12 12c0-3 2.5-5 6-5 0 3.5-2.5 5-6 5z",
  gluten_free: `${WHEAT}M4 4l16 16`,
  allergen_free: "M12 3l7 3v5c0 5-3 8.5-7 10-4-1.5-7-5-7-10V6zM9 12l2 2 4-4",
  may_contain: "M12 4l9 16H3zM12 10v4M12 17h.01",
}

/** Trazado del ícono (el pescado como proteína y como alérgeno es el mismo pez). */
export function iconPath(key: DietIconKey): string {
  return DIET_ICON_PATHS[key] ?? DIET_ICON_PATHS.may_contain
}

/** SVG completo, con el color dado (para la pantalla o para dibujarlo en un PDF). */
export function dietIconSvg(key: DietIconKey, color = "currentColor", size = 24): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="${iconPath(key)}"/></svg>`
}

/**
 * PNG del ícono para jsPDF (solo en el navegador). Se dibuja a 96 px para que se vea nítido al
 * imprimir. Devuelve un data URL; si algo falla, null (el PDF sale con texto).
 */
export async function dietIconPng(key: DietIconKey, rgb: [number, number, number]): Promise<string | null> {
  if (typeof document === "undefined") return null
  try {
    const color = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`
    const img = new Image()
    const src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(dietIconSvg(key, color, 96))}`
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error("icon"))
      img.src = src
    })
    const canvas = document.createElement("canvas")
    canvas.width = 96
    canvas.height = 96
    const ctx = canvas.getContext("2d")
    if (!ctx) return null
    ctx.drawImage(img, 0, 0, 96, 96)
    return canvas.toDataURL("image/png")
  } catch {
    return null
  }
}

/** Todos los PNG que hacen falta para un PDF, de una vez. */
export async function dietIconPngs(keys: Iterable<DietIconKey>, rgb: [number, number, number]): Promise<Partial<Record<DietIconKey, string>>> {
  const out: Partial<Record<DietIconKey, string>> = {}
  await Promise.all(
    [...new Set(keys)].map(async (k) => {
      const png = await dietIconPng(k, rgb)
      if (png) out[k] = png
    }),
  )
  return out
}
