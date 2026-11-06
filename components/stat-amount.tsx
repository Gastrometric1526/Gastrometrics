/**
 * Monto de una tarjeta de estadísticas (docs/249). Se queda en una línea y baja de tamaño
 * según lo largo que sea: el ancho sale del contenedor más cercano con `container-type`
 * (`STAT_AMOUNT_BOX`), medido en `cqi`, y 0.56 em es lo que ocupa cada carácter con margen.
 * `compact` es para las tarjetas cuyo número es `text-lg` en celular (tope de 18 px).
 * Un navegador sin `cqi` ignora el tamaño y usa la clase; si el monto no cabe, corta la línea.
 */
export const STAT_AMOUNT_BOX = "min-w-0 flex-1 [container-type:inline-size]"

export function StatAmount({ value, compact = false }: { value: string; compact?: boolean }) {
  const size = compact ? "text-lg md:text-2xl [--stat-cap:1.125rem] md:[--stat-cap:1.5rem]" : "text-2xl"
  const fontSize = `min(var(--stat-cap, 1.5rem), max(0.875rem, calc(100cqi / ${(value.length * 0.56).toFixed(2)})))`
  return (
    <p className={`${size} font-bold text-foreground [overflow-wrap:anywhere]`} style={{ fontSize }}>
      {value}
    </p>
  )
}
