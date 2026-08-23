"use client"

import { Eye, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTeamPreview } from "@/lib/plan-access"
import { stopTeamPreview } from "@/lib/storage/team-preview"
import { useRouter } from "next/navigation"

// Banner permanente mientras el dueño de la cuenta está viendo la app "como" una
// persona invitada (ver /equipo, botón "Vista previa") — imposible de confundir con
// una sesión real, siempre visible en cualquier pantalla mientras la vista previa está
// activa. Montado una sola vez en app/layout.tsx.
export function TeamPreviewBanner() {
  const { active, member } = useTeamPreview()
  const router = useRouter()

  if (!active || !member) return null

  const handleExit = () => {
    stopTeamPreview()
    router.push("/equipo")
  }

  return (
    <>
      <div className="fixed top-0 left-0 right-0 z-[1001] bg-amber-500 text-amber-950 px-4 py-2 flex items-center justify-center gap-3 text-sm font-medium shadow-md flex-wrap">
        <Eye className="h-4 w-4 shrink-0" />
        <span className="truncate">
          Viendo la app como <span className="font-bold">{member.name || member.email}</span> — así es exactamente
          lo que esta persona puede ver y hacer
        </span>
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1.5 bg-amber-50 hover:bg-white border-amber-700 text-amber-950 shrink-0"
          onClick={handleExit}
        >
          <X className="h-3.5 w-3.5" />
          Salir de vista previa
        </Button>
      </div>
      {/* Empuja el contenido de abajo (sidebar incluido, que también es fixed) para que
          el banner no lo tape — mismo alto que el banner real. */}
      <div className="h-10" />
    </>
  )
}
