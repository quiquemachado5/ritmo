-- Importación atómica con control optimista. Todos los registros se confirman
-- en una única transacción PostgreSQL o ninguno queda escrito.
create or replace function public.ritmo_import_data(
  p_profile jsonb,
  p_days jsonb,
  p_measurements jsonb,
  p_expected jsonb
)
returns jsonb
language plpgsql
set search_path = public, pg_temp
as $$
declare
  owner_id uuid := auth.uid();
  profile_row public.perfiles%rowtype;
  day_row public.dias%rowtype;
  measurement_row public.composicion%rowtype;
  expected_revision timestamptz;
  record_key text;
  touched integer;
  profile_count integer := 0;
  day_count integer := 0;
  measurement_count integer := 0;
begin
  if owner_id is null then raise exception 'Sesión requerida' using errcode = '42501'; end if;
  if p_expected is null or jsonb_typeof(p_expected) <> 'object'
    or jsonb_typeof(coalesce(p_days, '[]'::jsonb)) <> 'array'
    or jsonb_typeof(coalesce(p_measurements, '[]'::jsonb)) <> 'array'
    or jsonb_array_length(coalesce(p_days, '[]'::jsonb)) > 20000
    or jsonb_array_length(coalesce(p_measurements, '[]'::jsonb)) > 20000
  then raise exception 'Carga de importación inválida' using errcode = '22023'; end if;

  if p_profile is not null then
    record_key := 'perfiles:perfil';
    if not p_expected ? record_key then raise exception 'Falta revisión de %', record_key using errcode = '22023'; end if;
    select * into profile_row from jsonb_populate_record(null::public.perfiles, p_profile);
    expected_revision := (p_expected ->> record_key)::timestamptz;
    if expected_revision is null then
      insert into public.perfiles(user_id,nombre,altura_cm,edad,sexo,objetivo,peso_objetivo,kcal_objetivo,proteina_objetivo,factor_actividad,umbral_racha,onboarding_completo)
      values(owner_id,profile_row.nombre,profile_row.altura_cm,profile_row.edad,profile_row.sexo,profile_row.objetivo,profile_row.peso_objetivo,profile_row.kcal_objetivo,profile_row.proteina_objetivo,profile_row.factor_actividad,profile_row.umbral_racha,profile_row.onboarding_completo)
      on conflict(user_id) do nothing;
    else
      update public.perfiles set
        nombre=profile_row.nombre,altura_cm=profile_row.altura_cm,edad=profile_row.edad,sexo=profile_row.sexo,objetivo=profile_row.objetivo,
        peso_objetivo=profile_row.peso_objetivo,kcal_objetivo=profile_row.kcal_objetivo,proteina_objetivo=profile_row.proteina_objetivo,
        factor_actividad=profile_row.factor_actividad,umbral_racha=profile_row.umbral_racha,onboarding_completo=profile_row.onboarding_completo
      where user_id=owner_id and actualizado_en=expected_revision;
    end if;
    get diagnostics touched = row_count;
    if touched <> 1 then raise exception 'ritmo_conflict:%', record_key using errcode = '40001'; end if;
    profile_count := 1;
  end if;

  for day_row in select * from jsonb_populate_recordset(null::public.dias, coalesce(p_days, '[]'::jsonb)) loop
    record_key := 'dias:' || day_row.fecha::text;
    if day_row.fecha is null or not p_expected ? record_key then raise exception 'Falta fecha o revisión de día' using errcode = '22023'; end if;
    expected_revision := (p_expected ->> record_key)::timestamptz;
    if expected_revision is null then
      insert into public.dias(user_id,fecha,habitos,peso,kcal_consumidas,kcal_quemadas,grasa_pct,notas,comidas,agua_ml,pasos)
      values(owner_id,day_row.fecha,coalesce(day_row.habitos,'{}'::jsonb),day_row.peso,day_row.kcal_consumidas,day_row.kcal_quemadas,day_row.grasa_pct,day_row.notas,coalesce(day_row.comidas,'[]'::jsonb),day_row.agua_ml,day_row.pasos)
      on conflict(user_id,fecha) do nothing;
    else
      update public.dias set
        habitos=coalesce(day_row.habitos,'{}'::jsonb),peso=day_row.peso,kcal_consumidas=day_row.kcal_consumidas,kcal_quemadas=day_row.kcal_quemadas,
        grasa_pct=day_row.grasa_pct,notas=day_row.notas,comidas=coalesce(day_row.comidas,'[]'::jsonb),agua_ml=day_row.agua_ml,pasos=day_row.pasos
      where user_id=owner_id and fecha=day_row.fecha and actualizado_en=expected_revision;
    end if;
    get diagnostics touched = row_count;
    if touched <> 1 then raise exception 'ritmo_conflict:%', record_key using errcode = '40001'; end if;
    day_count := day_count + 1;
  end loop;

  for measurement_row in select * from jsonb_populate_recordset(null::public.composicion, coalesce(p_measurements, '[]'::jsonb)) loop
    record_key := 'composicion:' || measurement_row.fecha::text;
    if measurement_row.fecha is null or not p_expected ? record_key then raise exception 'Falta fecha o revisión de medición' using errcode = '22023'; end if;
    expected_revision := (p_expected ->> record_key)::timestamptz;
    if expected_revision is null then
      insert into public.composicion(user_id,fecha,peso,grasa_pct,masa_muscular_kg,imc,grasa_visceral,metab_basal_kcal,gasto_diario_kcal,masa_osea_kg,agua_pct,cintura,cadera,pecho,brazo,muslo,cuello)
      values(owner_id,measurement_row.fecha,measurement_row.peso,measurement_row.grasa_pct,measurement_row.masa_muscular_kg,measurement_row.imc,measurement_row.grasa_visceral,measurement_row.metab_basal_kcal,measurement_row.gasto_diario_kcal,measurement_row.masa_osea_kg,measurement_row.agua_pct,measurement_row.cintura,measurement_row.cadera,measurement_row.pecho,measurement_row.brazo,measurement_row.muslo,measurement_row.cuello)
      on conflict(user_id,fecha) do nothing;
    else
      update public.composicion set
        peso=measurement_row.peso,grasa_pct=measurement_row.grasa_pct,masa_muscular_kg=measurement_row.masa_muscular_kg,imc=measurement_row.imc,
        grasa_visceral=measurement_row.grasa_visceral,metab_basal_kcal=measurement_row.metab_basal_kcal,gasto_diario_kcal=measurement_row.gasto_diario_kcal,
        masa_osea_kg=measurement_row.masa_osea_kg,agua_pct=measurement_row.agua_pct,cintura=measurement_row.cintura,cadera=measurement_row.cadera,
        pecho=measurement_row.pecho,brazo=measurement_row.brazo,muslo=measurement_row.muslo,cuello=measurement_row.cuello
      where user_id=owner_id and fecha=measurement_row.fecha and actualizado_en=expected_revision;
    end if;
    get diagnostics touched = row_count;
    if touched <> 1 then raise exception 'ritmo_conflict:%', record_key using errcode = '40001'; end if;
    measurement_count := measurement_count + 1;
  end loop;

  return jsonb_build_object('profile',profile_count,'days',day_count,'measurements',measurement_count);
