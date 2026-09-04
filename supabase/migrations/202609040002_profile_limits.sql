-- No elimina ni normaliza valores personales existentes. NOT VALID permite
-- revisarlos sin bloquear la migración; todas las nuevas escrituras se validan.
alter table public.perfiles alter column proteina_objetivo type numeric(6,2);
alter table public.perfiles drop constraint if exists perfiles_proteina_objetivo_check;
alter table public.perfiles drop constraint if exists perfiles_edad_check;
alter table public.perfiles drop constraint if exists perfiles_altura_cm_check;
alter table public.perfiles drop constraint if exists perfiles_peso_objetivo_check;
alter table public.perfiles drop constraint if exists perfiles_kcal_objetivo_check;
alter table public.perfiles drop constraint if exists perfiles_nombre_length;
alter table public.perfiles add constraint perfiles_proteina_objetivo_check check (proteina_objetivo between 0.5 and 4) not valid;
alter table public.perfiles add constraint perfiles_edad_check check (edad between 18 and 120) not valid;
alter table public.perfiles add constraint perfiles_altura_cm_check check (altura_cm between 100 and 250) not valid;
alter table public.perfiles add constraint perfiles_peso_objetivo_check check (peso_objetivo between 30 and 300) not valid;
alter table public.perfiles add constraint perfiles_kcal_objetivo_check check (kcal_objetivo between 800 and 6000) not valid;
alter table public.perfiles add constraint perfiles_nombre_length check (char_length(nombre) <= 80) not valid;
update public.ritmo_schema_version set version = '202609040002', aplicado_en = now() where singleton;
