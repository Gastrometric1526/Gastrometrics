-- GastroMetrics — pedido explícito del dueño del proyecto: las cuentas que YA EXISTÍAN
-- antes de que existiera la casilla de opt-in (migración 0022) nunca tuvieron
-- oportunidad real de decidir — su valor `false` es solo el default de la columna
-- nueva, no una decisión de nadie. Se les activa product_updates_opt_in = true una
-- sola vez, con la garantía de que pueden desactivarlo en cualquier momento desde
-- Configuración → Notificaciones (mismo toggle que ya existe, ver
-- components/settings-dialog.tsx).
--
-- CORREGIDO tras auditoría de seguridad/cumplimiento de esta misma sesión: la versión
-- original de este archivo hacía `update ... where product_updates_opt_in = false`
-- sin ningún filtro de fecha — eso también habría re-suscrito silenciosamente a
-- cualquier cuenta creada DESPUÉS de 0022 que haya visto la casilla al registrarse y
-- la haya dejado sin marcar a propósito (una decisión real, no un default sin
-- oportunidad de elegir). No hay forma de distinguir ambos casos solo por el valor
-- `false` en la tabla — la única señal disponible es la fecha de creación de la
-- cuenta. Se usa el 2026-09-14 (fecha real del commit que agregó 0022 al
-- repositorio) como corte: cualquier cuenta creada ANTES de esa fecha es, con certeza,
-- anterior a que la casilla existiera. Si 0022 se corrió en Supabase más de un día
-- después de ese commit, ajustar `cutoff_date` abajo a la fecha real en que se pegó y
-- corrió en el SQL Editor, para no dejar ninguna cuenta post-0022 fuera del corte por
-- error en la otra dirección tampoco.
--
-- Esto es exclusivamente un backfill de datos (UPDATE de una sola vez sobre las filas
-- que existan en el momento de correr esto) — NO cambia el comportamiento de registro:
-- las cuentas nuevas siguen viendo la casilla sin marcar por defecto (0022), decisión
-- de negocio ya confirmada ("para que no sea tan molesto"). No hay lógica de "primera
-- vez" que distinga después de este punto — es un solo UPDATE, no un trigger nuevo.
--
-- Cómo aplicar: igual que las migraciones anteriores — pegar completo en el SQL Editor
-- de Supabase y correr. Re-corrible (un UPDATE sobre filas ya en true, o creadas
-- después del corte, no hace nada).

update public.profiles
set product_updates_opt_in = true
where product_updates_opt_in = false
  and created_at < '2026-09-14T00:00:00Z'::timestamptz;
