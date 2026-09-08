-- Permite sellar, en la misma emisión, el modelo estable y un candidato en
-- sombra. Ambos ven exactamente los mismos datos y solo difiere el algoritmo.
alter table public.predicciones_modelo
  drop constraint if exists predicciones_modelo_user_id_fecha_emision_horizonte_dias_key;
alter table public.predicciones_modelo
  add constraint predicciones_modelo_emision_version_unica
  unique(user_id, fecha_emision, horizonte_dias, version_modelo);

create or replace function public.model_audit_forecast(p_fecha date, p_zona text, p_predicciones jsonb, p_configuracion uuid)
returns setof public.predicciones_modelo language plpgsql security definer set search_path = public, pg_temp as $$
declare owner_id uuid := auth.uid(); config_id uuid; forecast jsonb; target_date date; horizon integer; issued_at timestamptz;
begin
  if owner_id is null then raise exception 'authentication required'; end if;
  if not exists(select 1 from pg_timezone_names where name=p_zona) then raise exception 'invalid timezone'; end if;
  if jsonb_typeof(p_predicciones) is distinct from 'array' or jsonb_array_length(p_predicciones) not between 1 and 8
    then raise exception 'invalid forecasts'; end if;
  if (select count(distinct value->>'versionModelo') from jsonb_array_elements(p_predicciones)) > 2
    then raise exception 'too many model variants'; end if;
  perform pg_advisory_xact_lock(hashtext('ritmo:model:' || owner_id::text));
  issued_at := clock_timestamp();
  if p_fecha is null or p_fecha <> (issued_at at time zone p_zona)::date then raise exception 'emission date must be today'; end if;
  select id into config_id from public.historial_modelo where user_id=owner_id order by effective_from desc, id desc limit 1;
  if config_id is null then raise exception 'profile snapshot required'; end if;
  if p_configuracion is distinct from config_id then raise exception 'profile snapshot changed; reload before forecasting'; end if;
  for forecast in select value from jsonb_array_elements(p_predicciones) loop
    horizon := (forecast->>'horizonteDias')::integer;
    if horizon is null or horizon not in (1,3,7,30) then raise exception 'invalid horizon'; end if;
    if forecast->>'versionModelo' not in ('ritmo-2026-09-v3-liquidos','ritmo-2026-09-v4-conservador')
      then raise exception 'unknown model version'; end if;
    target_date := p_fecha + horizon;
    if exists(select 1 from public.dias where user_id=owner_id and fecha=target_date and peso is not null)
      or exists(select 1 from public.composicion where user_id=owner_id and fecha=target_date) then continue; end if;
    insert into public.predicciones_modelo(user_id,emitida_en,fecha_emision,fecha_objetivo,horizonte_dias,peso,minimo,maximo,peso_base,fecha_base,version_modelo,configuracion_id,dias_utilizados,pesajes_utilizados)
      values(owner_id,issued_at,p_fecha,target_date,horizon,(forecast->>'peso')::numeric,(forecast->>'minimo')::numeric,
        (forecast->>'maximo')::numeric,(forecast->>'pesoBase')::numeric,(forecast->>'fechaBase')::date,
        forecast->>'versionModelo',config_id,(forecast->>'diasUtilizados')::integer,(forecast->>'pesajesUtilizados')::integer)
      on conflict(user_id,fecha_emision,horizonte_dias,version_modelo) do nothing;
  end loop;
  return query select * from public.predicciones_modelo where user_id=owner_id and fecha_emision=p_fecha order by version_modelo,horizonte_dias;
end;
$$;

insert into public.ritmo_schema_version(singleton,version) values(true,'202609080001')
  on conflict(singleton) do update set version=excluded.version, aplicado_en=now()
  where ritmo_schema_version.version < excluded.version;
