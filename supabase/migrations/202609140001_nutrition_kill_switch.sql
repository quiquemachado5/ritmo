-- Parada de emergencia del motor nutricional. Reutiliza el sistema de
-- audiencias y auditoría existente: no añade acceso a datos personales.
insert into public.platform_features(key,label,description,state,sort_order) values
  ('nutrition_engine','Motor nutricional','Permite pausar el análisis de comidas conservando los borradores de cada persona.','public',5)
on conflict (key) do update set label=excluded.label, description=excluded.description, sort_order=excluded.sort_order;

create table if not exists public.platform_health_events (
  id bigint generated always as identity primary key,
  event text not null check (event in ('auth','sync','nutrition','import','ui')),
  state text not null check (state in ('warning','error')),
  build text not null check (char_length(build) between 1 and 20),
  route text not null check (char_length(route) between 1 and 24),
  browser text not null check (browser in ('chrome','safari','firefox','edge','otro')),
  created_at timestamptz not null default now()
);
create index if not exists platform_health_events_created_idx on public.platform_health_events(created_at desc);
alter table public.platform_health_events enable row level security;
revoke all on public.platform_health_events from public, anon, authenticated;

create or replace function public.ritmo_record_health_event(p_event text,p_state text,p_build text,p_route text,p_browser text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then raise exception 'Sesión requerida' using errcode='42501'; end if;
  if p_event not in ('auth','sync','nutrition','import','ui') or p_state not in ('warning','error') then raise exception 'Evento inválido'; end if;
  insert into public.platform_health_events(event,state,build,route,browser)
  values(p_event,p_state,left(coalesce(p_build,'unknown'),20),left(coalesce(p_route,'otra'),24),p_browser);
end
$$;

create or replace function public.ritmo_admin_health()
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select case when not public.is_ritmo_admin() then null else jsonb_build_object(
    'windowHours',24,
    'total',(select count(*) from public.platform_health_events where created_at>=now()-interval '24 hours'),
    'errors',(select count(*) from public.platform_health_events where created_at>=now()-interval '24 hours' and state='error'),
    'byEvent',(select coalesce(jsonb_object_agg(kind,total),'{}'::jsonb) from (
      select event kind,count(*) total from public.platform_health_events where created_at>=now()-interval '24 hours' group by event
    ) grouped),
    'latestBuild',(select build from public.platform_health_events order by created_at desc limit 1)
  ) end
$$;

revoke all on function public.ritmo_record_health_event(text,text,text,text,text), public.ritmo_admin_health() from public, anon;
grant execute on function public.ritmo_record_health_event(text,text,text,text,text), public.ritmo_admin_health() to authenticated;

insert into public.ritmo_schema_version(singleton,version) values(true,'202609140001')
on conflict(singleton) do update set version=excluded.version,aplicado_en=now()
where public.ritmo_schema_version.version < excluded.version;
