"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { GastrometricsLogo } from "@/components/gastrometrics-logo"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/contexts/language-context"
import { cn } from "@/lib/utils"

// Header compartido por las páginas públicas (antes de iniciar sesión): "/", "/about" y
// "/planes". Antes cada una vivía aislada sin ningún nav — /planes y /about no tenían forma
// de volver a ninguna otra parte del sitio salvo el botón atrás del navegador.
//
// Pedido explícito del dueño del proyecto: este header SIEMPRE muestra "Iniciar sesión" /
// "Registrarse", sin importar si el navegador ya tiene una sesión activa — antes, con
// sesión activa, mostraba un atajo "Ir al Dashboard" en su lugar (patrón común de SaaS,
// pero no lo que se pidió acá). Entrar a la app pasa siempre por /login.
export function MarketingHeader() {
  const pathname = usePathname()
  const { t } = useLanguage()

  const navItems = [
    { href: "/", label: t("marketing_nav_home") },
    { href: "/about", label: t("marketing_nav_about") },
    { href: "/planes", label: t("marketing_nav_plans") },
    { href: "/contacto", label: t("marketing_nav_help") },
  ]

  return (
    <header className="container mx-auto p-4 border-b border-hairline">
      <nav className="flex justify-between items-center gap-4 flex-wrap">
        <Link href="/" className="flex items-center gap-3 shrink-0">
          <GastrometricsLogo className="h-10 w-10" variant="brand" />
          <span className="text-2xl font-semibold tracking-[-0.025em] text-foreground">Gastrometrics</span>
        </Link>

        <div className="flex items-center gap-1 sm:gap-2">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <Button
                variant="ghost"
                className={cn(
                  "hover:bg-accent hover:text-accent-foreground",
                  pathname === item.href && "bg-accent text-accent-foreground",
                )}
              >
                {item.label}
              </Button>
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-3 min-h-10">
          <Link href="/login">
            <Button variant="ghost" className="hover:bg-accent hover:text-accent-foreground">
              {t("marketing_login")}
            </Button>
          </Link>
          <Link href="/signup">
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90">{t("marketing_signup")}</Button>
          </Link>
        </div>
      </nav>
    </header>
  )
}
