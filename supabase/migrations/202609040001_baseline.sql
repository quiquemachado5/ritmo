-- ============================================================================
-- ESQUEMA POSTGRESQL — RITMO
--
-- Migración base: conserva las tablas y filas de instalaciones existentes.
-- Es idempotente: puedes volver a lanzarlo sin romper nada.
--
-- Modelo de seguridad: cada fila lleva `user_id` con FK a auth.users y todas las
-- tablas tienen RLS activo. Las políticas comparan `auth.uid()` con la columna,
-- de modo que la separación entre usuarios la garantiza el motor y no el código.
-- Amplía el esquema de la app anterior con nutrición (comidas), agua, pasos,
-- medidas corporales y los campos de onboarding.
-- ============================================================================

-- ---------------------------------------------------------------- PERFILES
create table if not exists public.perfiles (
  user_id            uuid primary key references auth.users (id) on delete cascade,
  nombre             text,
  altura_cm          smallint     not null default 175 check (altura_cm between 120 and 230),
  edad               smallint     not null default 30  check (edad between 14 and 100),
  sexo               text         not null default 'hombre' check (sexo in ('hombre', 'mujer')),
  objetivo           text         not null default 'perder' check (objetivo in ('perder', 'mantener', 'ganar')),
  peso_objetivo      numeric(5,1) check (peso_objetivo between 35 and 250),
  kcal_objetivo      integer      not null default 2000 check (kcal_objetivo between 900 and 6000),
  proteina_objetivo  integer      check (proteina_objetivo between 0 and 400),
  factor_actividad   numeric(4,3) not null default 1.375 check (factor_actividad between 1.0 and 2.5),
  umbral_racha       smallint     not null default 4 check (umbral_racha between 1 and 10),
  agua_objetivo_ml   integer      default 2500 check (agua_objetivo_ml between 0 and 10000),
  pasos_objetivo     integer      default 8000 check (pasos_objetivo between 0 and 60000),
  onboarding_completo boolean     not null default false,
  creado_en          timestamptz  not null default now(),
  actualizado_en     timestamptz  not null default now()
);

-- Columnas añadidas de forma idempotente (para proyectos ya creados).
alter table public.perfiles add column if not exists nombre text;
alter table public.perfiles add column if not exists objetivo text not null default 'perder';
alter table public.perfiles add column if not exists proteina_objetivo integer;
alter table public.perfiles add column if not exists agua_objetivo_ml integer default 2500;
alter table public.perfiles add column if not exists pasos_objetivo integer default 8000;
alter table public.perfiles add column if not exists onboarding_completo boolean not null default false;

comment on table public.perfiles is
  'Parámetros personales que alimentan IMC, TDEE, macros y proyecciones. Una fila por usuario.';

-- -------------------------------------------------------------------- DÍAS
create table if not exists public.dias (
  id               bigint generated always as identity primary key,
  user_id          uuid        not null references auth.users (id) on delete cascade,
  fecha            date        not null,
  habitos          jsonb       not null default '{}'::jsonb,
  peso             numeric(5,1)  check (peso between 25 and 400),
  kcal_consumidas  integer       check (kcal_consumidas between 0 and 12000),
  kcal_quemadas    integer       check (kcal_quemadas between 0 and 12000),
  grasa_pct        numeric(4,1)  check (grasa_pct between 2 and 70),
  notas            text          check (char_length(notas) <= 2000),
  comidas          jsonb         not null default '[]'::jsonb,
  agua_ml          integer       check (agua_ml between 0 and 20000),
  pasos            integer       check (pasos between 0 and 200000),
  creado_en        timestamptz not null default now(),
  actualizado_en   timestamptz not null default now(),
  constraint dias_usuario_fecha_unica unique (user_id, fecha)
);

alter table public.dias add column if not exists comidas jsonb not null default '[]'::jsonb;
alter table public.dias add column if not exists agua_ml integer;
alter table public.dias add column if not exists pasos integer;

comment on table public.dias is
  'Registro diario: hábitos, peso, energía, comidas, agua y pasos. Un día por usuario y fecha.';

-- Balance calórico neto calculado en la base de datos.
-- Dropear vista primero porque depende de esta columna.


