import type { MetadataRoute } from "next"

// Manifest de PWA — ver 09-sesion-continuidad.md. Next.js sirve esto automáticamente
// en /manifest.webmanifest. Junto con el service worker en public/sw.js y su registro
// en app/layout.tsx, esto es lo que permite "Agregar a pantalla de inicio" tanto en
// Android/Chrome como en iOS/Safari.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GastroMetrics",
    short_name: "GastroMetrics",
    description: "Sistema de gestión gastronómica: fichas técnicas, costeo, inventario y menús.",
    start_url: "/dashboard",
    display: "standalone",
    // BUG CORREGIDO: era "#0a0a0a" (casi negro) — la pantalla de carga que Android
    // muestra con el logo mientras la PWA instalada arranca usa background_color, no
    // el fondo real de la app. Reportado en vivo: el logo aparecía sobre fondo negro
    // en vez de blanco. Ver también themeColor en app/layout.tsx (mismo fix, controla
    // la barra de estado/status bar).
    background_color: "#ffffff",
    theme_color: "#ffffff",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        // Ícono maskable real (ver docs/36): el logo dentro de la zona segura de 40% que
        // Android exige, en vez de reutilizar el ícono normal — antes no existía, y
        // Android recortaba el círculo del logo al aplicar su propia máscara redonda.
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  }
}
