-- Autocontenida sobre perfiles/dias/composicion existentes. No requiere tablas
-- de IA ni modifica registros, permisos o políticas de esas tablas anteriores.
create table if not exists public.ritmo_schema_version (
  singleton boolean primary key default true check (singleton),
  version text not null,
  aplicado_en timestamptz not null default now()
);
alter table public.ritmo_schema_version enable row level security;
revoke all on public.ritmo_schema_version from public, anon, authenticated;

-- Pronósticos prospectivos: sellados por el servidor y nunca sobrescritos.
create table public.historial_modelo (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  effective_from timestamptz not null default clock_timestamp(),
  effective_date date not null,
  perfil jsonb not null check (jsonb_typeof(perfil) = 'object' and octet_length(perfil::text) <= 24000)
);
create index historial_modelo_usuario_fecha on public.historial_modelo(user_id, effective_from);
create table public.predicciones_modelo (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  emitida_en timestamptz not null default clock_timestamp(),
  fecha_emision date not null,
  fecha_objetivo date not null,
  horizonte_dias integer not null check (horizonte_dias in (1,3,7,30)),
  peso numeric(6,2) not null check (peso between 20 and 500),
  minimo numeric(6,2) not null check (minimo between 0 and 500),
  maximo numeric(6,2) not null check (maximo between 20 and 600),
  peso_base numeric(6,2) not null check (peso_base between 20 and 500),
  fecha_base date not null,
  version_modelo text not null check (char_length(version_modelo) between 1 and 80),
  configuracion_id uuid not null references public.historial_modelo(id),
  dias_utilizados integer not null check (dias_utilizados between 0 and 100000),
  pesajes_utilizados integer not null check (pesajes_utilizados between 1 and 100000),
  check (minimo <= peso and peso <= maximo),
  check (fecha_objetivo = fecha_emision + horizonte_dias and fecha_base <= fecha_emision),
  unique(user_id, fecha_emision, horizonte_dias)
);
create index predicciones_modelo_usuario_fecha on public.predicciones_modelo(user_id, emitida_en);
alter table public.historial_modelo enable row level security;
alter table public.predicciones_modelo enable row level security;
revoke all on public.historial_modelo, public.predicciones_modelo from public, anon, authenticated;
grant select on public.historial_modelo, public.predicciones_modelo to authenticated;
create policy historial_modelo_lectura_propia on public.historial_modelo for select to authenticated using (user_id = auth.uid());
create policy predicciones_modelo_lectura_propia on public.predicciones_modelo for select to authenticated using (user_id = auth.uid());

create function public.model_audit_snapshot(p_perfil jsonb, p_zona text default 'UTC')
returns public.historial_modelo language plpgsql security definer set search_path = public, pg_temp as $$
declare owner_id uuid := auth.uid(); previous public.historial_modelo; result public.historial_modelo; observed_at timestamptz;
begin
  if owner_id is null then raise exception 'authentication required'; end if;
  if not exists(select 1 from pg_timezone_names where name=p_zona) then raise exception 'invalid timezone'; end if;
  if jsonb_typeof(p_perfil) is distinct from 'object' or octet_length(p_perfil::text)>24000
    or not (p_perfil ?& array['edad','alturaCm','sexo','kcalObjetivo','factorActividad','umbralRacha'])
    or jsonb_typeof(p_perfil->'edad') is distinct from 'number'
    or jsonb_typeof(p_perfil->'alturaCm') is distinct from 'number'
    or jsonb_typeof(p_perfil->'kcalObjetivo') is distinct from 'number'
    or jsonb_typeof(p_perfil->'factorActividad') is distinct from 'number'
    or jsonb_typeof(p_perfil->'umbralRacha') is distinct from 'number'
    or jsonb_typeof(p_perfil->'sexo') is distinct from 'string'
    or (p_perfil->>'edad')::numeric not between 18 and 120
    or (p_perfil->>'alturaCm')::numeric not between 100 and 250
    or (p_perfil->>'kcalObjetivo')::numeric not between 800 and 6000
    or (p_perfil->>'sexo') not in ('hombre','mujer')
    or (p_perfil->>'factorActividad')::numeric not between 1 and 2.5
    then raise exception 'invalid model profile'; end if;
  perform pg_advisory_xact_lock(hashtext('ritmo:model:' || owner_id::text));
  select * into previous from public.historial_modelo where user_id=owner_id order by effective_from desc, id desc limit 1;
  if found and previous.perfil = p_perfil then return previous; end if;
  if (select count(*) from public.historial_modelo where user_id=owner_id and effective_from >= now()-interval '24 hours') >= 100
    then raise exception 'too many profile changes today'; end if;
  observed_at := clock_timestamp();
  -- No fecha aportada por cliente: no se pueden fabricar versiones antiguas.
  insert into public.historial_modelo(user_id,effective_from,effective_date,perfil)
    values(owner_id,observed_at,(observed_at at time zone p_zona)::date,p_perfil) returning * into result;
  return result;
