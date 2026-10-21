"use client"

/**
 * Conecta un formulario con su borrador automático (docs/171, lib/storage/form-draft.ts).
 *
 * - Al activarse (`active`: el formulario de un registro NUEVO está abierto) busca un
 *   borrador vigente y, si vale la pena, lo entrega a `onRestore` y muestra el aviso.
 * - Mientras está activo, guarda solo cada vez que cambia `value` (con 700 ms de espera)
 *   y al cerrar o recargar la pestaña.
 * - Al desactivarse (cerrar el formulario sin guardar) NO borra el borrador: esa es la
 *   idea. `clear()` se llama al guardar de verdad; `discard()` cuando la persona elige
 *   empezar de cero.
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { useAuth } from "@/contexts/auth-context"
import { clearFormDraft, loadFormDraft, saveFormDraft, type FormDraftKind } from "@/lib/storage/form-draft"

export function useFormDraft<T>(options: {
  kind: FormDraftKind
  businessId?: string | null
  active: boolean
  value: T
  isMeaningful: (value: T) => boolean
  onRestore: (data: T) => void
}) {
  const { kind, businessId, active, value, isMeaningful } = options
  const { user } = useAuth()
  const userId = user?.id
  const [restoredAt, setRestoredAt] = useState<string | null>(null)
  const readyRef = useRef(false)
  const onRestoreRef = useRef(options.onRestore)
  onRestoreRef.current = options.onRestore
  // Último valor con contenido mientras el formulario estaba abierto: es lo que se guarda
  // al cerrar o recargar (el formulario suele vaciarse en el mismo momento en que se cierra).
  const pendingRef = useRef<T | null>(null)

  // Restaurar al abrir.
  useEffect(() => {
    if (!active || !userId) {
      readyRef.current = false
      return
    }
    const draft = loadFormDraft<T>(kind, userId, businessId)
    pendingRef.current = null
    if (draft && isMeaningful(draft.data)) {
      onRestoreRef.current(draft.data)
      setRestoredAt(draft.savedAt)
    } else {
      setRestoredAt(null)
    }
    // Se habilita el guardado después del render que aplica lo restaurado.
    const t = setTimeout(() => {
      readyRef.current = true
    }, 0)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, userId, kind, businessId])

  // Guardar mientras escribe.
  useEffect(() => {
    if (!active || !userId || !readyRef.current) return
    pendingRef.current = isMeaningful(value) ? value : null
    const timer = setTimeout(() => {
      if (!readyRef.current) return
      if (isMeaningful(value)) saveFormDraft(kind, userId, businessId, value)
    }, 700)
    return () => clearTimeout(timer)
  }, [active, userId, kind, businessId, value, isMeaningful])

  // Guardar al cerrar o recargar la pestaña.
  useEffect(() => {
    if (!active || !userId) return
    const flush = () => {
      if (pendingRef.current !== null) saveFormDraft(kind, userId, businessId, pendingRef.current)
    }
    window.addEventListener("pagehide", flush)
    window.addEventListener("beforeunload", flush)
    return () => {
      flush()
      window.removeEventListener("pagehide", flush)
      window.removeEventListener("beforeunload", flush)
    }
  }, [active, userId, kind, businessId])

  /** Al guardar el registro de verdad. */
  const clear = useCallback(() => {
    readyRef.current = false
    pendingRef.current = null
    setRestoredAt(null)
    if (userId) clearFormDraft(kind, userId, businessId)
  }, [userId, kind, businessId])

  /** «Empezar de cero»: borra el borrador; el formulario lo reinicia quien llama. */
  const discard = useCallback(() => {
    pendingRef.current = null
    setRestoredAt(null)
    if (userId) clearFormDraft(kind, userId, businessId)
  }, [userId, kind, businessId])

  return { restoredAt, clear, discard, dismissNotice: () => setRestoredAt(null) }
}
