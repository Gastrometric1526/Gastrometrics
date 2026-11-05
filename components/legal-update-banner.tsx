"use client"

import { useState } from "react"
import Link from "next/link"
import { X, Scale } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { useLanguage } from "@/contexts/language-context"
import { CURRENT_LEGAL_VERSION } from "@/lib/legal"

// Aviso no bloqueante para cuentas EXISTENTES (creadas antes de la versión actual de
// los Términos de Uso/Política de Privacidad/Aviso de Responsabilidad, ver docs/118)
// — a diferencia del registro nuevo (app/signup/page.tsx), que sí exige aceptar antes
// de crear la cuenta, acá NUNCA se bloquea el uso de la app: los nuevos Términos §9 ya
// permiten "uso continuado tras aviso implica aceptación". Se descarta con un clic
// (llama a /api/account/acknowledge-terms) y no vuelve a aparecer para esa cuenta.
//
// BUG REAL encontrado en vivo (ver docs/119) probando otra función en la misma sesión:
// la primera versión de este componente era una tarjeta flotante fija en la esquina
// inferior derecha — en viewports angostos (por debajo de md), o simplemente cuando una
// tabla de la app tiene su columna de acciones cerca de esa esquina (confirmado con la
// tabla real de Órdenes de Compra), la tarjeta tapaba en silencio botones reales de la
// página de abajo. Reescrito para seguir el mismo patrón ya probado que usa
// TeamPreviewBanner (franja fija arriba de todo + un div espaciador del mismo alto que
// empuja el resto del layout hacia abajo) — nada puede quedar nunca debajo de esto,
// por construcción, en vez de depender de ajustar tamaños a mano.
export function LegalUpdateBanner() {
  const { isLoggedIn, userProfile } = useAuth()
  const { t } = useLanguage()
  const [dismissed, setDismissed] = useState(false)
  const [dismissing, setDismissing] = useState(false)

  const needsAcknowledgment = isLoggedIn && userProfile && userProfile.termsVersion !== CURRENT_LEGAL_VERSION
  if (!needsAcknowledgment || dismissed) return null

  const handleDismiss = async () => {
    setDismissed(true)
    setDismissing(true)
    try {
      await fetch("/api/account/acknowledge-terms", { method: "POST" })
    } catch {
      // Best-effort: si falla, el banner ya se ocultó para esta sesión; volverá a
      // aparecer en la próxima si terms_version sigue sin coincidir — no es un
      // problema real, solo un recordatorio que se repite.
    } finally {
      setDismissing(false)
    }
  }

  return (
    <>
      <div className="fixed top-0 left-0 right-0 z-[1000] bg-muted border-b border-border px-4 py-2 flex items-center justify-center gap-3 text-sm shadow-sm flex-wrap">
        <Scale className="h-4 w-4 text-primary shrink-0" />
        <span className="text-foreground truncate">{t("legal_update_banner_title")}</span>
        <Link href="/terminos-de-uso" target="_blank" className="text-primary hover:underline font-medium shrink-0">
          {t("legal_update_banner_view_link")}
        </Link>
        <button
          type="button"
          onClick={handleDismiss}
          disabled={dismissing}
          className="text-muted-foreground hover:text-foreground shrink-0 ml-1"
          aria-label={t("legal_update_banner_dismiss")}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {/* Mismo alto que la franja real — empuja el resto del layout (incluido el Sidebar
          fijo de cada página) hacia abajo, igual que hace TeamPreviewBanner. */}
      <div className="h-10" />
    </>
  )
}
