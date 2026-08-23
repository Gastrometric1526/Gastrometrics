import { TerminosDeUsoContent } from "@/components/terminos-de-uso-content"

// Documento ampliado para una app internacional (ver docs de continuidad): incorpora
// las clausulas de proteccion estandar en SaaS internacional (limitacion de
// responsabilidad, indemnizacion, ley aplicable, resolucion de disputas, fuerza mayor,
// divisibilidad) que faltaban en la version anterior. [Corchetes] marcan datos que
// dependen de la entidad legal real bajo la que opere el negocio (razon social, pais
// de constitucion, direccion) — el dueño del proyecto confirmó que aún no existe una
// entidad registrada; hay que completarlos antes de un lanzamiento comercial real.
//
// Sección 7 y 10 reforzadas en una sesión posterior, a pedido explícito del dueño:
// "no quiero que nadie venga a decir que su negocio fracasó por el uso de la app".
// Investigado antes de escribir (no es plantilla genérica):
// - Dinezy (competidor directo, software de costeo/inventario para restaurantes) usa
//   casi textualmente "for informational purposes only and do not constitute
//   professional advice" para sus cálculos de costo — mismo patrón ya usado por WISK,
//   otra herramienta de food cost. Sección 7 ahora refleja ese mismo estándar de la
//   industria, más una cláusula explícita de que el usuario asume el riesgo normal de
//   operar un negocio (proveedores, personal, demanda, competencia) independientemente
//   de la app.
// - La Ley de Protección al Consumidor de Honduras (jurisdicción de origen del
//   producto) declara "por no convenidas" las cláusulas que limiten la responsabilidad
//   por daños de forma amplia — un bloqueo total de responsabilidad sin excepciones
//   corre el riesgo real de que un tribunal anule la cláusula COMPLETA en vez de
//   aplicarla parcialmente. La práctica estándar en SaaS (confirmada en múltiples
//   fuentes legales) es dejar fuera del límite los casos que ninguna jurisdicción
//   permite excluir: negligencia grave, dolo/mala fe y fraude — sección 10 ahora
//   incluye ese carve-out explícito, lo que hace la cláusula más robusta, no menos
//   protectora, porque reduce el riesgo de que se invalide entera.
// Este documento no sustituye asesoría legal formal de un abogado en las
// jurisdicciones donde se opere — en especial antes de un lanzamiento comercial real,
// conviene que un abogado local revise esta versión.
//
// El contenido traducible vive en components/terminos-de-uso-content.tsx (Client
// Component, usa useLanguage) porque `export const metadata` de abajo solo es válido
// en un Server Component — este archivo se queda como cascarón de servidor para el
// <title>, y delega todo el JSX real al componente cliente.

export const metadata = {
  title: "Términos de Uso — Gastrometrics",
}

export default function TerminosDeUsoPage() {
  return <TerminosDeUsoContent />
}
