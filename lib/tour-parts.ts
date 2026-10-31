/**
 * Tutorial por partes (pedido del dueño, docs/220): al entrar a una sección por primera vez
 * se muestran solo los primeros pasos; cuando la persona los completa, la siguiente parte
 * se activa la próxima vez que entra (o enseguida con «Seguir ahora»). Así hasta terminar.
 *
 * - `tour_completed_<slug>` = "true" → recorrido terminado (o saltado con la X).
 * - `tour_completed_<slug>_part` = número de la próxima parte a mostrar.
 * - «Reiniciar tutorial» y `?tour=` abren el recorrido completo de una vez.
 */

/** Divide `total` pasos en partes de `size`; una última parte de un solo paso se une a la anterior. */
export function splitTourParts(total: number, size = 3): Array<[number, number]> {
  if (total <= 0) return []
  if (!Number.isFinite(size) || size >= total) return [[0, total]]
  const parts: Array<[number, number]> = []
  for (let start = 0; start < total; start += size) parts.push([start, Math.min(total, start + size)])
  const last = parts[parts.length - 1]
  if (parts.length > 1 && last[1] - last[0] === 1) {
    parts.pop()
    parts[parts.length - 1] = [parts[parts.length - 1][0], total]
  }
  return parts
}

export const tourPartKey = (storageKey: string) => `${storageKey}_part`

/** Próxima parte guardada (0 si no hay o no es válida). */
export function parseTourPart(raw: string | null): number {
  const n = Number(raw)
  return Number.isInteger(n) && n > 0 ? n : 0
}