end
$$;
revoke all on function public.ritmo_import_data(jsonb,jsonb,jsonb,jsonb) from public, anon;
grant execute on function public.ritmo_import_data(jsonb,jsonb,jsonb,jsonb) to authenticated;

-- Evidencia separada del consentimiento explícito necesario antes de guardar
-- peso, composición, comidas y hábitos asociados a una persona identificable.
create table if not exists public.privacy_consents (
  user_id uuid primary key references auth.users(id) on delete cascade,
  notice_version text not null check(char_length(notice_version) between 1 and 32),
  health_tracking boolean not null check(health_tracking),
  granted_at timestamptz not null default now()
);
alter table public.privacy_consents enable row level security;
revoke all on public.privacy_consents from public, anon, authenticated;
create policy privacy_consents_read_own on public.privacy_consents for select to authenticated using(user_id=auth.uid());

create or replace function public.ritmo_grant_health_consent(p_version text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then raise exception 'Sesión requerida' using errcode='42501'; end if;
  if p_version is null or char_length(p_version) not between 1 and 32 then raise exception 'Versión inválida'; end if;
  insert into public.privacy_consents(user_id,notice_version,health_tracking,granted_at)
  values(auth.uid(),p_version,true,now())
  on conflict(user_id) do update set notice_version=excluded.notice_version,health_tracking=true,granted_at=now();
end
$$;
revoke all on function public.ritmo_grant_health_consent(text) from public, anon;
grant execute on function public.ritmo_grant_health_consent(text) to authenticated;

create or replace function public.ritmo_health_consent_status()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists(select 1 from public.privacy_consents where user_id=auth.uid() and health_tracking)
$$;
revoke all on function public.ritmo_health_consent_status() from public, anon;
grant execute on function public.ritmo_health_consent_status() to authenticated;

create or replace function public.ritmo_revoke_health_consent()
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then raise exception 'Sesión requerida' using errcode='42501'; end if;
  delete from public.privacy_consents where user_id=auth.uid();
end
$$;
revoke all on function public.ritmo_revoke_health_consent() from public, anon;
grant execute on function public.ritmo_revoke_health_consent() to authenticated;

-- Evaluación prospectiva agregada. No devuelve filas, fechas ni resultados de
-- una persona y suprime cualquier grupo con menos de cinco participantes.
create or replace function public.ritmo_admin_model_cohort()
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  with paired as (
    select stable.user_id,stable.horizonte_dias,stable.peso stable_weight,stable.minimo stable_min,stable.maximo stable_max,
      candidate.peso candidate_weight,candidate.minimo candidate_min,candidate.maximo candidate_max,day.peso actual_weight
    from public.predicciones_modelo stable
    join public.predicciones_modelo candidate on candidate.user_id=stable.user_id and candidate.fecha_emision=stable.fecha_emision
      and candidate.fecha_objetivo=stable.fecha_objetivo and candidate.horizonte_dias=stable.horizonte_dias
    join public.dias day on day.user_id=stable.user_id and day.fecha=stable.fecha_objetivo and day.peso is not null
    where stable.version_modelo='ritmo-2026-09-v3-liquidos'
      and candidate.version_modelo='ritmo-2026-09-v4-conservador'
      and stable.fecha_objetivo<=current_date
  ), grouped as (
    select horizonte_dias horizon,count(*) pairs,count(distinct user_id) participants,
      round(avg(abs(stable_weight-actual_weight)),3) stable_mae,
      round(avg(abs(candidate_weight-actual_weight)),3) candidate_mae,
      round(100*avg((actual_weight between stable_min and stable_max)::integer),1) stable_coverage,
      round(100*avg((actual_weight between candidate_min and candidate_max)::integer),1) candidate_coverage
    from paired group by horizonte_dias having count(distinct user_id)>=5
  )
  select case when not public.is_ritmo_admin() then null else jsonb_build_object(
    'minimumParticipants',5,
    'observedParticipants',(select count(distinct user_id) from paired),
    'horizons',coalesce((select jsonb_agg(jsonb_build_object(
      'horizon',horizon,'pairs',pairs,'participants',participants,'stableMaeKg',stable_mae,'candidateMaeKg',candidate_mae,
      'stableCoveragePct',stable_coverage,'candidateCoveragePct',candidate_coverage
    ) order by horizon) from grouped),'[]'::jsonb)
  ) end
$$;
revoke all on function public.ritmo_admin_model_cohort() from public, anon;
grant execute on function public.ritmo_admin_model_cohort() to authenticated;

-- Límite distribuido para diagnósticos: la tabla de eventos sigue sin guardar
-- la identidad. El contador técnico se elimina con la cuenta y rota por minuto.
create table if not exists public.platform_health_rate_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  window_start timestamptz not null,
  requests smallint not null check (requests between 1 and 20),
  primary key(user_id, window_start)
);
alter table public.platform_health_rate_limits enable row level security;
revoke all on public.platform_health_rate_limits from public, anon, authenticated;

