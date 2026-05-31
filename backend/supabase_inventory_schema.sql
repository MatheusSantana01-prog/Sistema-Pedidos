-- Estoque comercial do Sistema-Pedidos.
-- Execute no Supabase SQL Editor antes de liberar a aba Estoque em produção.
-- Todas as tabelas usam restaurant_id; o backend sempre grava pelo JWT, nunca pelo frontend.

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  document text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  supplier_id uuid references public.suppliers(id) on delete set null,
  name text not null,
  unit text not null default 'un',
  current_quantity numeric(14,3) not null default 0,
  minimum_quantity numeric(14,3) not null default 0,
  unit_cost numeric(14,4) not null default 0,
  expiration_date date,
  category text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items(id) on delete cascade,
  supplier_id uuid references public.suppliers(id) on delete set null,
  movement_type text not null check (movement_type in ('entrada','saida','ajuste','perda','venda','estorno','inventario')),
  quantity numeric(14,3) not null,
  quantity_delta numeric(14,3) not null,
  previous_quantity numeric(14,3) not null,
  balance_after numeric(14,3) not null,
  unit_cost numeric(14,4) not null default 0,
  expiration_date date,
  reason text,
  reference_type text,
  reference_id text,
  created_by uuid,
  created_by_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.product_recipes (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  product_id uuid not null references public.produtos(id) on delete cascade,
  yield_quantity numeric(14,3) not null default 1,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, product_id, is_active)
);

create table if not exists public.product_recipe_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  recipe_id uuid not null references public.product_recipes(id) on delete cascade,
  product_id uuid not null references public.produtos(id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items(id) on delete restrict,
  quantity numeric(14,3) not null,
  unit text not null default 'un',
  waste_percent numeric(6,2) not null default 0,
  unit_cost_snapshot numeric(14,4) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.inventory_counts (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft','closed','cancelled')),
  notes text,
  counted_by uuid,
  counted_by_name text,
  closed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.inventory_count_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  inventory_count_id uuid not null references public.inventory_counts(id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items(id) on delete cascade,
  expected_quantity numeric(14,3) not null default 0,
  counted_quantity numeric(14,3) not null default 0,
  difference_quantity numeric(14,3) not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_suppliers_restaurant on public.suppliers(restaurant_id);
create index if not exists idx_inventory_items_restaurant on public.inventory_items(restaurant_id, is_active);
create index if not exists idx_inventory_movements_restaurant on public.inventory_movements(restaurant_id, created_at desc);
create index if not exists idx_inventory_movements_reference on public.inventory_movements(restaurant_id, reference_type, reference_id);
create index if not exists idx_product_recipes_restaurant_product on public.product_recipes(restaurant_id, product_id);
create index if not exists idx_product_recipe_items_recipe on public.product_recipe_items(restaurant_id, recipe_id);
create index if not exists idx_inventory_counts_restaurant on public.inventory_counts(restaurant_id, created_at desc);
