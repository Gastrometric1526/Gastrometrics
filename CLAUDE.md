# GastroMetrics

Sistema de gestión gastronómica (fichas técnicas, costeo, inventario, menús, órdenes de compra) para restaurantes en Centroamérica. Next.js 14 + React 18 + TypeScript + Tailwind + shadcn/ui. Backend real (Supabase) para auth, planes y datos de negocio, verificado de punta a punta contra el proyecto real (ver `docs/52`) — sigue en localStorage solo lo de menor tráfico (equipo, feedback, importación de ventas, Fase 4 sin implementar).

## Antes de tocar nada

Lee, en este orden:
1. `docs/00-README-EMPIEZA-AQUI.md`
2. El documento de auditoría con el número más alto en `docs/` (a la fecha de este commit: `docs/52-migracion-supabase-fase2-3-planes-y-datos-negocio.md`) — es la fuente de verdad sobre qué está hecho, qué falta, y dónde. **No confíes en él sin verificar contra el código real** — es la regla que se ha seguido en todo el proyecto.
3. `docs/12-guia-backend.md` cuando toque conectar un backend real.
4. Para arquitectura/diseño técnico consolidado (no cronológico): `docs/mapa-de-documentacion.md` (índice por tema de todo `docs/`) y `docs/referencia-arquitectura-tecnica.md` (storage, recálculo de precios, sub-recetas, PDF, i18n, PWA, backend, admin, rutas). Se actualizan in-place cuando algo cambia — si tu cambio toca algo que describen, actualízalos ahí además del documento de sesión numerado.

## Primer comando a correr

```bash
npm install && npm run build
```

(El lockfile presente es `package-lock.json`, no `pnpm-lock.yaml` — `pnpm` no está instalado en este entorno. `npm run build` ejecuta lo mismo que pediría `pnpm build`.) Verificado exitoso por primera vez en `docs/29` (`exit code 0`, 33 rutas) — antes de eso el proyecto nunca había pasado un build real. Si vuelve a fallar, compara contra ese documento antes de asumir que es un problema nuevo.

Si el build falla, revisa primero `package.json`: `react`/`react-dom` deben estar en `^18` (Next 14.2.25 no soporta React 19 oficialmente — esto ya causó un error de build real en una sesión anterior, ver `docs/10-build-fix-idiomas-monedas-pdf.md`, sección 1). También revisa cualquier uso nuevo de `useSearchParams()` sin envolver en `<Suspense>` — rompió el build 3 veces antes de corregirse, ver `docs/29`, sección 1.

**Nunca corras `npm run build` con `next dev` activo en la misma carpeta** — corrompe los artefactos que el servidor de dev tiene cargados (404/500 fantasma en el navegador hasta reiniciar). Detén el dev server primero, corre el build, y si vas a seguir probando en vivo después, borra `.next` y reinicia el dev server limpio (ver `docs/30`).

`npm test` corre la suite de pruebas automatizadas (Vitest, ver `docs/29` sección 3) — 20 pruebas sobre aislamiento de storage por negocio, la cascada de recálculo de precios, el redondeo de precio de venta, y el costo promedio ponderado.

## Reglas del proyecto (no negociables, pedidas explícitamente por el dueño)

- **Todo cambio debe quedar documentado** en un nuevo archivo numerado dentro de `docs/` (siguiente número disponible), explicando qué se hizo y en qué archivos/líneas — no como changelog opcional, es un requisito del proyecto. Actualiza el puntero en `docs/00-README-EMPIEZA-AQUI.md` y `docs/08-protocolo-de-continuidad.md` al nuevo documento.
- **Verifica el código real antes de confiar en cualquier documento anterior**, incluido este archivo. Varias sesiones han encontrado fixes reportados como "hechos" que solo estaban aplicados a medias.
- El chequeo de sintaxis manual usado hasta ahora (cuando no hay `node_modules`) requiere la bandera `--ignoreConfig` en `tsc`, o falla en silencio sin revisar nada — ver `docs/11-cierre-sesion-v0-pdfs-verificacion.md`, sección 3, para la historia completa de por qué.

