import type { Classification } from "@/types/recipe"
import type { LanguageCode } from "@/lib/i18n/translations"

// Las clasificaciones en types/recipe.ts guardan el término francés de brigada de cocina
// entre paréntesis como parte del VALOR canónico (ej. "Línea caliente (Cuisine chaude)") —
// eso no se puede tocar sin romper recetas ya guardadas y la comparación con
// SUBRECIPE_CLASSIFICATION. Este archivo solo controla qué se MUESTRA al usuario: el nombre
// limpio en su idioma, sin el paréntesis en francés.

const ES_LABELS: Record<Classification, string> = {
  "Línea caliente (Cuisine chaude)": "Línea caliente",
  "Línea fría (Garde-manger / Cuisine froide)": "Línea fría",
  "Salsas y fondos (Saucier)": "Salsas y fondos",
  "Pescados (Poissonnier)": "Pescados",
  "Carnes y asados (Rôtisseur)": "Carnes y asados",
  "Parrilla (Grillardin)": "Parrilla",
  "Frituras (Friturier)": "Frituras",
  "Vegetales y guarniciones (Entremetier)": "Vegetales y guarniciones",
  "Panadería (Boulangerie)": "Panadería",
  "Bollería (Viennoiserie)": "Bollería",
  "Pastelería (Pâtisserie)": "Pastelería",
  "Chocolatería/Confitería (Chocolaterie/Confiserie)": "Chocolatería / Confitería",
  "Heladería (Glacerie)": "Heladería",
  "Charcutería y curados (Charcuterie/Salaison)": "Charcutería y curados",
  "Fermentación y conservas (Fermentation/Conserverie)": "Fermentación y conservas",
  "Sub Receta / produccion (Mise en place)": "Sub Receta / Producción",
  "I+D (R&D)": "I+D",
}

const EN_LABELS: Record<Classification, string> = {
  "Línea caliente (Cuisine chaude)": "Hot Line",
  "Línea fría (Garde-manger / Cuisine froide)": "Cold Line",
  "Salsas y fondos (Saucier)": "Sauces and Stocks",
  "Pescados (Poissonnier)": "Fish",
  "Carnes y asados (Rôtisseur)": "Meats and Roasts",
  "Parrilla (Grillardin)": "Grill",
  "Frituras (Friturier)": "Fried Foods",
  "Vegetales y guarniciones (Entremetier)": "Vegetables and Sides",
  "Panadería (Boulangerie)": "Bakery",
  "Bollería (Viennoiserie)": "Viennoiserie",
  "Pastelería (Pâtisserie)": "Pastry",
  "Chocolatería/Confitería (Chocolaterie/Confiserie)": "Chocolate and Confectionery",
  "Heladería (Glacerie)": "Ice Cream",
  "Charcutería y curados (Charcuterie/Salaison)": "Charcuterie and Cured Goods",
  "Fermentación y conservas (Fermentation/Conserverie)": "Fermentation and Preserves",
  "Sub Receta / produccion (Mise en place)": "Sub-recipe / Prep",
  "I+D (R&D)": "R&D",
}

// Para idiomas todavía sin traducción propia de clasificaciones, se usa el nombre en
// español sin el paréntesis francés — mejor que mostrar el francés a cualquier usuario.
export function getClassificationLabel(classification: Classification, language: LanguageCode): string {
  if (language === "en") return EN_LABELS[classification] ?? classification
  return ES_LABELS[classification] ?? classification
}
