/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Cabeceras de seguridad de bajo riesgo (ver docs/61) — ninguna de estas depende de
  // conocer de antemano cada recurso externo que carga la app (a diferencia de una
  // Content-Security-Policy completa, que si se configura mal puede romper algo real
  // sin que se note hasta producción — se dejó fuera a propósito, es candidato a un
  // pase dedicado con pruebas reales, no algo para apurar acá).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Evita que el sitio se cargue dentro de un <iframe> ajeno (clickjacking).
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          // El navegador no debe "adivinar" el tipo de un archivo distinto al que
          // declaró el servidor — cierra una clase de ataque de MIME-sniffing.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Manda el origen completo solo a este mismo sitio; a otros, solo el
          // dominio — evita filtrar rutas internas (ids de negocio, tokens en la URL)
          // en el header Referer de un link saliente.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Esta app no usa cámara/micrófono/ubicación — se lo niega explícitamente a
          // cualquier script, propio o de un tercero que se cuele.
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          // Fuerza HTTPS en cada visita futura una vez que el navegador vio esta
          // cabecera una vez — preload requiere estar en la lista de Chrome, no se
          // pide automáticamente por incluir el header.
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
    ]
  },
}

export default nextConfig
