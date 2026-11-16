"use client"

/**
 * El horario del personal en pantalla (docs/323): lo lee de `pos_data` una vez por negocio y
 * lo comparte entre Reportes (Personal, Planear, Finanzas) y la pestaña Horario del POS. Si
 * todavía no existe, toma lo que se había guardado en el negocio (docs/322).
 */

import { useCallback, useEffect, useState } from "react"
import { fetchStaffSchedule, saveStaffSchedule } from "@/lib/storage/pos"
import { getBusinessById } from "@/lib/storage/businesses"
import { EMPTY_SCHEDULE, type StaffSchedule } from "@/lib/staff-schedule"

const EVENT = "gm:staff-schedule-changed"
const cache = new Map<string, StaffSchedule>()
const key = (businessId?: string | null) => businessId || "main"

function legacy(businessId?: string | null): StaffSchedule {
  const b = businessId && businessId !== "main" ? getBusinessById(businessId) : null
  return b?.staff?.length || b?.shifts?.length ? { staff: b.staff ?? [], shifts: b.shifts ?? [] } : EMPTY_SCHEDULE
}

export async function loadStaffSchedule(businessId?: string | null): Promise<StaffSchedule> {
  const k = key(businessId)
  if (cache.has(k)) return cache.get(k)!
  let s: StaffSchedule
  try {
    s = (await fetchStaffSchedule(businessId)) ?? legacy(businessId)
  } catch {
    s = legacy(businessId)
  }
  cache.set(k, s)
  return s
}

export function useStaffSchedule(businessId?: string | null): {
  schedule: StaffSchedule
  loaded: boolean
  save: (next: StaffSchedule) => Promise<boolean>
} {
  const k = key(businessId)
  const [schedule, setSchedule] = useState<StaffSchedule>(() => cache.get(k) ?? EMPTY_SCHEDULE)
  const [loaded, setLoaded] = useState(cache.has(k))
  useEffect(() => {
    let alive = true
    loadStaffSchedule(businessId).then((s) => {
      if (!alive) return
      setSchedule(s)
      setLoaded(true)
    })
    const onChange = (e: Event) => {
      const d = (e as CustomEvent<{ key: string; schedule: StaffSchedule }>).detail
      if (d.key === k) setSchedule(d.schedule)
    }
    window.addEventListener(EVENT, onChange)
    return () => {
      alive = false
      window.removeEventListener(EVENT, onChange)
    }
  }, [businessId, k])
  const save = useCallback(
    async (next: StaffSchedule) => {
      // Turnos de más de 400 días no se guardan, para que el registro no crezca sin fin.
      const cutoff = new Date(Date.now() - 400 * 86400000).toISOString().slice(0, 10)
      const trimmed = { ...next, shifts: next.shifts.filter((s) => s.date >= cutoff) }
      const previous = cache.get(k) ?? EMPTY_SCHEDULE
      cache.set(k, trimmed)
      window.dispatchEvent(new CustomEvent(EVENT, { detail: { key: k, schedule: trimmed } }))
      try {
        await saveStaffSchedule(trimmed, businessId)
        return true
      } catch {
        cache.set(k, previous)
        window.dispatchEvent(new CustomEvent(EVENT, { detail: { key: k, schedule: previous } }))
        return false
      }
    },
    [businessId, k],
  )
  return { schedule, loaded, save }
}
