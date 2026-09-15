\set ON_ERROR_STOP on
insert into auth.users(id,email) values
  ('00000000-0000-4000-8000-000000000001','quiquemachadodguez@gmail.com'),
  ('00000000-0000-4000-8000-000000000002','another@example.com');
insert into public.platform_admins(user_id)
values('00000000-0000-4000-8000-000000000001')
on conflict(user_id) do nothing;
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
insert into public.dias(user_id,fecha,habitos) values(auth.uid(),'2026-09-04','{"agua":true}');
update public.perfiles set proteina_objetivo=1.6 where user_id=auth.uid();
insert into storage.objects(bucket_id,name) values('backups',auth.uid()::text || '/latest.json');
select public.model_audit_snapshot('{"edad":30,"alturaCm":180,"sexo":"hombre","kcalObjetivo":2000,"factorActividad":1.375,"umbralRacha":4}'::jsonb,'UTC');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false);
do $$ begin
  if exists(select 1 from public.dias) then raise exception 'RLS: datos de otra cuenta visibles'; end if;
  if exists(select 1 from storage.objects) then raise exception 'RLS: respaldo ajeno visible'; end if;
  if exists(select 1 from public.historial_modelo) then raise exception 'RLS: auditoría de otra cuenta visible'; end if;
  if (select count(*) from public.perfiles) <> 1 then raise exception 'RLS: perfiles no aislados'; end if;
  begin
    insert into public.dias(user_id,fecha) values('00000000-0000-4000-8000-000000000001','2026-09-05');
    raise exception 'RLS: escritura ajena permitida';
  exception when insufficient_privilege then null; end;
  begin
    perform public.claim_nutrition_request(auth.uid(),repeat('a',64));
    raise exception 'Presupuesto accesible desde navegador';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.historial_modelo(user_id,effective_date,perfil)
      values(auth.uid(),current_date,'{}');
    raise exception 'RLS: inserción directa de auditoría permitida';
  exception when insufficient_privilege then null; end;
  begin
    perform public.ritmo_admin_snapshot();
    raise exception 'Administración accesible desde una cuenta normal';
  exception when insufficient_privilege then null; end;
  if public.ritmo_admin_model_cohort() is not null then
    raise exception 'Cohorte del modelo accesible desde una cuenta normal';
  end if;
end $$;
reset role;
update public.nutrition_policy set enabled=true,user_daily=1;
set role service_role;
do $$ declare result jsonb; begin
  result := public.claim_nutrition_request('00000000-0000-4000-8000-000000000001',repeat('a',64));
  if result->>'status' <> 'go' then raise exception 'No permite primera solicitud'; end if;
  result := public.claim_nutrition_request('00000000-0000-4000-8000-000000000001',repeat('a',64));
  if result->>'status' <> 'busy' then raise exception 'No protege duplicados'; end if;
  result := public.claim_nutrition_request('00000000-0000-4000-8000-000000000001',repeat('b',64));
  if result->>'status' <> 'limited' then raise exception 'No protege presupuesto'; end if;
end $$;
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false);
select public.clear_my_nutrition_data();
reset role;
do $$ begin
  if not exists(select 1 from public.nutrition_requests where user_id='00000000-0000-4000-8000-000000000001') then raise exception 'El borrado de privacidad afectó a otra cuenta'; end if;
end $$;
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
select public.clear_my_nutrition_data();
select public.ritmo_admin_snapshot();
select public.ritmo_admin_command('{"type":"feature_state","key":"escenarios","value":"hidden"}'::jsonb);
do $$ begin
  if (public.ritmo_public_config()->'features'->>'escenarios')::boolean then
    raise exception 'La publicación administrativa no gobierna la función';
  end if;
end $$;
select public.ritmo_admin_command('{"type":"feature_state","key":"escenarios","value":"public"}'::jsonb);
select public.ritmo_admin_command('{"type":"user_role","userId":"00000000-0000-4000-8000-000000000002","value":"pilot"}'::jsonb);
reset role;
do $$ begin
  if exists(select 1 from public.nutrition_requests where user_id='00000000-0000-4000-8000-000000000001') then raise exception 'Queda caché nutricional tras el borrado'; end if;
end $$;

set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
do $$
declare
  revision timestamptz;
  accepted boolean;
  i integer;
begin
  -- Un conflicto en la segunda fila revierte también la primera inserción.
  begin
    perform public.ritmo_import_data(
      null,
      '[{"fecha":"2026-09-06","habitos":{},"comidas":[]},{"fecha":"2026-09-04","habitos":{"agua":false},"comidas":[]}]'::jsonb,
      '[]'::jsonb,
      '{"dias:2026-09-06":null,"dias:2026-09-04":null}'::jsonb
    );
    raise exception 'La importación ignoró un conflicto';
  exception when serialization_failure then null;
  end;
  if exists(select 1 from public.dias where fecha='2026-09-06') then raise exception 'La importación conflictiva dejó una fila parcial'; end if;

  select actualizado_en into revision from public.dias where fecha='2026-09-04';
  perform public.ritmo_import_data(
    null,
    '[{"fecha":"2026-09-04","habitos":{"agua":false},"notas":"importación atómica","comidas":[]}]'::jsonb,
    '[]'::jsonb,
    jsonb_build_object('dias:2026-09-04',revision::text)
  );
  if (select notas from public.dias where fecha='2026-09-04') <> 'importación atómica' then raise exception 'No confirmó la importación válida'; end if;

  perform public.ritmo_grant_health_consent('ci-2026-09-15');
  if not public.ritmo_health_consent_status() then raise exception 'No conserva el consentimiento explícito'; end if;
  perform public.ritmo_revoke_health_consent();
  if public.ritmo_health_consent_status() then raise exception 'No retira el consentimiento al borrar la cuenta'; end if;

  for i in 1..20 loop
    accepted := public.ritmo_record_health_event('sync','warning','ci','hoy','otro');
    if not accepted then raise exception 'Límite distribuido adelantado'; end if;
  end loop;
  if public.ritmo_record_health_event('sync','warning','ci','hoy','otro') then raise exception 'Límite distribuido no aplicado'; end if;
end $$;
reset role;
