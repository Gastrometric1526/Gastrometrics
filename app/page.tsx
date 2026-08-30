import type { Metadata } from "next"
import { HomeContent } from "@/components/home-content"

// El contenido traducible vive en components/home-content.tsx (Client Component, usa
// useLanguage) porque `export const metadata` de abajo solo es válido en un Server
// Component — este archivo se queda como cascarón de servidor para el <title>/
// <meta description>, y delega todo el JSX real al componente cliente (mismo patrón
// que components/terminos-de-uso-content.tsx, ver docs/72). El idioma real se resuelve
// del lado del cliente (no hay señal de idioma en el servidor), así que estos
// metadatos solo pueden estar en español — es lo mismo que ve cualquier buscador.
export const metadata: Metadata = {
  title: "Gastrometrics — Costeo, fichas técnicas e inventario para restaurantes",
  description:
    "Calcula el costo real de cada plato, controla tu inventario y arma fichas técnicas sin hojas de cálculo. Gratis para empezar.",
  openGraph: {
    title: "Gastrometrics — Costeo, fichas técnicas e inventario para restaurantes",
    description:
      "Calcula el costo real de cada plato, controla tu inventario y arma fichas técnicas sin hojas de cálculo. Gratis para empezar.",
  },
}

export default function Home() {
  return <HomeContent />
}
