/**
 * PostgREST (Supabase) corta cada select en 1000 filas sin avisar. Las rutas de /admin que
 * leen tablas que crecen solas (visitas, eventos, actividad, ventas…) usaban un select simple
 * y, pasado ese tope, mostraban números cortados (docs/194). Esto trae todas las páginas y
 * devuelve la misma forma `{ data, error }` que un select normal, para no tocar el resto.
 *
 * `build(from, to)` debe ordenar por una columna estable (la llave primaria) y aplicar
 * `.range(from, to)`; si no, las páginas pueden repetir o saltarse filas.
 */
import { fetchAllPages } from "@/lib/services/notify-reengagement"

export async function selectAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>,
): Promise<{ data: T[] | null; error: unknown }> {
  try {
    return { data: await fetchAllPages<T>(build), error: null }
  } catch (error) {
    return { data: null, error }
  }
}
