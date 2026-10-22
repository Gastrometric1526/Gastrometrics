import { redirect } from "next/navigation"

/**
 * Invitar y cambiar de plan viven juntos en Mi Plan (docs/181). Se conserva /invita para
 * los enlaces ya repartidos (correos, Novedades, menú) y lleva directo a la sección.
 */
export default function InvitaPage() {
  redirect("/mi-plan#invita")
}
