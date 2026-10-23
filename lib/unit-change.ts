/**
 * Cambiar la unidad de un ingrediente sin cambiar ningún costo (docs/187).
 *
 * Una línea de receta, el inventario y su historial guardan cantidades EN LA UNIDAD DEL
 * INGREDIENTE, y el costo se calcula como cantidad × precio por unidad
 * (lib/recalculate.ts) sin convertir unidades. Por eso, al pasar un ingrediente de
 * kilogramos a gramos (o de métrico a imperial) hay que convertir todo junto:
 *   - ingrediente: contenido neto × f, contenido original × f, precio por unidad ÷ f,
 *     merma por cantidad × f;
 *   - líneas de receta que lo usan: cantidad × f, costo por unidad ÷ f (el total de la
 *     línea no cambia);
 *   - inventario (mismo id que el ingrediente): stock, mínimo, recepciones y contenido × f;
 *   - historial de inventario: cantidades de ese producto × f.
 * donde f = cuántas unidades nuevas hay en una unidad vieja (1 kg → 1000 g: f = 1000).
 *
 * BUG CORREGIDO: el interruptor métrico/imperial de Ingredientes guardaba solo la unidad
 * nueva (1 kg a L100 quedaba como «1 gramo a L100 el gramo»: las recetas costaban 1000
 * veces más), y el selector de unidad de cada fila convertía el ingrediente pero no las
 * recetas (una línea de 0.2 kg pasaba a leerse como 0.2 g).
 */

import type { Ingredient } from "@/types/ingredient"
import type { Recipe } from "@/types/recipe"
import type { InventoryItem, InventorySnapshot } from "@/types/inventory"
import { convertBetweenUnits } from "@/lib/utils/calculations"

const KNOWN = ["gramos", "kilogramos", "onzas", "libras", "mililitros", "litros", "onzas líquidas", "onzas fluidas", "galones"]

/** Unidades nuevas que caben en una unidad vieja, o null si no se puede convertir (p. ej. «unidad»). */
export function unitFactor(from: string, to: string): number | null {
  if (from === to) return 1
  if (!KNOWN.includes(from) || !KNOWN.includes(to)) return null
  // Todas las parejas de KNOWN están en la tabla de convertBetweenUnits (masa ↔ volumen
  // con densidad 1, igual que el selector de unidad de cada fila).
  const f = convertBetweenUnits(1, from, to)
  return Number.isFinite(f) && f > 0 ? f : null
}

const scale = (n: number | null | undefined, f: number) => (typeof n === "number" && Number.isFinite(n) ? n * f : n)
const round = (n: number, places = 6) => Math.round(n * 10 ** places) / 10 ** places

export function convertIngredientUnit(ingredient: Ingredient, newUnit: string, f: number): Ingredient {
  const pricing = ingredient.pricing
  const netContent = round((pricing?.netContent || 0) * f)
  const pricePerUnit = netContent > 0 ? round((pricing?.purchasePrice || 0) / netContent, 8) : round((pricing?.pricePerUnit || 0) / f, 8)
  const merma = ingredient.merma
  return {
    ...ingredient,
    unit: newUnit as Ingredient["unit"],
    originalNetContent: ingredient.originalNetContent ? round(ingredient.originalNetContent * f) : ingredient.originalNetContent,
    merma: merma && merma.customType === "quantity" && merma.customValue ? { ...merma, customValue: round(merma.customValue * f) } : merma,
    pricing: { ...pricing, netContent, pricePerUnit },
    metadata: { ...ingredient.metadata, updatedAt: new Date().toISOString(), version: (ingredient.metadata?.version || 0) + 1 } as Ingredient["metadata"],
  }
}

/** Convierte las líneas de receta de un ingrediente. Devuelve solo las recetas que cambiaron. */
export function convertRecipeLines(recipes: Recipe[], ingredientId: string, newUnit: string, f: number): Recipe[] {
  const changed: Recipe[] = []
  const convert = (lines: Recipe["ingredients"]) =>
    lines.map((line) =>
      line.ingredientId === ingredientId
        ? { ...line, quantity: round((line.quantity || 0) * f), unitCost: round((line.unitCost || 0) / f, 8), unit: newUnit }
        : line,
    )
  for (const recipe of recipes) {
    const inLines = recipe.ingredients?.some((line) => line.ingredientId === ingredientId)
    // La copia «receta original» del modificador de PAX también (docs/189): si no, al
    // restaurarla la cantidad quedaba en la unidad vieja (0.2 kg leído como 0.2 g).
    const inSnapshot = recipe.originalSnapshot?.ingredients?.some((line) => line.ingredientId === ingredientId)
    if (!inLines && !inSnapshot) continue
    changed.push({
      ...recipe,
      ingredients: inLines ? convert(recipe.ingredients) : recipe.ingredients,
      ...(inSnapshot && recipe.originalSnapshot
        ? { originalSnapshot: { ...recipe.originalSnapshot, ingredients: convert(recipe.originalSnapshot.ingredients) } }
        : {}),
    })
  }
  return changed
}

export function convertInventoryItemUnit(item: InventoryItem, newUnit: string, f: number): InventoryItem {
  return {
    ...item,
    unit: newUnit,
    currentStock: typeof item.currentStock === "number" ? round(item.currentStock * f) : item.currentStock,
    minStock: round((item.minStock || 0) * f),
    netContent: scale(item.netContent, f) as number | undefined,
    stockReceipts: item.stockReceipts?.map((r) => ({ ...r, quantity: round(r.quantity * f) })),
  }
}

/** Convierte las cantidades de ese producto en el historial. Devuelve null si no había nada que cambiar. */
export function convertSnapshotsUnit(history: InventorySnapshot[], itemId: string, newUnit: string, f: number): InventorySnapshot[] | null {
  let touched = false
  const next = history.map((snap) => {
    if (!snap.items?.some((it) => it.id === itemId)) return snap
    touched = true
    return {
      ...snap,
      items: snap.items.map((it) =>
        it.id === itemId
          ? {
              ...it,
              unit: newUnit,
              quantity: round(it.quantity * f),
              receivedSincePrevious: scale(it.receivedSincePrevious, f) as number | undefined,
              netContent: scale(it.netContent, f) as number | undefined,
            }
          : it,
      ),
    }
  })
  return touched ? next : null
}
