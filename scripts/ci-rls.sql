\set ON_ERROR_STOP on
insert into auth.users(id) values('00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000002');
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
reset role;
do $$ begin
  if exists(select 1 from public.nutrition_requests where user_id='00000000-0000-4000-8000-000000000001') then raise exception 'Queda caché nutricional tras el borrado'; end if;
end $$;
