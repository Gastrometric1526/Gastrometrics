-- GastroMetrics — tabla de perfil de usuario
-- Fase 1 de la migración a Supabase real (ver docs/51 y el plan de esta
-- sesión): reemplaza el `userProfile` que hoy vive en localStorage
-- (lib/types/user.ts, UserProfile) por una fila real por usuario. `email` no
-- se duplica aquí a propósito — ya vive en auth.users, y la sesión de
-- Supabase la expone sin necesidad de otra columna que se pueda desincronizar.
--
-- Cómo aplicar: igual que 0001_init.sql — pegar completo en el SQL Editor de
-- Supabase y correr. Re-corrible (usa if not exists / drop policy if exists).

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  nationality text not null default '',
  currency text not null default '',
  business_type text not null default '',
  business_size text not null default '',
  industry_experience text not null default '',
  email_verified boolean not null default false,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table profiles enable row level security;

-- Cada quien solo ve/edita su propia fila — no hay concepto de "miembro de
-- negocio" aquí, el perfil es de la cuenta, no del negocio.
drop policy if exists "profiles_self_all" on profiles;
create policy "profiles_self_all" on profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);