create or replace function public.ritmo_take_health_slot()
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare
  owner_id uuid := auth.uid();
  bucket timestamptz := date_trunc('minute', now());
  accepted boolean;
begin
  if owner_id is null then return false; end if;
  insert into public.platform_health_rate_limits(user_id,window_start,requests)
  values(owner_id,bucket,1)
  on conflict(user_id,window_start) do update set requests=platform_health_rate_limits.requests+1
    where platform_health_rate_limits.requests < 20
  returning true into accepted;
  delete from public.platform_health_rate_limits where user_id=owner_id and window_start < bucket-interval '1 hour';
  return coalesce(accepted,false);
end
$$;
revoke all on function public.ritmo_take_health_slot() from public, anon, authenticated;

drop function if exists public.ritmo_record_health_event(text,text,text,text,text);
create function public.ritmo_record_health_event(p_event text,p_state text,p_build text,p_route text,p_browser text)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then raise exception 'Sesión requerida' using errcode='42501'; end if;
  if p_event not in ('auth','sync','nutrition','import','ui') or p_state not in ('warning','error') then raise exception 'Evento inválido'; end if;
  if not public.ritmo_take_health_slot() then return false; end if;
  delete from public.platform_health_events where created_at < now()-interval '30 days';
  insert into public.platform_health_events(event,state,build,route,browser)
  values(p_event,p_state,left(coalesce(p_build,'unknown'),20),left(coalesce(p_route,'otra'),24),p_browser);
  return true;
