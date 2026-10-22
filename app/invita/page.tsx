import { redirect } from "next/navigation"

/**
 * Invitar y cambiar de plan viven juntos en Mi Plan (docs/181). Se conserva /invita para
 * los enlaces ya repartidos (correos, Novedades, menú) y lleva directo a la sección.
 */
// Sin esto Next lo prerenderiza como página estática y el 307 sale sin cabecera Location
// (solo redirige cuando corre el JavaScript); dinámico, el servidor redirige de verdad.
export const dynamic = "force-dynamic"

export default function InvitaPage() {
  redirect("/mi-plan#invita")
}
