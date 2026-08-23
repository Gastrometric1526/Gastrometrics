"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { GastrometricsLogo } from "@/components/gastrometrics-logo"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/auth-context"
import { useLanguage } from "@/contexts/language-context"
import { cn } from "@/lib/utils"

// Header compartido por las páginas públicas (antes de iniciar sesión): "/", "/about" y
// "/planes". Antes cada una vivía aislada sin ningún nav — /planes y /about no tenían forma
// de volver a ninguna otra parte del sitio salvo el botón atrás del navegador.
export function MarketingHeader() {
  const pathname = usePathname()
  // isLoggedIn arranca en false tanto en SSR como en el primer render del cliente (ver
  // contexts/auth-context.tsx) — no hay salto de hidratación, solo se revela una vez
  // montado. BUG CORREGIDO: mientras tanto, esto SIEMPRE mostraba "Iniciar Sesión /
  // Registrarse" (la rama de "no autenticado"), así que un usuario que YA tenía sesión
  // veía ese botón un instante y luego un salto brusco a "Ir al Dashboard" en cuanto
  // authChecked se resolvía — dos textos con significado opuesto, no un simple parpadeo.
  // Ahora, mientras no se sabe con certeza (!authChecked), no se muestra ninguno de los
  // dos — nada que después haya que corregir de golpe.
  const { isLoggedIn, authChecked } = useAuth()
  const { t } = useLanguage()

  const navItems = [
    { href: "/", label: t("marketing_nav_home") },
    { href: "/about", label: t("marketing_nav_about") },
    { href: "/planes", label: t("marketing_nav_plans") },
    { href: "/contacto", label: t("marketing_nav_help") },
  ]

  return (
    <header className="container mx-auto p-4 border-b border-border/50">
      <nav className="flex justify-between items-center gap-4 flex-wrap">
        <Link href="/" className="flex items-center gap-3 shrink-0">
          <GastrometricsLogo className="h-10 w-10" variant="brand" />
          <span className="text-2xl font-bold text-foreground">Gastrometrics</span>
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
          {!authChecked ? null : isLoggedIn ? (
            <Link href="/dashboard">
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg">{t("marketing_go_to_dashboard")}</Button>
            </Link>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost" className="hover:bg-accent hover:text-accent-foreground">
                  {t("marketing_login")}
                </Button>
              </Link>
              <Link href="/signup">
                <Button className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg">{t("marketing_signup")}</Button>
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  )
}
