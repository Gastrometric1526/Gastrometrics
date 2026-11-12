"use client"

/**
 * Íconos de cada área de /admin (docs/279). Desde docs/281 ya no hay barra lateral ni
 * submenús: el Inicio muestra tarjetas grandes (components/admin/admin-home.tsx) y cada área
 * se abre en su pantalla (components/admin/area-page.tsx).
 */

import type React from "react"
import { BookOpen, DollarSign, HeartPulse, Home, Megaphone, MessageCircle, TrendingUp, Users } from "lucide-react"
import type { AdminTab } from "@/lib/admin/nav"

export const SECTION_ICONS: Record<AdminTab, React.ComponentType<{ className?: string }>> = {
  resumen: Home,
  buzon: MessageCircle,
  cuentas: Users,
  ingresos: DollarSign,
  crecimiento: TrendingUp,
  comunicacion: Megaphone,
  sistema: HeartPulse,
  guia: BookOpen,
}
