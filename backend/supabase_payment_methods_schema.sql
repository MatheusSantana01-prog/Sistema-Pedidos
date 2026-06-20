create table if not exists public.restaurant_payment_methods (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  code text not null,
  type text not null,
  is_active boolean not null default true,
  is_default boolean not null default false,
  requires_reference boolean not null default false,
  allow_change boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint restaurant_payment_methods_name_check check (char_length(trim(name)) >= 2),
  constraint restaurant_payment_methods_code_check check (code ~ '^[a-z0-9_]{2,60}$'),
  constraint restaurant_payment_methods_type_check check (
    type in (
      'cash',
      'pix',
      'credit_card',
      'debit_card',
      'meal_voucher',
      'food_voucher',
      'bank_transfer',
      'digital_wallet',
      'courtesy',
      'credit_account',
      'other'
    )
  )
);

create unique index if not exists idx_restaurant_payment_methods_restaurant_code
  on public.restaurant_payment_methods(restaurant_id, code);

create index if not exists idx_restaurant_payment_methods_restaurant_active
  on public.restaurant_payment_methods(restaurant_id, is_active, sort_order);

create or replace function public.set_restaurant_payment_methods_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_restaurant_payment_methods_updated_at on public.restaurant_payment_methods;
create trigger trg_restaurant_payment_methods_updated_at
before update on public.restaurant_payment_methods
for each row
execute function public.set_restaurant_payment_methods_updated_at();

alter table public.restaurant_payment_methods enable row level security;

drop policy if exists restaurant_payment_methods_service_role_all on public.restaurant_payment_methods;

revoke all privileges on public.restaurant_payment_methods from anon, authenticated;
grant all privileges on public.restaurant_payment_methods to service_role;
