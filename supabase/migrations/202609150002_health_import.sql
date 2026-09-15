-- Métricas diarias importadas de fuentes de salud. Los límites impiden
-- duraciones imposibles y mantienen la validación alineada con la aplicación.
alter table public.dias add column if not exists sueno_minutos integer;
alter table public.dias add column if not exists entrenamiento_minutos integer;
alter table public.dias drop constraint if exists dias_sueno_minutos_check;
alter table public.dias add constraint dias_sueno_minutos_check check (sueno_minutos between 0 and 1440);
alter table public.dias drop constraint if exists dias_entrenamiento_minutos_check;
alter table public.dias add constraint dias_entrenamiento_minutos_check check (entrenamiento_minutos between 0 and 1440);

comment on column public.dias.sueno_minutos is 'Minutos de sueño del día importados desde una fuente de salud.';
comment on column public.dias.entrenamiento_minutos is 'Minutos de entrenamiento del día importados desde una fuente de salud.';

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
      insert into public.dias(user_id,fecha,habitos,peso,kcal_consumidas,kcal_quemadas,grasa_pct,notas,comidas,agua_ml,pasos,sueno_minutos,entrenamiento_minutos)
      values(owner_id,day_row.fecha,coalesce(day_row.habitos,'{}'::jsonb),day_row.peso,day_row.kcal_consumidas,day_row.kcal_quemadas,day_row.grasa_pct,day_row.notas,coalesce(day_row.comidas,'[]'::jsonb),day_row.agua_ml,day_row.pasos,day_row.sueno_minutos,day_row.entrenamiento_minutos)
      on conflict(user_id,fecha) do nothing;
    else
      update public.dias set
        habitos=coalesce(day_row.habitos,'{}'::jsonb),peso=day_row.peso,kcal_consumidas=day_row.kcal_consumidas,kcal_quemadas=day_row.kcal_quemadas,
        grasa_pct=day_row.grasa_pct,notas=day_row.notas,comidas=coalesce(day_row.comidas,'[]'::jsonb),agua_ml=day_row.agua_ml,pasos=day_row.pasos,
        sueno_minutos=day_row.sueno_minutos,entrenamiento_minutos=day_row.entrenamiento_minutos
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

insert into public.ritmo_schema_version(singleton,version) values(true,'202609150002')
on conflict(singleton) do update set version=excluded.version,aplicado_en=now()
where public.ritmo_schema_version.version < excluded.version;