end;
$$;

create function public.model_audit_forecast(p_fecha date, p_zona text, p_predicciones jsonb, p_configuracion uuid)
returns setof public.predicciones_modelo language plpgsql security definer set search_path = public, pg_temp as $$
declare owner_id uuid := auth.uid(); config_id uuid; forecast jsonb; target_date date; horizon integer; issued_at timestamptz;
begin
  if owner_id is null then raise exception 'authentication required'; end if;
  if not exists(select 1 from pg_timezone_names where name=p_zona) then raise exception 'invalid timezone'; end if;
  if jsonb_typeof(p_predicciones) is distinct from 'array' or jsonb_array_length(p_predicciones) not between 1 and 4
    then raise exception 'invalid forecasts'; end if;
  perform pg_advisory_xact_lock(hashtext('ritmo:model:' || owner_id::text));
  issued_at := clock_timestamp();
  if p_fecha is null or p_fecha <> (issued_at at time zone p_zona)::date then raise exception 'emission date must be today'; end if;
  select id into config_id from public.historial_modelo where user_id=owner_id order by effective_from desc, id desc limit 1;
  if config_id is null then raise exception 'profile snapshot required'; end if;
  if p_configuracion is distinct from config_id then raise exception 'profile snapshot changed; reload before forecasting'; end if;
  for forecast in select value from jsonb_array_elements(p_predicciones) loop
    horizon := (forecast->>'horizonteDias')::integer;
    if horizon is null or horizon not in (1,3,7,30) then raise exception 'invalid horizon'; end if;
    target_date := p_fecha + horizon;
    if exists(select 1 from public.dias where user_id=owner_id and fecha=target_date and peso is not null)
      or exists(select 1 from public.composicion where user_id=owner_id and fecha=target_date) then
      continue; -- Un peso ya registrado no es una prueba prospectiva.
    end if;
    insert into public.predicciones_modelo(user_id,emitida_en,fecha_emision,fecha_objetivo,horizonte_dias,peso,minimo,maximo,peso_base,fecha_base,version_modelo,configuracion_id,dias_utilizados,pesajes_utilizados)
      values(owner_id,issued_at,p_fecha,target_date,horizon,(forecast->>'peso')::numeric,(forecast->>'minimo')::numeric,
        (forecast->>'maximo')::numeric,(forecast->>'pesoBase')::numeric,(forecast->>'fechaBase')::date,
        forecast->>'versionModelo',config_id,(forecast->>'diasUtilizados')::integer,(forecast->>'pesajesUtilizados')::integer)
      on conflict(user_id,fecha_emision,horizonte_dias) do nothing;
  end loop;
  return query select * from public.predicciones_modelo where user_id=owner_id and fecha_emision=p_fecha order by horizonte_dias;
end;
$$;

create function public.clear_my_model_audit()
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare owner_id uuid := auth.uid();
begin
  if owner_id is null then raise exception 'authentication required'; end if;
  perform pg_advisory_xact_lock(hashtext('ritmo:model:' || owner_id::text));
  delete from public.predicciones_modelo where user_id=owner_id;
  delete from public.historial_modelo where user_id=owner_id;
end;
$$;
revoke all on function public.model_audit_snapshot(jsonb,text), public.model_audit_forecast(date,text,jsonb,uuid), public.clear_my_model_audit() from public, anon;
grant execute on function public.model_audit_snapshot(jsonb,text), public.model_audit_forecast(date,text,jsonb,uuid), public.clear_my_model_audit() to authenticated;
insert into public.ritmo_schema_version(singleton,version) values(true,'202609040004')
  on conflict(singleton) do update set version=excluded.version, aplicado_en=now()
  where ritmo_schema_version.version < excluded.version;