alter table public.dias
  add column if not exists balance_kcal integer
  generated always as (kcal_consumidas - kcal_quemadas) stored;

-- --------------------------------------------------------------- COMPOSICIÓN
create table if not exists public.composicion (
  id                 bigint generated always as identity primary key,
  user_id            uuid        not null references auth.users (id) on delete cascade,
  fecha              date        not null,
  peso               numeric(5,1) not null check (peso between 25 and 400),
  grasa_pct          numeric(4,1) check (grasa_pct between 2 and 70),
  masa_muscular_kg   numeric(5,1) check (masa_muscular_kg between 10 and 200),
  imc                numeric(4,1) check (imc between 8 and 90),
  grasa_visceral     smallint     check (grasa_visceral between 1 and 30),
  metab_basal_kcal   integer      check (metab_basal_kcal between 800 and 4000),
  gasto_diario_kcal  integer      check (gasto_diario_kcal between 900 and 8000),
  masa_osea_kg       numeric(4,1) check (masa_osea_kg between 1 and 10),
  agua_pct           numeric(4,1) check (agua_pct between 20 and 80),
  cintura            numeric(4,1) check (cintura between 30 and 250),
  cadera             numeric(4,1) check (cadera between 30 and 250),
  pecho              numeric(4,1) check (pecho between 30 and 250),
  brazo              numeric(4,1) check (brazo between 10 and 100),
  muslo              numeric(4,1) check (muslo between 20 and 120),
  cuello             numeric(4,1) check (cuello between 20 and 80),
  creado_en          timestamptz not null default now(),
  actualizado_en     timestamptz not null default now(),
  constraint composicion_usuario_fecha_unica unique (user_id, fecha)
);

alter table public.composicion add column if not exists cintura numeric(4,1);
alter table public.composicion add column if not exists cadera  numeric(4,1);
alter table public.composicion add column if not exists pecho   numeric(4,1);
alter table public.composicion add column if not exists brazo   numeric(4,1);
alter table public.composicion add column if not exists muslo   numeric(4,1);
alter table public.composicion add column if not exists cuello  numeric(4,1);

comment on table public.composicion is
  'Mediciones de báscula de bioimpedancia y perímetros. Una por usuario y fecha.';

alter table public.composicion
  add column if not exists masa_grasa_kg numeric(6,2)
  generated always as (round(peso * grasa_pct / 100.0, 2)) stored;
alter table public.composicion
  add column if not exists masa_magra_kg numeric(6,2)
  generated always as (round(peso - (peso * grasa_pct / 100.0), 2)) stored;

-- ------------------------------------------------------------------ ÍNDICES
create index if not exists dias_user_fecha_idx        on public.dias (user_id, fecha desc);
create index if not exists composicion_user_fecha_idx on public.composicion (user_id, fecha desc);
create index if not exists dias_habitos_idx           on public.dias using gin (habitos);

-- --------------------------------------------------- MARCA DE ACTUALIZACIÓN
create or replace function public.tocar_actualizado_en()
returns trigger language plpgsql as $$
begin
  new.actualizado_en = now();
  return new;
end;
$$;

drop trigger if exists dias_actualizado on public.dias;
create trigger dias_actualizado before update on public.dias
  for each row execute function public.tocar_actualizado_en();
drop trigger if exists composicion_actualizado on public.composicion;
create trigger composicion_actualizado before update on public.composicion
  for each row execute function public.tocar_actualizado_en();
drop trigger if exists perfiles_actualizado on public.perfiles;
create trigger perfiles_actualizado before update on public.perfiles
  for each row execute function public.tocar_actualizado_en();

-- ------------------------------------------------- SEGURIDAD A NIVEL DE FILA
alter table public.perfiles    enable row level security;
alter table public.dias        enable row level security;
alter table public.composicion enable row level security;

do $$
declare t text;
begin
  foreach t in array array['perfiles', 'dias', 'composicion'] loop
    execute format('drop policy if exists %I on public.%I', t || '_propias', t);
    execute format($f$
      create policy %I on public.%I
        for all to authenticated
        using (auth.uid() = user_id)
        with check (auth.uid() = user_id)
    $f$, t || '_propias', t);
  end loop;
