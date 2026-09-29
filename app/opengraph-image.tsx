import { ImageResponse } from "next/og"

// Imagen de vista previa al compartir el sitio (WhatsApp, Facebook, LinkedIn, X, Slack…)
// — antes no existía ninguna y los enlaces se veían sin imagen (docs/135). Next la usa
// automáticamente como og:image y twitter:image de todas las rutas que no definan la suya.

export const runtime = "edge"
export const alt = "Gastrometrics — Costeo, fichas técnicas e inventario para restaurantes"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default async function OpengraphImage() {
  // next/og acepta el ArrayBuffer directo como src (no hay Buffer en el runtime edge).
  const logo = await fetch(new URL("../public/icon-512x512.png", import.meta.url)).then((res) => res.arrayBuffer())
  const logoSrc = logo as unknown as string

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#F05324",
          color: "#ffffff",
          padding: "64px 72px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              display: "flex",
              width: 76,
              height: 76,
              borderRadius: 38,
              overflow: "hidden",
              background: "#ffffff",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoSrc} width={76} height={76} alt="" />
          </div>
          <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: -1 }}>Gastrometrics</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 70, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2, maxWidth: 980 }}>
            El costo real de cada plato, sin hojas de cálculo
          </div>
          <div style={{ fontSize: 30, opacity: 0.92, maxWidth: 950 }}>
            Fichas técnicas, precio sugerido, inventario, menús y órdenes de compra para restaurantes.
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 26, fontWeight: 600, opacity: 0.9 }}>
          <div>Gratis para empezar</div>
          <div>gastrometrics.org</div>
        </div>
      </div>
    ),
    size,
  )
}
