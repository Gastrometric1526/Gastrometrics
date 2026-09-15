-- GastroMetrics — pedido explícito del dueño del proyecto: las cuentas que YA EXISTÍAN
-- antes de que existiera la casilla de opt-in (migración 0022) nunca tuvieron
-- oportunidad real de decidir — su valor `false` es solo el default de la columna
-- nueva, no una decisión de nadie. Se les activa product_updates_opt_in = true una
-- sola vez, con la garantía de que pueden desactivarlo en cualquier momento desde
-- Configuración → Notificaciones (mismo toggle que ya existe, ver
-- components/settings-dialog.tsx).
--
-- Esto es exclusivamente un backfill de datos (UPDATE de una sola vez sobre las filas
-- que existan en el momento de correr esto) — NO cambia el comportamiento de registro:
-- las cuentas nuevas siguen viendo la casilla sin marcar por defecto (0022), decisión
-- de negocio ya confirmada ("para que no sea tan molesto"). No hay lógica de "primera
-- vez" que distinga después de este punto — es un solo UPDATE, no un trigger nuevo.
--
-- Cómo aplicar: igual que las migraciones anteriores — pegar completo en el SQL Editor
-- de Supabase y correr. Re-corrible (un UPDATE sobre filas ya en true no hace nada).

update public.profiles
set product_updates_opt_in = true
where product_updates_opt_in = false;
