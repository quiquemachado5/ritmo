-- ============================================================================
-- ESQUEMA POSTGRESQL — Composición
--
-- Ejecútalo entero en el SQL Editor de tu proyecto de Supabase.
-- Es idempotente: puedes volver a lanzarlo sin romper nada.
--
-- Modelo de seguridad: cada fila lleva `user_id` con FK a auth.users y todas
-- las tablas tienen RLS activo. Las políticas comparan `auth.uid()` con la
-- columna, de modo que la separación entre usuarios la garantiza el motor y no
-- el código de la aplicación. Un fallo en el frontend no puede filtrar datos.
-- ============================================================================

-- ---------------------------------------------------------------- PERFILES
create table if not exists public.perfiles (
  user_id          uuid primary key references auth.users (id) on delete cascade,
  altura_cm        smallint     not null default 175 check (altura_cm between 120 and 230),
  edad             smallint     not null default 30  check (edad between 14 and 100),
  sexo             text         not null default 'hombre' check (sexo in ('hombre', 'mujer')),
  peso_objetivo    numeric(5,1) check (peso_objetivo between 35 and 250),
  kcal_objetivo    integer      not null default 1350 check (kcal_objetivo between 900 and 4000),
  factor_actividad numeric(4,3) not null default 1.375 check (factor_actividad between 1.0 and 2.5),
  umbral_racha     smallint     not null default 4 check (umbral_racha between 1 and 10),
  creado_en        timestamptz  not null default now(),
  actualizado_en   timestamptz  not null default now()
);

comment on table public.perfiles is
  'Parámetros personales que alimentan IMC, TDEE y proyecciones. Una fila por usuario.';

-- -------------------------------------------------------------------- DÍAS
-- Un registro por día natural. La restricción UNIQUE(user_id, fecha) es la que
-- hace imposible duplicar un día, algo que un documento JSON no puede impedir.
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
  creado_en        timestamptz not null default now(),
  actualizado_en   timestamptz not null default now(),
  constraint dias_usuario_fecha_unica unique (user_id, fecha)
);

comment on table public.dias is
  'Registro diario: hábitos cumplidos, peso y energía. Un día por usuario y fecha.';

-- Columna calculada: el balance vive en la base de datos, de modo que
-- cualquier consulta o informe use exactamente la misma definición que la app.
alter table public.dias
  drop column if exists balance_kcal;
alter table public.dias
  add column balance_kcal integer
  generated always as (kcal_consumidas - kcal_quemadas) stored;

comment on column public.dias.balance_kcal is
  'Balance calórico neto = consumidas − quemadas. Negativo = déficit.';

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
  creado_en          timestamptz not null default now(),
  actualizado_en     timestamptz not null default now(),
  constraint composicion_usuario_fecha_unica unique (user_id, fecha)
);

comment on table public.composicion is
  'Mediciones de báscula de bioimpedancia. Una por usuario y fecha.';

-- Masa grasa y masa magra derivadas: se calculan una sola vez, aquí.
alter table public.composicion drop column if exists masa_grasa_kg;
alter table public.composicion drop column if exists masa_magra_kg;

alter table public.composicion
  add column masa_grasa_kg numeric(6,2)
  generated always as (round(peso * grasa_pct / 100.0, 2)) stored;

alter table public.composicion
  add column masa_magra_kg numeric(6,2)
  generated always as (round(peso - (peso * grasa_pct / 100.0), 2)) stored;

-- ------------------------------------------------------------------ ÍNDICES
create index if not exists dias_user_fecha_idx        on public.dias (user_id, fecha desc);
create index if not exists composicion_user_fecha_idx on public.composicion (user_id, fecha desc);
create index if not exists dias_habitos_idx           on public.dias using gin (habitos);

-- --------------------------------------------------- MARCA DE ACTUALIZACIÓN
create or replace function public.tocar_actualizado_en()
returns trigger
language plpgsql
as $$
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
declare
  t text;
begin
  foreach t in array array['perfiles', 'dias', 'composicion'] loop
    execute format('drop policy if exists %I on public.%I', t || '_propias', t);
    -- Una única política FOR ALL: leer, insertar, actualizar y borrar quedan
    -- restringidos a las filas cuyo user_id coincide con el usuario de la sesión.
    execute format($f$
      create policy %I on public.%I
        for all
        to authenticated
        using (auth.uid() = user_id)
        with check (auth.uid() = user_id)
    $f$, t || '_propias', t);
  end loop;
end;
$$;

-- --------------------------------------------- PERFIL AUTOMÁTICO AL REGISTRAR
create or replace function public.crear_perfil_nuevo_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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

-- ------------------------------------------------------------------ VISTAS
-- Resumen mensual calculado en la base de datos. La app no lo necesita hoy,
-- pero es exactamente el tipo de consulta que un documento JSON no permite.
create or replace view public.resumen_mensual
with (security_invoker = true)
as
select
  user_id,
  date_trunc('month', fecha)::date                       as mes,
  count(*)                                               as dias_registrados,
  count(peso)                                            as pesajes,
  round(avg(peso), 2)                                    as peso_medio,
  min(peso)                                              as peso_minimo,
  max(peso)                                              as peso_maximo,
  round(avg(kcal_consumidas))                            as kcal_medias_consumidas,
  round(avg(kcal_quemadas))                              as kcal_medias_quemadas,
  round(avg(balance_kcal))                               as balance_medio,
  -- Kilos que explica el balance acumulado del mes, con la regla de 7700 kcal/kg
  round(sum(balance_kcal) / 7700.0, 2)                   as delta_peso_estimado
from public.dias
group by user_id, date_trunc('month', fecha);

comment on view public.resumen_mensual is
  'Agregados por mes. security_invoker hace que respete el RLS de quien consulta.';

grant select on public.resumen_mensual to authenticated;