## Decisiones de negocio ya confirmadas (no volver a preguntar)

- Redondeo de precio: un solo redondeo, en precio de venta unitario, hacia el 5 más alto.
- Los seis rubros de costeo son % sobre costo de producción, no sobre precio de venta.
- ISV/impuesto: 0 por defecto, opcional, sin lógica de país específica.
- Escalado de recetas/menús: cantidades de ingredientes siempre redondean hacia arriba.
- Papelera de recetas: 30 días antes de purgar automáticamente.
- Multiusuario: cada quien crea su propia cuenta; el dueño del negocio comparte la suscripción vía link de invitación (pendiente de backend real para implementarse).
- Monedas soportadas: todas las centroamericanas + China + USD + Euro (`lib/currency.ts`).
- Idiomas soportados: español, inglés, danés, francés, portugués, chino — solo texto visible al usuario, no traducción completa de código/datos (`lib/i18n/`).
- Planes de suscripción con bloqueo real de funciones (5 tiers: Foodie/Home Cook/Chef de Partie/Sous Chef/Chef Ejecutivo, ver `docs/33`): catálogo en `lib/plans.ts`, control de acceso en `lib/plan-access.ts` (un plan por cuenta, `localStorage`, sin backend de cobros todavía). No modificar los límites/features de cada plan sin confirmar con el dueño del proyecto — es tabla de precios de negocio, no un detalle técnico.

Ver `docs/01-especificacion-funcional.md` y `docs/04-lineamientos-diseno-negocio.md` para el detalle completo de estas decisiones y su razonamiento.

## Pendientes de mayor tamaño

El backend real está en proceso de conexión, en fases (ver `docs/52`). **Fases 1-3 ya están hechas y verificadas en vivo** (autenticación real, planes de suscripción reales con `account_plans`, e ingredientes/recetas/inventario/menús/órdenes de compra/negocios migrados a Supabase con una caché reactiva en memoria — ver `docs/52` para el patrón usado): las migraciones `0003`-`0005` ya se corrieron contra el proyecto real, y se probó de punta a punta (registro → negocio → ingrediente → receta con cascada de costo, todo confirmado por API contra Supabase). Lo que **sigue en `localStorage` a propósito** (Fase 4, menor prioridad/tráfico): `team.ts`, `feedback.ts`, `sales-imports.ts`. El checkout y el Portal de Cliente de Stripe **sí quedaron conectados de verdad** en `docs/49`, y el plan comprado ahora se aplica del lado del servidor (verificado contra Stripe, no confía en el navegador — ver `docs/52`). El buzón de `/contacto` también manda notificación por correo ahora (Resend, ver `docs/49`), condicionada a que existan las variables de entorno — sin ellas sigue funcionando igual que antes, solo sin el aviso.

Todo lo demás que estaba en la lista de "pulido" ya se cerró (ver `docs/29` para el detalle de cada uno): build real verificado, PWA con instalabilidad confirmada en vivo, `/admin` endurecido dentro de sus límites ya documentados, y una suite de pruebas automatizadas base (`npm test`). Dashboard, Registro, Ficha Técnica, Inventario e Ingredientes ya están completamente traducidos a los 6 idiomas (ver `docs/28`), y a esa lista se sumaron en sesiones posteriores: Negocios, Equipo, Menús, Órdenes de Compra, Estadísticas (ambas pestañas), todo el sitio de marketing/legal (`/`, `/planes`, `/about`, `/contacto`, `/caracteristicas/[slug]`, Términos de Uso, Política de Privacidad), `/admin`, y los diálogos compartidos `menu-wizard.tsx`, `purchase-order-form.tsx`, `pos-sales-import-dialog.tsx`, `finanzas-calculation-dialog.tsx` (ver `docs/44` a `docs/47`). Quedan pantallas internas del dashboard sin cubrir por `lib/i18n/translations.ts` (confirmado al menos un string suelto: "Salir" en `components/sidebar.tsx`) — si se retoma la traducción, verificar primero contra el código real cuáles siguen pendientes antes de asumir la lista completa.
