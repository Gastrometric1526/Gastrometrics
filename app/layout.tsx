import type React from "react"
import type { Metadata, Viewport } from "next"
import { Suspense } from "react"
import { Inter } from "next/font/google"
import "./globals.css" // Ensure this path is correct, usually it's `app/globals.css` or `./globals.css`
import { ThemeProvider } from "@/components/theme-provider"
import { AuthProvider } from "@/contexts/auth-context"
import { LanguageProvider } from "@/contexts/language-context"
import { DashboardProvider } from "@/contexts/dashboard-context"
import { NotificationProvider } from "@/contexts/notification-context"
import { Toaster } from "@/components/ui/toaster"
import { ServiceWorkerRegistration } from "@/components/service-worker-registration"
import { TeamPreviewBanner } from "@/components/team-preview-banner"
import { ThemeInitializer } from "@/components/theme-initializer"

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })

export const metadata: Metadata = {
  title: "GastroMetrics",
  description: "Sistema de gestión gastronómica",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "GastroMetrics",
  },
  icons: {
    // favicon-64 y las variantes claro/oscuro son nuevas (ver docs/36) — antes la
    // pestaña del navegador reutilizaba el ícono de 192px sin variante para modo oscuro.
    icon: [
      { url: "/favicon-64.png", sizes: "64x64", type: "image/png" },
      { url: "/icon-light-32x32.png", sizes: "32x32", type: "image/png", media: "(prefers-color-scheme: light)" },
      { url: "/icon-dark-32x32.png", sizes: "32x32", type: "image/png", media: "(prefers-color-scheme: dark)" },
      { url: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
}

// viewport-fit=cover + los paddings de env(safe-area-inset-*) en globals.css son lo que
// hace que la app respete los márgenes reales de cada dispositivo (notch, isla dinámica,
// barra de gestos) en vez de que el contenido quede debajo de esas zonas. Ver
// 09-sesion-continuidad.md.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#0a0a0a",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${inter.variable} ${inter.className}`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <AuthProvider>
            <LanguageProvider>
              <DashboardProvider>
                <NotificationProvider>
                  <Suspense fallback={null}>
                    <ThemeInitializer />
                  </Suspense>
                  <ServiceWorkerRegistration />
                  <TeamPreviewBanner />
                  <main className="flex min-h-screen flex-col">
                    {" "}
                    {/* Ensure main takes full height and allows scrolling */}
                    <div
                      className="flex-1 p-2 sm:p-4 md:p-6 lg:p-8 overflow-y-auto"
                      style={{
                        paddingLeft: "max(env(safe-area-inset-left), 0.5rem)",
                        paddingRight: "max(env(safe-area-inset-right), 0.5rem)",
                        paddingTop: "max(env(safe-area-inset-top), 0.5rem)",
                        paddingBottom: "max(env(safe-area-inset-bottom), 0.5rem)",
                      }}
                    >
                      {children}
                    </div>
                  </main>
                  <Toaster />
                </NotificationProvider>
              </DashboardProvider>
            </LanguageProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
