import { PoliticaPrivacidadContent } from "@/components/politica-privacidad-content"

// Política de privacidad real, escrita para reflejar cómo funciona la app HOY (todo el
// almacenamiento es localStorage del navegador, sin backend conectado) y cómo funcionará
// cuando se conecte un backend real (Supabase, ya preparado sin conectar, ver docs/23).
//
// Gastrometrics se ofrece como app internacional (confirmado por el dueño del proyecto),
// así que este documento incorpora los marcos de protección de datos más relevantes por
// región, no solo Centroamérica:
// - UE/EEE y Reino Unido: GDPR / UK GDPR — base legal del tratamiento, derechos de acceso/
//   rectificación/supresión/portabilidad/oposición, plazo de respuesta de 1 mes.
// - California (EE. UU.): CCPA/CPRA — derecho a saber, a eliminar, a no discriminación;
//   Gastrometrics no vende ni comparte datos personales, por lo que el derecho a "opt-out
//   of sale/sharing" no aplica en la práctica.
// - Brasil: LGPD, alineada en estructura con GDPR.
// - Canadá: PIPEDA.
// - Centroamérica: Costa Rica (Ley 8968), Nicaragua (Ley 787) y Panamá (Ley 81 de 2019),
//   los marcos más consolidados de la región donde nace el producto.
// Para cualquier otra jurisdicción no listada explícitamente, aplicamos como piso mínimo
// los principios más protectores de los marcos anteriores.
//
// No sustituye asesoría legal formal de un abogado en las jurisdicciones donde se opere
// antes de operar con usuarios reales — está escrita para ser honesta y verificable contra
// el código, no como plantilla genérica de relleno. [Corchetes] marcan datos que dependen
// de la entidad legal real bajo la que opere el negocio, aún no constituida.
//
// El contenido traducible vive en components/politica-privacidad-content.tsx (Client
// Component, usa useLanguage) porque `export const metadata` de abajo solo es válido
// en un Server Component — este archivo se queda como cascarón de servidor para el
// <title>, y delega todo el JSX real al componente cliente (mismo patrón que
// components/terminos-de-uso-content.tsx, ver docs/45).

export const metadata = {
  title: "Política de Privacidad — Gastrometrics",
}

export default function PoliticaPrivacidadPage() {
  return <PoliticaPrivacidadContent />
}
