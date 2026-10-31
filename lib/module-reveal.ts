"use client"

/**
 * Revelación progresiva de módulos (docs/145) — pedido del dueño: no mostrar de entrada
 * los módulos avanzados, para que la app no abrume y se vayan revelando paso a paso.
 * Las métricas lo respaldaban: Inventario, Menús y Órdenes de compra se visitaban sin
 * usarse (sin recetas no tienen con qué trabajar).
 *
 * Etapas, según las recetas propias (no sub-recetas) de todos los negocios de la cuenta:
 *   0 recetas → Dashboard, Ficha Técnica, Mis Recetas, Ingredientes, Negocios
 *   1+        → + Reportes y Ventas
 *   3+        → + Inventario, Menús, MEP (docs/202), Órdenes de compra y Equipo
 * Lo recién revelado se marca "Nuevo" hasta que se visita, con un resaltado animado en el menú
 * y en las Acciones Rápidas y una ventana que lo anuncia una sola vez (docs/208). Siempre se puede ver todo
 * ("Ver todos los módulos", se recuerda por cuenta). No aplica a la Vista previa de
 * Equipo ni a miembros invitados: ellos ven lo que tienen permitido. Mientras las recetas
 * no terminan de cargar no se oculta nada (evita que un menú completo parpadee).
 */

import { useEffect, useMemo, useState } from "react"
import { usePathname } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { useRecipes, ensureRecipesLoaded, isSubRecipe, countOwnRecipesAllBusinesses } from "@/lib/storage/recipes"

export const MODULE_STAGES: Record<string, number> = {
  "/estadisticas": 1,
  "/ventas": 1,
  "/inventario": 3,
  "/menus": 3,
  "/mep": 3,
  "/menu-y-compras": 3,
  "/equipo": 3,
}

/**
 * ¿Esta ruta es una visita al módulo? Órdenes de compra se abre en /menu-y-compras, que
 * redirige a /business/{id}/ordenes-compra: antes la marca «Nuevo» nunca se quitaba
 * (docs/218). Puro (cubierto por pruebas).
 */
export function isModuleVisit(pathname: string, href: string): boolean {
  if (pathname.startsWith(href)) return true
  if (href === "/menu-y-compras") return /^\/business\/[^/]+\/ordenes-compra/.test(pathname) || pathname.startsWith("/procesar-ordenes")
  return false
}

/** Módulos ocultos para una cantidad de recetas — puro (cubierto por pruebas). */
export function hiddenModulesFor(recipeCount: number): string[] {
  return Object.entries(MODULE_STAGES)
    .filter(([, stage]) => recipeCount < stage)
    .map(([href]) => href)
}

interface RevealState {
  showAll: boolean
  hiddenBefore: string[] // ocultos la última vez: si dejan de estarlo, son "Nuevo"
  fresh: string[] // revelados y todavía no visitados
  announced?: string[] // ya anunciados con la ventana de desbloqueo (docs/208)
}

const EMPTY: RevealState = { showAll: false, hiddenBefore: [], fresh: [], announced: [] }

function read(key: string): RevealState {
  try {
    return { ...EMPTY, ...JSON.parse(localStorage.getItem(key) || "{}") }
  } catch {
    return EMPTY
  }
}

function write(key: string, state: RevealState) {
  try {
    localStorage.setItem(key, JSON.stringify(state))
  } catch {
    /* sin almacenamiento: se oculta igual, solo no se recuerda */
  }
}

export function useModuleReveal(options: { disabled?: boolean } = {}) {
  const { user } = useAuth()
  const pathname = usePathname()
  const recipes = useRecipes()
  const [ready, setReady] = useState(false)
  const [state, setState] = useState<RevealState>(EMPTY)
  const key = user ? `gm_module_reveal:${user.id}` : ""
  const [allBusinessesCount, setAllBusinessesCount] = useState(0)
  // Dashboard principal (reactivo) o todos los negocios (se recuenta al cambiar de página):
  // quien trabaja solo en un negocio secundario también avanza de etapa.
  const mainCount = useMemo(() => recipes.filter((r) => !isSubRecipe(r)).length, [recipes])
  const recipeCount = Math.max(mainCount, allBusinessesCount)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    setState(read(key))
    ensureRecipesLoaded()
      .catch(() => null)
      .finally(() => !cancelled && setReady(true))
    return () => {
      cancelled = true
    }
  }, [user, key])

  useEffect(() => {
    if (!user || options.disabled) return
    let cancelled = false
    countOwnRecipesAllBusinesses(user.id)
      .then((n) => !cancelled && n !== null && setAllBusinessesCount(n))
      .catch(() => null)
    return () => {
      cancelled = true
    }
  }, [user, pathname, options.disabled])

  // Detecta lo que se acaba de revelar y lo marca "Nuevo"; al visitarlo, deja de serlo.
  useEffect(() => {
    if (!ready || !key || options.disabled) return
    const hiddenNow = hiddenModulesFor(recipeCount)
    const prev = read(key)
    const revealed = prev.hiddenBefore.filter((href) => !hiddenNow.includes(href))
    let fresh = Array.from(new Set([...prev.fresh, ...revealed]))
    if (pathname) fresh = fresh.filter((href) => !isModuleVisit(pathname, href))
    const next = { ...prev, hiddenBefore: hiddenNow, fresh }
    if (JSON.stringify(next) !== JSON.stringify(prev)) {
      write(key, next)
      setState(next)
    }
  }, [ready, key, recipeCount, pathname, options.disabled])

  const hidden = useMemo(
    () => (!ready || options.disabled || state.showAll ? new Set<string>() : new Set(hiddenModulesFor(recipeCount))),
    [ready, options.disabled, state.showAll, recipeCount],
  )

  const showAll = () => {
    if (!key) return
    const next = { ...read(key), showAll: true }
    write(key, next)
    setState(next)
  }

  // Recién desbloqueados que todavía no se anunciaron con la ventana (docs/208).
  const toAnnounce = state.fresh.filter((href) => !(state.announced ?? []).includes(href))
  const markAnnounced = () => {
    if (!key) return
    const prev = read(key)
    const next = { ...prev, announced: Array.from(new Set([...(prev.announced ?? []), ...prev.fresh])) }
    write(key, next)
    setState(next)
  }

  return { ready, recipeCount, hidden, fresh: new Set(state.fresh), toAnnounce, markAnnounced, showAll, showingAll: state.showAll }
}
