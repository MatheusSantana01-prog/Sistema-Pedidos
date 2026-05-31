-- Schema comercial adicional para produto-comercial-restaurantes.
-- Aplicar em Supabase antes de habilitar Estoque e Delivery em produção.
-- Todas as tabelas têm restaurant_id e devem ser protegidas por RLS/políticas equivalentes.

create table if not exists inventory_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  nome text not null,
  unidade text not null check (unidade in ('unidade','kg','g','litro','ml')),
  estoque_atual numeric not null default 0,
  estoque_minimo numeric not null default 0,
  custo_unitario numeric not null default 0,
  fornecedor text,
  validade date,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists inventory_movements (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  inventory_item_id uuid not null references inventory_items(id) on delete cascade,
  movement_type text not null check (movement_type in ('entrada','saida_manual','ajuste','perda','inventario','baixa_por_venda')),
  quantity numeric not null,
  unit_cost numeric,
  stock_before numeric not null default 0,
  stock_after numeric not null default 0,
  reason text,
  product_id uuid references produtos(id) on delete set null,
  order_id uuid references pedidos(id) on delete set null,
  created_by uuid,
  created_by_name text,
  created_at timestamptz not null default now()
);

create table if not exists product_recipes (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  product_id uuid not null references produtos(id) on delete cascade,
  inventory_item_id uuid not null references inventory_items(id) on delete restrict,
  quantity numeric not null,
  unit text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, product_id, inventory_item_id)
);

create table if not exists delivery_drivers (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  nome text not null,
  telefone text,
  veiculo text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists delivery_orders (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  order_type text not null default 'delivery',
  customer_name text not null,
  customer_phone text not null,
  address text not null,
  neighborhood text,
  delivery_fee numeric not null default 0,
  total numeric not null default 0,
  notes text,
  driver_id uuid references delivery_drivers(id) on delete set null,
  status text not null default 'recebido',
  created_by uuid,
  created_by_name text,
  dispatched_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table produtos add column if not exists ncm text;
alter table produtos add column if not exists cfop text;
alter table produtos add column if not exists cest text;
alter table produtos add column if not exists origem text;
alter table produtos add column if not exists unidade_fiscal text;

create index if not exists idx_inventory_items_restaurant on inventory_items(restaurant_id);
create index if not exists idx_inventory_movements_restaurant on inventory_movements(restaurant_id, created_at desc);
create index if not exists idx_product_recipes_restaurant_product on product_recipes(restaurant_id, product_id);
create index if not exists idx_delivery_orders_restaurant_status on delivery_orders(restaurant_id, status, created_at desc);
create index if not exists idx_delivery_drivers_restaurant on delivery_drivers(restaurant_id);
