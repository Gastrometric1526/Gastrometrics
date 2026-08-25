# Correos transaccionales · Gastrometrics

6 plantillas HTML email-safe (tablas + estilos inline, 640px, sin CSS externo ni webfonts).
Naranja de marca fijo `#F05324` — el remitente es Gastrometrics, no el tema del negocio.

| Archivo | Disparador | Variables |
|---|---|---|
| 01-confirmacion-correo.html | signup → `/api/auth/welcome-email` | fullName, planName, confirmUrl |
| 02-respuesta-feedback.html | `sendFeedbackReplyEmail` | typeLabel, ticketId, receivedAt, replyTitle, reply, originalMessage, appUrl |
| 03-cambio-contrasena.html | Supabase auth · recovery | email, resetUrl, requestedAt, device |
| 04-invitacion-equipo.html | `/equipo` · inviteTeamMember | ownerName, businessName, scope, tools, pdfAccess, inviteUrl |
| 05-cancelacion-suscripcion.html | Stripe · subscription.deleted | planName, accessUntil, billingPortalUrl |
| 06-cambio-plan.html | `/mi-plan` · subscription.updated | fromPlan, toPlan, fromPrice, toPrice, feature (repetible), nextChargeDate, nextChargeAmount, planUrl |

## Antes de enviar

1. **Logo**: los headers apuntan a `https://gastrometrics.org/email/gm-mono-blanco.png`. Sube `gm-mono-blanco.png` a una URL pública y absoluta (los clientes de correo no cargan rutas relativas ni data URIs en Outlook).
2. **Remitente**: usa `FEEDBACK_NOTIFY_FROM` con el dominio ya verificado (`hola@gastrometrics.org`), no `onboarding@resend.dev`.
3. **Placeholders**: `{{var}}`. Escapa siempre el contenido que venga del usuario (`reply`, `originalMessage`, `businessName`) antes de sustituir, y convierte `\n` en `<br/>`.
4. **Listas repetibles**: en 06 la fila de `{{feature}}` va marcada con un comentario — repetirla por cada item de `unlockedFeatures`.
5. **Bajada de plan**: reusa 06 invirtiendo el orden y cambiando "Se desbloqueó" por "Ya no incluye".

## Reglas de la familia

- Un solo CTA por correo (mejor entregabilidad, menos duda).
- Preheader oculto en cada plantilla: es la línea que se lee en la bandeja.
- Sin imágenes decorativas: solo el logo. Todo el correo se entiende con imágenes bloqueadas.
- Los correos de seguridad (03) no llevan enlace de baja: son obligatorios.
- Tipografía: Archivo con fallback Helvetica/Arial. Outlook cae a Arial por el bloque MSO.
