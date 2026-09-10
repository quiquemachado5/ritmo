-- Administración de RITMO. Ninguna función devuelve datos de salud: solo
-- metadatos de cuenta, configuración de producto y agregados operativos.

create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.platform_pilots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.platform_features (
  key text primary key check (key ~ '^[a-z0-9_]{2,48}$'),
  label text not null check (char_length(label) between 2 and 80),
  description text not null check (char_length(description) between 2 and 240),
  state text not null default 'public' check (state in ('hidden','pilot','public')),
  sort_order smallint not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create table if not exists public.platform_control (
  singleton boolean primary key default true check (singleton),
  weight_model_mode text not null default 'automatic' check (weight_model_mode in ('automatic','stable','candidate')),
  announcement_enabled boolean not null default false,
  announcement_text text not null default '' check (char_length(announcement_text) <= 180),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create table if not exists public.platform_admin_audit (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (char_length(action) between 2 and 80),
  target_id uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists platform_admin_audit_created_idx on public.platform_admin_audit(created_at desc);

alter table public.platform_admins enable row level security;
alter table public.platform_pilots enable row level security;
alter table public.platform_features enable row level security;
alter table public.platform_control enable row level security;
alter table public.platform_admin_audit enable row level security;
revoke all on public.platform_admins, public.platform_pilots, public.platform_features, public.platform_control, public.platform_admin_audit from public, anon, authenticated;
revoke all on function public.ritmo_user_count() from public, anon, authenticated;

-- Propietario inicial confirmado para esta instalación. El rol puede delegarse
-- después desde el propio panel, sin convertir el correo en una clave secreta.
insert into public.platform_admins(user_id)
select id from auth.users where lower(email) = 'quiquemachadodguez@gmail.com'
on conflict (user_id) do nothing;

insert into public.platform_control(singleton) values(true)
on conflict (singleton) do nothing;

insert into public.platform_features(key,label,description,state,sort_order) values
  ('interfaz_viva','Interfaz viva','Adapta la atmósfera visual al ritmo reciente.','public',10),
  ('rescate_automatico','Rescate automático','Reduce Hoy a una única acción tras varios días flojos.','public',20),
  ('detector_avanzado','Detector de señales','Muestra asociaciones repetidas entre hábitos y evolución.','public',30),
  ('escenarios','Escenarios de peso','Compara horizontes manteniendo distintos niveles de hábitos.','public',40),
  ('memoria_corporal','Memoria corporal','Compara etapas anteriores al volver a un peso conocido.','public',50),
  ('modo_invisible','Lecturas en segundo plano','Aparta de Hoy las lecturas estables que no requieren acción.','public',60)
on conflict (key) do update set label=excluded.label, description=excluded.description, sort_order=excluded.sort_order;

create or replace function public.ritmo_mask_email(value text)
returns text language sql immutable set search_path = public, pg_temp as $$
  select case
    when value is null or position('@' in value) = 0 then 'cuenta protegida'
    else left(split_part(value,'@',1),1)
      || repeat('•',least(8,greatest(2,length(split_part(value,'@',1))-1)))
      || '@' || split_part(value,'@',2)
  end
$$;

create or replace function public.is_ritmo_admin()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select auth.uid() is not null and exists(
    select 1 from public.platform_admins where user_id = auth.uid()
  )
$$;

create or replace function public.ritmo_public_config()
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  with audience as (
    select public.is_ritmo_admin() or exists(select 1 from public.platform_pilots where user_id=auth.uid()) as pilot
  ), flags as (
    select coalesce(jsonb_object_agg(f.key,
      f.state='public' or (f.state='pilot' and (select pilot from audience))
    ),'{}'::jsonb) value from public.platform_features f
  )
  select jsonb_build_object(
    'features',(select value from flags),
    'weightModelMode',c.weight_model_mode,
    'announcement',case when c.announcement_enabled and btrim(c.announcement_text)<>''
      then c.announcement_text else null end,
    'updatedAt',c.updated_at
  ) from public.platform_control c where c.singleton
$$;

create or replace function public.ritmo_admin_snapshot()
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare result jsonb;
begin
  if not public.is_ritmo_admin() then raise exception 'Acceso no autorizado' using errcode='42501'; end if;
  select jsonb_build_object(
    'metrics',jsonb_build_object(
      'users',(select count(*) from auth.users),
      'onboarded',(select count(*) from public.perfiles where onboarding_completo),
      'active30',(select count(*) from auth.users where last_sign_in_at >= now()-interval '30 days'),
      'suspended',(select count(*) from auth.users where banned_until > now()),
      'admins',(select count(*) from public.platform_admins),
      'pilots',(select count(*) from public.platform_pilots)
    ),
    'features',(select coalesce(jsonb_agg(jsonb_build_object(
      'key',key,'label',label,'description',description,'state',state,'updatedAt',updated_at
    ) order by sort_order),'[]'::jsonb) from public.platform_features),
    'control',(select jsonb_build_object(
      'weightModelMode',weight_model_mode,
      'announcementEnabled',announcement_enabled,
      'announcementText',announcement_text,
      'updatedAt',updated_at
    ) from public.platform_control where singleton),
    'audit',(select coalesce(jsonb_agg(entry),'[]'::jsonb) from (
      select jsonb_build_object(
        'id',a.id,'action',a.action,'actor',public.ritmo_mask_email(u.email),
        'target',public.ritmo_mask_email(t.email),'metadata',a.metadata,'createdAt',a.created_at
      ) entry from public.platform_admin_audit a
      left join auth.users u on u.id=a.actor_id
      left join auth.users t on t.id=a.target_id
      order by a.created_at desc limit 30
    ) recent)
  ) into result;
  return result;
end
$$;

create or replace function public.ritmo_admin_users(p_search text default '', p_limit integer default 50, p_offset integer default 0)
returns table(
  user_id uuid, email_masked text, provider text, created_at timestamptz,
  last_sign_in_at timestamptz, status text, role text, onboarding_complete boolean, is_self boolean
) language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not public.is_ritmo_admin() then raise exception 'Acceso no autorizado' using errcode='42501'; end if;
  return query
    select u.id, public.ritmo_mask_email(u.email), coalesce(u.raw_app_meta_data->>'provider','email'),
      u.created_at, u.last_sign_in_at,
      case when u.banned_until > now() then 'suspended' else 'active' end,
      case when a.user_id is not null then 'admin' when p.user_id is not null then 'pilot' else 'user' end,
      coalesce(pr.onboarding_completo,false), u.id=auth.uid()
    from auth.users u
    left join public.platform_admins a on a.user_id=u.id
    left join public.platform_pilots p on p.user_id=u.id
    left join public.perfiles pr on pr.user_id=u.id
    where btrim(coalesce(p_search,''))='' or lower(coalesce(u.email,'')) like '%'||lower(btrim(p_search))||'%'
    order by u.created_at desc
    limit least(greatest(coalesce(p_limit,50),1),100)
    offset greatest(coalesce(p_offset,0),0);
end
$$;

create or replace function public.ritmo_admin_command(p_command jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  kind text := p_command->>'type';
  target uuid;
  value text := p_command->>'value';
  target_key text := p_command->>'key';
begin
  if not public.is_ritmo_admin() then raise exception 'Acceso no autorizado' using errcode='42501'; end if;

  if kind='feature_state' then
    if value not in ('hidden','pilot','public') then raise exception 'Estado inválido'; end if;
    update public.platform_features set state=value,updated_at=now(),updated_by=auth.uid() where key=target_key;
    if not found then raise exception 'Función desconocida'; end if;
    insert into public.platform_admin_audit(actor_id,action,metadata) values(auth.uid(),'feature_state',jsonb_build_object('key',target_key,'state',value));

  elsif kind='weight_model_mode' then
    if value not in ('automatic','stable','candidate') then raise exception 'Modo inválido'; end if;
    update public.platform_control set weight_model_mode=value,updated_at=now(),updated_by=auth.uid() where singleton;
    insert into public.platform_admin_audit(actor_id,action,metadata) values(auth.uid(),'weight_model_mode',jsonb_build_object('mode',value));

  elsif kind='announcement' then
    update public.platform_control set
      announcement_enabled=coalesce((p_command->>'enabled')::boolean,false),
      announcement_text=left(coalesce(p_command->>'text',''),180),updated_at=now(),updated_by=auth.uid()
    where singleton;
    insert into public.platform_admin_audit(actor_id,action,metadata) values(auth.uid(),'announcement',jsonb_build_object('enabled',coalesce((p_command->>'enabled')::boolean,false)));

  elsif kind in ('user_status','user_role') then
    begin target := (p_command->>'userId')::uuid; exception when others then raise exception 'Usuario inválido'; end;
    if not exists(select 1 from auth.users where id=target) then raise exception 'Usuario desconocido'; end if;
    if kind='user_status' then
      if value='suspended' then
        if target=auth.uid() then raise exception 'No puedes suspender tu propia cuenta'; end if;
        update auth.users set banned_until=now()+interval '100 years' where id=target;
      elsif value='active' then update auth.users set banned_until=null where id=target;
      else raise exception 'Estado inválido'; end if;
      insert into public.platform_admin_audit(actor_id,action,target_id,metadata) values(auth.uid(),'user_status',target,jsonb_build_object('status',value));
    else
      if value='admin' then
        insert into public.platform_admins(user_id,granted_by) values(target,auth.uid()) on conflict(user_id) do nothing;
        delete from public.platform_pilots where user_id=target;
      elsif value='pilot' then
        if target=auth.uid() then raise exception 'La cuenta administradora conserva su rol'; end if;
        delete from public.platform_admins where user_id=target;
        insert into public.platform_pilots(user_id,granted_by) values(target,auth.uid()) on conflict(user_id) do nothing;
      elsif value='user' then
        if target=auth.uid() then raise exception 'No puedes retirar tu propio acceso'; end if;
        if (select count(*) from public.platform_admins)<=1 and exists(select 1 from public.platform_admins where user_id=target) then raise exception 'Debe quedar al menos un administrador'; end if;
        delete from public.platform_admins where user_id=target;
        delete from public.platform_pilots where user_id=target;
      else raise exception 'Rol inválido'; end if;
      insert into public.platform_admin_audit(actor_id,action,target_id,metadata) values(auth.uid(),'user_role',target,jsonb_build_object('role',value));
    end if;
  else
    raise exception 'Comando desconocido';
  end if;
  return jsonb_build_object('ok',true);
end
$$;

revoke all on function public.ritmo_mask_email(text), public.is_ritmo_admin(), public.ritmo_public_config(), public.ritmo_admin_snapshot(), public.ritmo_admin_users(text,integer,integer), public.ritmo_admin_command(jsonb) from public, anon;
grant execute on function public.ritmo_mask_email(text), public.is_ritmo_admin(), public.ritmo_public_config() to authenticated;
grant execute on function public.ritmo_admin_snapshot(), public.ritmo_admin_users(text,integer,integer), public.ritmo_admin_command(jsonb) to authenticated;

insert into public.ritmo_schema_version(singleton,version) values(true,'202609100001')
on conflict(singleton) do update set version=excluded.version,aplicado_en=now()
where public.ritmo_schema_version.version < excluded.version;
