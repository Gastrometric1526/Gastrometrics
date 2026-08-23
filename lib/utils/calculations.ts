import type { RecipeIngredient } from "@/types/recipe"
export { formatCurrency, formatPercentage } from "@/lib/currency"

export function calculateIngredientCost(ingredient: RecipeIngredient): number {
  return ingredient.quantity * ingredient.costPerMeasure
}

export function calculateTotalIngredientsCost(ingredients: RecipeIngredient[]): number {
  return ingredients.reduce((total, ingredient) => total + calculateIngredientCost(ingredient), 0)
}

// Actualizar las funciones de conversión para manejar todos los casos posibles
export function convertToBaseUnit(quantity: number, fromUnit: string): { value: number; type: "mass" | "volume" } {
  // Determinar si es una unidad de masa o volumen
  const massUnits = ["gramos", "kilogramos", "onzas", "libras"]
  const volumeUnits = ["mililitros", "litros", "onzas líquidas", "galones"]

  const isMass = massUnits.includes(fromUnit)
  const isVolume = volumeUnits.includes(fromUnit)

  if (fromUnit === "unidad") {
    return { value: quantity, type: "mass" } // Por defecto tratamos unidad como masa
  }

  // Convertir a la unidad base (gramos para masa, mililitros para volumen)
  let baseValue = quantity

  if (isMass) {
    switch (fromUnit) {
      case "kilogramos":
        baseValue = quantity * 1000 // kg a g
        break
      case "onzas":
        baseValue = quantity * 28.3495 // oz a g
        break
      case "libras":
        baseValue = quantity * 453.592 // lb a g
        break
      // gramos ya está en la unidad base
    }
    return { value: baseValue, type: "mass" }
  } else if (isVolume) {
    switch (fromUnit) {
      case "litros":
        baseValue = quantity * 1000 // L a ml
        break
      case "onzas líquidas":
        baseValue = quantity * 29.5735 // fl oz a ml
        break
      case "galones":
        baseValue = quantity * 3785.41 // gal a ml
        break
      // mililitros ya está en la unidad base
    }
    return { value: baseValue, type: "volume" }
  }

  // Si no es ninguna de las anteriores, devolver el valor original
  return { value: quantity, type: "mass" }
}

export function convertFromBaseUnit(baseValue: number, toUnit: string, type: "mass" | "volume"): number {
  if (toUnit === "unidad") {
    return baseValue // No convertimos unidades
  }

  const massUnits = ["gramos", "kilogramos", "onzas", "libras"]
  const volumeUnits = ["mililitros", "litros", "onzas líquidas", "galones"]

  // Verificar compatibilidad de tipos
  const isMassUnit = massUnits.includes(toUnit)
  const isVolumeUnit = volumeUnits.includes(toUnit)

  if ((type === "mass" && !isMassUnit) || (type === "volume" && !isVolumeUnit)) {
    // Tipos incompatibles, no podemos convertir directamente
    return baseValue
  }

  // Convertir desde la unidad base a la unidad destino
  if (type === "mass") {
    switch (toUnit) {
      case "kilogramos":
        return baseValue / 1000 // g a kg
      case "onzas":
        return baseValue / 28.3495 // g a oz
      case "libras":
        return baseValue / 453.592 // g a lb
      default: // gramos
        return baseValue
    }
  } else {
    // type === 'volume'
    switch (toUnit) {
      case "litros":
        return baseValue / 1000 // ml a L
      case "onzas líquidas":
        return baseValue / 29.5735 // ml a fl oz
      case "galones":
        return baseValue / 3785.41 // ml a gal
      default: // mililitros
        return baseValue
    }
  }
}

