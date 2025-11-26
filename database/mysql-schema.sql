-- extension for UUIDs (if you prefer bigserial, keep as-is)
-- create extension if not exists "uuid-ossp";

-- Brands
create table if not exists public.brands (
  id            bigint generated always as identity primary key,
  name          text not null unique,
  website       text,
  support_email text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- Categories
create table if not exists public.categories (
  id            bigint generated always as identity primary key,
  name          text not null unique,
  description   text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- Suppliers
create table if not exists public.suppliers (
  id            bigint generated always as identity primary key,
  name          text not null,
  contact_name  text,
  phone         text,
  email         text,
  city          text,
  address       text,
  notes         text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- Products table
create table if not exists public.products (
  id             bigint generated always as identity primary key,
  sku            text unique,
  name           text not null unique,
  brand_id       bigint references public.brands(id),
  category_id    bigint references public.categories(id),
  supplier_id    bigint references public.suppliers(id),
  manufacturer   text,
  price          numeric(10,2) check (price >= 0),
  cost           numeric(10,2) check (cost is null or cost >= 0),
  stock          int default 0 check (stock >= 0),
  reorder_point  int default 5 check (reorder_point >= 0),
  status         text default 'Available',
  description    text,
  release_date   date,
  tags           text[], -- array of tags
  image          text,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

-- Users (app users)
create table if not exists public.app_users (
  id             bigint generated always as identity primary key,
  username       text unique,
  email          text unique,
  first_name     text,
  last_name      text,
  role           text default 'staff',
  contact_number text,
  location       text,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

-- Inventory movements (stock ledger)
create table if not exists public.inventory_movements (
  id            bigint generated always as identity primary key,
  product_id    bigint not null references public.products(id),
  user_id       bigint references public.app_users(id),
  movement_type text not null check (movement_type in ('IN','OUT')),
  quantity      int not null check (quantity > 0),
  balance_after int,
  note          text,
  created_at    timestamptz default now()
);

-- Purchase orders (header)
create table if not exists public.purchase_orders (
  id            bigint generated always as identity primary key,
  supplier_id   bigint not null references public.suppliers(id),
  status        text not null default 'ordered' check (status in ('draft','ordered','received','cancelled')),
  ordered_at    date,
  expected_at   date,
  received_at   date,
  created_by    bigint references public.app_users(id),
  total_cost    numeric(12,2) default 0 check (total_cost >= 0),
  note          text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- Purchase order items
create table if not exists public.purchase_order_items (
  id                  bigint generated always as identity primary key,
  purchase_order_id   bigint not null references public.purchase_orders(id) on delete cascade,
  product_id          bigint not null references public.products(id),
  quantity            int not null check (quantity > 0),
  unit_cost           numeric(12,2) not null default 0 check (unit_cost >= 0),
  received_quantity   int default 0 check (received_quantity >= 0),
  note                text
);

-- Customers
create table if not exists public.customers (
  id          bigint generated always as identity primary key,
  first_name  text not null,
  last_name   text,
  email       text,
  phone       text,
  city        text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- Sales orders (header)
create table if not exists public.sales_orders (
  id              bigint generated always as identity primary key,
  customer_id     bigint references public.customers(id),
  status          text not null default 'pending' check (status in ('pending','paid','shipped','cancelled')),
  ordered_at      date,
  shipped_at      date,
  created_by      bigint references public.app_users(id),
  total_amount    numeric(12,2) default 0 check (total_amount >= 0),
  payment_method  text default 'cash' check (payment_method in ('cash','card','online','other')),
  note            text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- Sales order items
create table if not exists public.sales_order_items (
  id             bigint generated always as identity primary key,
  sales_order_id bigint not null references public.sales_orders(id) on delete cascade,
  product_id     bigint not null references public.products(id),
  quantity       int not null check (quantity > 0),
  unit_price     numeric(12,2) not null default 0 check (unit_price >= 0)
);

-- Updated_at trigger
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$
begin
  perform 1;
  create trigger trg_set_updated_at_products
    before update on public.products
    for each row execute function public.set_updated_at();
exception when duplicate_object then null;
end$$;

do $$
begin
  perform 1;
  create trigger trg_set_updated_at_app_users
    before update on public.app_users
    for each row execute function public.set_updated_at();
exception when duplicate_object then null;
end$$;

do $$
begin
  perform 1;
  create trigger trg_set_updated_at_suppliers
    before update on public.suppliers
    for each row execute function public.set_updated_at();
exception when duplicate_object then null;
end$$;

do $$
begin
  perform 1;
  create trigger trg_set_updated_at_purchase_orders
    before update on public.purchase_orders
    for each row execute function public.set_updated_at();
exception when duplicate_object then null;
end$$;

do $$
begin
  perform 1;
  create trigger trg_set_updated_at_sales_orders
    before update on public.sales_orders
    for each row execute function public.set_updated_at();
exception when duplicate_object then null;
end$$;
