-- Presupuesto y caché privados, compartidos por todas las instancias de Vercel.
create table public.nutrition_policy (
  singleton boolean primary key default true check(singleton),
  enabled boolean not null default false,
  user_daily integer not null default 30 check(user_daily between 1 and 100),
  global_daily integer not null default 300 check(global_daily between 1 and 10000)
);
insert into public.nutrition_policy(singleton) values(true);
create table public.nutrition_usage (
  day date not null,
  scope text not null,
  count integer not null default 0,
  primary key(day, scope)
);
create table public.nutrition_requests (
  user_id uuid not null references auth.users(id) on delete cascade,
  hash text not null,
  lease uuid not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  result jsonb,
  primary key(user_id, hash)
);
alter table public.nutrition_policy enable row level security;
alter table public.nutrition_usage enable row level security;
alter table public.nutrition_requests enable row level security;
revoke all on public.nutrition_policy, public.nutrition_usage, public.nutrition_requests from anon, authenticated;
grant all on public.nutrition_policy, public.nutrition_usage, public.nutrition_requests to service_role;

create function public.claim_nutrition_request(p_user uuid, p_hash text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  policy public.nutrition_policy;
  cached public.nutrition_requests;
  today date := (now() at time zone 'UTC')::date;
  user_count integer;
  total_count integer;
  token uuid := gen_random_uuid();
begin
  if p_hash !~ '^[a-f0-9]{64}$' then raise exception 'invalid hash'; end if;
  select * into policy from public.nutrition_policy where singleton;
  if not coalesce(policy.enabled, false) then return jsonb_build_object('status','disabled'); end if;
  if not exists(select 1 from public.perfiles where user_id = p_user and edad >= 18) then
    return jsonb_build_object('status','ineligible');
  end if;
  perform pg_advisory_xact_lock(hashtext('ritmo:nutrition:budget'));
  -- TTL real: no se conserva la descripción original y las respuestas caducan.
  delete from public.nutrition_requests where expires_at < now();
  delete from public.nutrition_usage where day < today - 2;
  select * into cached from public.nutrition_requests where user_id = p_user and hash = p_hash;
  if found then
    if cached.result is not null then return jsonb_build_object('status','cached','result',cached.result); end if;
    return jsonb_build_object('status','busy');
  end if;
  select count into user_count from public.nutrition_usage where day = today and scope = p_user::text;
  select count into total_count from public.nutrition_usage where day = today and scope = 'global';
  if coalesce(user_count,0) >= policy.user_daily or coalesce(total_count,0) >= policy.global_daily then
    return jsonb_build_object('status','limited');
  end if;
  insert into public.nutrition_usage(day,scope,count) values(today,p_user::text,1),(today,'global',1)
    on conflict(day,scope) do update set count = nutrition_usage.count + 1;
  insert into public.nutrition_requests(user_id,hash,lease,expires_at) values(p_user,p_hash,token,now()+interval '90 seconds');
  return jsonb_build_object('status','go','lease',token);
end;
$$;
revoke all on function public.claim_nutrition_request(uuid,text) from public, anon, authenticated;
grant execute on function public.claim_nutrition_request(uuid,text) to service_role;

-- La acción de privacidad solo puede limpiar datos de la sesión que llama.
create function public.clear_my_nutrition_data()
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare owner_id uuid := auth.uid();
begin
  if owner_id is null then raise exception 'authentication required'; end if;
  delete from public.nutrition_requests where user_id = owner_id;
  -- Conservamos el contador agregado sin identificador para evitar eludir el
  -- presupuesto global. El contador individual caduca con la purga habitual.
end;
$$;
revoke all on function public.clear_my_nutrition_data() from public, anon;
grant execute on function public.clear_my_nutrition_data() to authenticated;
update public.ritmo_schema_version set version = '202609040003', aplicado_en = now() where singleton;
