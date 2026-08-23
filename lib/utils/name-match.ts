// Normalizacion y emparejamiento de nombres — mismo patron que stripAccents/
// normalizeCategory en app/ingredientes/page.tsx (no habia una version compartida
// en lib/, ver docs/32), usado aqui para emparejar el nombre de un plato tal como
// viene del POS con el nombre de una receta ya guardada.

export function normalizeName(value: string | undefined | null): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

export interface NameMatchCandidate {
  id: string
  name: string
}

// Coincidencia exacta primero (tras normalizar), luego substring en cualquier
// direccion como ultimo recurso — igual que normalizeCategory. No es
// distancia-de-edicion (no hay Levenshtein en el proyecto), pero cubre el caso
// real mas comun: mismo nombre con acentos/mayusculas distintas, o el nombre del
// POS truncado/con texto extra alrededor del nombre real de la receta.
export function findBestNameMatch<T extends NameMatchCandidate>(rawName: string, candidates: T[]): T | null {
  const target = normalizeName(rawName)
  if (!target) return null

  const exact = candidates.find((c) => normalizeName(c.name) === target)
  if (exact) return exact

  // BUG CORREGIDO: usaba Array.find, que devuelve la PRIMERA coincidencia por
  // substring en el orden del arreglo, no la mejor — con nombres genericos
  // parecidos ("Pollo" y "Pollo a la Plancha" en el mismo catalogo), un nombre del
  // POS como "COMBO POLLO A LA PLANCHA" podia emparejar con la receta equivocada
  // segun el orden de las recetas, no segun cual coincide mejor. Ahora se
  // recolectan todas las coincidencias por substring y se elige la de nombre
  // normalizado mas largo (la mas especifica).
  let bestMatch: T | null = null
  let bestLength = 0
  for (const c of candidates) {
    const normalized = normalizeName(c.name)
    if (normalized.length > 2 && (target.includes(normalized) || normalized.includes(target))) {
      if (normalized.length > bestLength) {
        bestMatch = c
        bestLength = normalized.length
      }
    }
  }
  return bestMatch
}