end;
$$;

-- --------------------------------------------- PERFIL AUTOMÁTICO AL REGISTRAR
create or replace function public.crear_perfil_nuevo_usuario()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfiles (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists al_crear_usuario on auth.users;
create trigger al_crear_usuario after insert on auth.users
  for each row execute function public.crear_perfil_nuevo_usuario();

-- Agregado público y deliberadamente mínimo para la prueba social de la app.
-- No devuelve identificadores ni permite consultar perfiles ajenos.
create or replace function public.ritmo_user_count()
returns integer language sql stable security definer set search_path = public as $$
  select count(*)::integer from public.perfiles where onboarding_completo = true;
$$;
revoke all on function public.ritmo_user_count() from public;
grant execute on function public.ritmo_user_count() to anon, authenticated;

-- ------------------------------------------------------------------ VISTAS
create or replace view public.resumen_mensual
with (security_invoker = true) as
select
  user_id,
  date_trunc('month', fecha)::date       as mes,
  count(*)                               as dias_registrados,
  count(peso)                            as pesajes,
  round(avg(peso), 2)                    as peso_medio,
  min(peso)                              as peso_minimo,
  max(peso)                              as peso_maximo,
  round(avg(kcal_consumidas))            as kcal_medias_consumidas,
  round(avg(balance_kcal))               as balance_medio,
  round(sum(balance_kcal) / 7700.0, 2)   as delta_peso_estimado
from public.dias
group by user_id, date_trunc('month', fecha);

grant select on public.resumen_mensual to authenticated;

-- ============================================================================
-- PREFERENCIAS DE USUARIO (sync entre dispositivos)
-- Biblioteca de comidas y configuración extensible del modelo (hábitos
-- personalizados/reglas). Un blob JSON por usuario: pequeño y last-write-wins.
-- ============================================================================
create table if not exists public.user_prefs (
  user_id        uuid primary key references auth.users (id) on delete cascade,
  meal_prefs     jsonb       not null default '{}'::jsonb,
  actualizado_en timestamptz not null default now()
);

comment on table public.user_prefs is
  'Preferencias sincronizadas: biblioteca de comidas y configuración extensible del modelo.';

alter table public.user_prefs enable row level security;

drop policy if exists user_prefs_propias on public.user_prefs;
create policy user_prefs_propias on public.user_prefs
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================================
-- BACKUPS EN STORAGE
-- Bucket privado donde RITMO sube periódicamente una copia JSON del usuario.
-- Cada usuario solo puede leer/escribir dentro de su carpeta {user_id}/...
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('backups', 'backups', false)
on conflict (id) do nothing;

do $$
declare nombre text;
begin
  foreach nombre in array array[
    'backups_leer', 'backups_subir', 'backups_actualizar', 'backups_borrar'
  ] loop
    execute format('drop policy if exists %I on storage.objects', nombre);
  end loop;
end;
$$;

create policy backups_leer on storage.objects
  for select to authenticated
  using (bucket_id = 'backups' and (storage.foldername(name))[1] = auth.uid()::text);

create policy backups_subir on storage.objects
  for insert to authenticated
  with check (bucket_id = 'backups' and (storage.foldername(name))[1] = auth.uid()::text);

create policy backups_actualizar on storage.objects
  for update to authenticated
  using (bucket_id = 'backups' and (storage.foldername(name))[1] = auth.uid()::text);

create policy backups_borrar on storage.objects
  for delete to authenticated
  using (bucket_id = 'backups' and (storage.foldername(name))[1] = auth.uid()::text);

-- Marca legible por CI/migraciones; no contiene datos de usuario ni se expone
-- a clientes. Las migraciones posteriores deben actualizar este único valor.
create table if not exists public.ritmo_schema_version (
  singleton boolean primary key default true check (singleton),
  version text not null,
  aplicado_en timestamptz not null default now()
);
insert into public.ritmo_schema_version (singleton, version)
values (true, '202609040001')
on conflict (singleton) do update set version = excluded.version, aplicado_en = now();
alter table public.ritmo_schema_version enable row level security;
revoke all on table public.ritmo_schema_version from anon, authenticated;