end
$$;
revoke all on function public.ritmo_record_health_event(text,text,text,text,text) from public, anon;
grant execute on function public.ritmo_record_health_event(text,text,text,text,text) to authenticated;

create table if not exists public.platform_web_vitals (
  id bigint generated always as identity primary key,
  metric text not null check(metric in ('CLS','FCP','INP','LCP','TTFB')),
  value numeric(12,3) not null check(value >= 0 and value <= 600000),
  rating text not null check(rating in ('good','needs-improvement','poor')),
  route text not null check(char_length(route) between 1 and 24),
  device text not null check(device in ('mobile','tablet','desktop')),
  navigation_type text not null check(char_length(navigation_type) between 1 and 24),
  build text not null check(char_length(build) between 1 and 20),
  created_at timestamptz not null default now()
);
create index if not exists platform_web_vitals_created_idx on public.platform_web_vitals(created_at desc);
alter table public.platform_web_vitals enable row level security;
revoke all on public.platform_web_vitals from public, anon, authenticated;

create or replace function public.ritmo_record_web_vital(p_metric text,p_value numeric,p_rating text,p_route text,p_device text,p_navigation_type text,p_build text)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then raise exception 'Sesión requerida' using errcode='42501'; end if;
  if p_metric not in ('CLS','FCP','INP','LCP','TTFB') or p_rating not in ('good','needs-improvement','poor')
    or p_device not in ('mobile','tablet','desktop') then raise exception 'Métrica inválida'; end if;
  if not public.ritmo_take_health_slot() then return false; end if;
  delete from public.platform_health_events where created_at < now()-interval '30 days';
  delete from public.platform_web_vitals where created_at < now()-interval '30 days';
  insert into public.platform_web_vitals(metric,value,rating,route,device,navigation_type,build)
  values(p_metric,p_value,p_rating,left(coalesce(p_route,'otra'),24),p_device,left(coalesce(p_navigation_type,'other'),24),left(coalesce(p_build,'unknown'),20));
  return true;
end
$$;
revoke all on function public.ritmo_record_web_vital(text,numeric,text,text,text,text,text) from public, anon;
grant execute on function public.ritmo_record_web_vital(text,numeric,text,text,text,text,text) to authenticated;

create or replace function public.ritmo_admin_health()
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select case when not public.is_ritmo_admin() then null else jsonb_build_object(
    'windowHours',24,
    'total',(select count(*) from public.platform_health_events where created_at>=now()-interval '24 hours'),
    'errors',(select count(*) from public.platform_health_events where created_at>=now()-interval '24 hours' and state='error'),
    'byEvent',(select coalesce(jsonb_object_agg(kind,total),'{}'::jsonb) from (
      select event kind,count(*) total from public.platform_health_events where created_at>=now()-interval '24 hours' group by event
      union all
      select 'performance' kind,count(*) total from public.platform_web_vitals where created_at>=now()-interval '24 hours'
    ) grouped),
    'webVitals',jsonb_build_object(
      'total',(select count(*) from public.platform_web_vitals where created_at>=now()-interval '24 hours'),
      'poor',(select count(*) from public.platform_web_vitals where created_at>=now()-interval '24 hours' and rating='poor'),
      'byMetric',(select coalesce(jsonb_object_agg(metric,average),'{}'::jsonb) from (
        select metric,round(avg(value),2) average from public.platform_web_vitals where created_at>=now()-interval '24 hours' group by metric
      ) vital_groups)
    ),
    'latestBuild',(select build from (
      select build,created_at from public.platform_health_events union all select build,created_at from public.platform_web_vitals
    ) recent order by created_at desc limit 1)
  ) end
$$;

insert into public.ritmo_schema_version(singleton,version) values(true,'202609150001')
on conflict(singleton) do update set version=excluded.version,aplicado_en=now()
where public.ritmo_schema_version.version < excluded.version;
