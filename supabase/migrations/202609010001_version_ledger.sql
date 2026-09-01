-- Punto de partida del historial versionado de RITMO. El esquema previo sigue
-- documentado en supabase/schema.sql; cada cambio posterior vive en una nueva
-- migración y actualiza esta marca de forma idempotente.
create table if not exists public.ritmo_schema_version (
  singleton boolean primary key default true check (singleton),
  version text not null,
  aplicado_en timestamptz not null default now()
);

insert into public.ritmo_schema_version (singleton, version)
values (true, '202609010001')
on conflict (singleton) do update
set version = excluded.version, aplicado_en = now();

alter table public.ritmo_schema_version enable row level security;
revoke all on table public.ritmo_schema_version from anon, authenticated;
