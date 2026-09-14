-- Estado mínimo y público para comprobar que código y base de datos avanzan
-- juntos. No expone tablas, usuarios, actividad ni datos de salud.
create or replace function public.ritmo_public_runtime_status()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'databaseVersion', (select version from public.ritmo_schema_version where singleton = true),
    'nutritionEngine', coalesce((select state <> 'hidden' from public.platform_features where key = 'nutrition_engine'), true)
  )
$$;

revoke all on function public.ritmo_public_runtime_status() from public;
grant execute on function public.ritmo_public_runtime_status() to anon, authenticated;

insert into public.ritmo_schema_version(singleton,version) values(true,'202609140002')
on conflict(singleton) do update set version=excluded.version,aplicado_en=now()
where public.ritmo_schema_version.version < excluded.version;