// Función para convertir entre cualquier par de unidades
export function convertBetweenUnits(value: number, fromUnit: string, toUnit: string): number {
  // Si las unidades son iguales, no hay conversión
  if (fromUnit === toUnit) return value

  // Si alguna unidad es "unidad", no convertimos
  if (fromUnit === "unidad" || toUnit === "unidad") return value

  // Factores de conversión exactos basados en la tabla proporcionada
  const conversions: { [key: string]: { [key: string]: number } } = {
    // Conversiones de masa
    kilogramos: {
      libras: 2.2046226218487757, // kg a lb (mayor precisión)
      onzas: 35.27396194958041,
      gramos: 1000,
      // Conversiones a volumen
      litros: 1, // Asumiendo densidad 1 kg/L
      mililitros: 1000,
      galones: 0.26417205235814845,
      "onzas líquidas": 33.814022558919045,
      "onzas fluidas": 33.814022558919045,
    },
    libras: {
      kilogramos: 0.45359237, // lb a kg (mayor precisión)
      onzas: 16,
      gramos: 453.59237,
      // Conversiones a volumen
      litros: 0.45359237,
      mililitros: 453.59237,
      galones: 0.11982642681493513,
      "onzas líquidas": 15.337783203461425,
      "onzas fluidas": 15.337783203461425,
    },
    onzas: {
      kilogramos: 0.028349523125,
      libras: 0.0625,
      gramos: 28.349523125,
      // Conversiones a volumen
      litros: 0.028349523125,
      mililitros: 28.349523125,
      galones: 0.007491651675933446,
      "onzas líquidas": 0.9586114477162641,
      "onzas fluidas": 0.9586114477162641,
    },
    gramos: {
      kilogramos: 0.001,
      libras: 0.0022046226218487757,
      onzas: 0.03527396194958041,
      // Conversiones a volumen
      litros: 0.001,
      mililitros: 1,
      galones: 0.00026417205235814845,
      "onzas líquidas": 0.033814022558919045,
      "onzas fluidas": 0.033814022558919045,
    },

    // Conversiones de volumen
    litros: {
      mililitros: 1000,
      galones: 0.26417205235814845, // L a gal (mayor precisión)
      "onzas líquidas": 33.814022558919045,
      "onzas fluidas": 33.814022558919045,
      // Conversiones a masa
      kilogramos: 1, // Asumiendo densidad 1 kg/L
      gramos: 1000,
      libras: 2.2046226218487757,
      onzas: 35.27396194958041,
    },
    mililitros: {
      litros: 0.001,
      galones: 0.00026417205235814845,
      "onzas líquidas": 0.033814022558919045,
      "onzas fluidas": 0.033814022558919045,
      // Conversiones a masa
      kilogramos: 0.001,
      gramos: 1,
      libras: 0.0022046226218487757,
      onzas: 0.03527396194958041,
    },
    galones: {
      litros: 3.785411784, // gal a L (mayor precisión)
      mililitros: 3785.411784,
      "onzas líquidas": 128,
      "onzas fluidas": 128,
      // Conversiones a masa
      kilogramos: 3.785411784,
      gramos: 3785.411784,
      libras: 8.345404452,
      onzas: 133.526471232,
    },
    "onzas líquidas": {
      litros: 0.0295735296875,
      mililitros: 29.5735296875, // fl oz a mL (mayor precisión)
      galones: 0.0078125,
      "onzas fluidas": 1,
      // Conversiones a masa
      kilogramos: 0.0295735296875,
      gramos: 29.5735296875,
      libras: 0.06521739130434783,
      onzas: 1.0434782608695652,
    },
    "onzas fluidas": {
      litros: 0.0295735296875,
      mililitros: 29.5735296875, // fl oz a mL (mayor precisión)
      galones: 0.0078125,
      "onzas líquidas": 1,
      // Conversiones a masa
      kilogramos: 0.0295735296875,
      gramos: 29.5735296875,
      libras: 0.06521739130434783,
      onzas: 1.0434782608695652,
    },
  }

  // Verificar si existe la conversión directa
  if (conversions[fromUnit] && conversions[fromUnit][toUnit]) {
    const result = value * conversions[fromUnit][toUnit]
    return result
  }

  console.error(`Conversión no soportada: ${fromUnit} a ${toUnit}`)
  return value
}

export function convertAllIngredientsToSystem(ingredients: any[], targetSystem: "metric" | "imperial"): any[] {
  console.log(`Convirtiendo ${ingredients.length} ingredientes al sistema ${targetSystem}`)

  return ingredients.map((ingredient, index) => {
    console.log(`Procesando ingrediente ${index + 1}:`, ingredient.name, ingredient.unit)

    if (ingredient.unit === "unidad") {
      console.log("Saltando ingrediente con unidad 'unidad'")
      return ingredient // No convertir unidades
    }

    let newUnit = ingredient.unit

    if (targetSystem === "metric") {
      // Convertir a sistema métrico (unidades más bajas: gramos, mililitros)
      switch (ingredient.unit) {
        case "galones":
        case "onzas fluidas":
        case "onzas líquidas":
        case "litros":
          newUnit = "mililitros"
          break
        case "libras":
        case "onzas":
        case "kilogramos":
          newUnit = "gramos"
          break
        default:
          // Si ya está en la unidad correcta, mantener
          break
      }
    } else {
      // Convertir a sistema imperial (unidades más bajas: onzas, onzas líquidas)
      switch (ingredient.unit) {
        case "galones":
        case "litros":
        case "mililitros":
          newUnit = "onzas líquidas"
          break
        case "kilogramos":
        case "gramos":
        case "libras":
          newUnit = "onzas"
          break
        default:
          // Si ya está en la unidad correcta, mantener
          break
      }
    }

    console.log(`Cambio de unidad: ${ingredient.unit} → ${newUnit}`)

    // Solo cambiar la unidad, la tabla se encargará de los cálculos
    return {
      ...ingredient,
      unit: newUnit,
      metadata: {
        ...ingredient.metadata,
        updatedAt: new Date().toISOString(),
        version: (ingredient.metadata?.version || 0) + 1,
      },
    }
  })
}
