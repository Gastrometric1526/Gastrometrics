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
  // Cabeceras de seguridad (ver docs/61 para las 5 originales; docs/68 para la CSP,
  // agregada después de auditar qué recursos externos usa de verdad la app: Supabase
  // (fetch directo del navegador a *.supabase.co), y nada más — el checkout de Stripe
  // es 100% redirect de página completa (window.location.href), nunca un iframe ni
  // Stripe.js del lado del cliente (confirmado en docs/61), así que no hace falta
  // ninguna excepción para Stripe acá. Vercel Analytics/Speed Insights se sirven bajo
  // el mismo origen (Vercel los reescribe a una ruta propia, ver docs/66/67 — nunca
  // piden un host externo). next/font (Inter) se auto-hospeda en el build, tampoco pide
  // fonts.googleapis.com en tiempo real.
  //
  // 'unsafe-inline' en script-src/style-src es una decisión deliberada, no un olvido:
  // el propio Next.js (App Router, sin configurar nonces) inyecta scripts inline para
  // la hidratación/streaming de cada página, y este layout tiene un <script
  // dangerouslySetInnerHTML> propio (ver app/layout.tsx, contenido estático sin datos
  // interpolados, ya auditado en docs/61) — bloquearlos con un CSP estricto de nonces
  // es una reescritura de arquitectura aparte (habría que generar el nonce en
  // middleware.ts y propagarlo a cada script), con riesgo real de romper el
  // renderizado en producción sin poder probarlo exhaustivamente. El resto de la
  // política sí es estricta: nada de por defecto, nada de terceros salvo Supabase.
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
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "font-src 'self' data:",
              "connect-src 'self' https://*.supabase.co",
              "frame-src 'none'",
              "frame-ancestors 'self'",
              "base-uri 'self'",
              "form-action 'self'",
              "object-src 'none'",
              "worker-src 'self'",
            ].join("; "),
          },
        ],
      },
    ]
  },
}

export default nextConfig
