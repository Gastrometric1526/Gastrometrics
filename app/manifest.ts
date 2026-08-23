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
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
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
