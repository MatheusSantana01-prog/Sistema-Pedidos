-- Schema complementar para business_type/modules_config em restaurants.
-- Aplicar em ambiente QA/staging antes de produção.

create extension if not exists pgcrypto;

do $$
begin
  if to_regclass('public.restaurants') is null then
    raise exception 'Tabela public.restaurants nao encontrada';
  end if;
end $$;

alter table public.restaurants
  add column if not exists business_type text not null default 'restaurante';

alter table public.restaurants
  add column if not exists modules_config jsonb not null default '{}'::jsonb;

update public.restaurants
set business_type = coalesce(nullif(business_type, ''), 'restaurante')
where business_type is null or business_type = '';

update public.restaurants
set modules_config = coalesce(modules_config, '{}'::jsonb);

comment on column public.restaurants.business_type is 'Tipo de negocio: restaurante, pizzaria, padaria, cafeteria, hamburgueria, bar ou delivery_only';
comment on column public.restaurants.modules_config is 'Configuracao base de modulos permitidos para o negocio';
