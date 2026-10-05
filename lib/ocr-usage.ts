"use client"

/**
 * Registro de lecturas con OCR (docs/153). Decisión del dueño: el OCR está abierto en
 * todos los planes, dentro de los módulos que cada plan ya incluye (importar recetas e
 * ingredientes en todos; conteo de inventario con Inventario). No hay cuota: cada lectura
 * solo queda en activity_log (module "ocr", metadata.kind) para medir el uso real en
 * /admin (por tipo, por cuenta, primeros 7 y 30 días, retorno y conversión a pago) antes
 * de decidir cualquier límite. Si algún día hay límite, se revisa ANTES de empezar una
 * importación, nunca a mitad.
 */

import { useCallback } from "react"
import { useAuth } from "@/contexts/auth-context"
import { logActivity } from "@/lib/services/activity-log"

export type OcrReadKind = "recipe" | "receipt" | "inventory"

export function useOcrUsage() {
  const { user } = useAuth()
  return useCallback(
    (kind: OcrReadKind) => {
      if (!user) return
      logActivity({ user: { id: user.id, email: user.email ?? "" }, businessId: null, module: "ocr", action: "read", metadata: { kind } })
    },
    [user],
  )
}
