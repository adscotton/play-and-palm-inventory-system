-- Drop old tables if you want a clean rebuild
drop table if exists public.audit_logs cascade;
drop table if exists public.products cascade;
-- keep app_users if you already have data; otherwise uncomment:
-- drop table if exists public.app_users cascade;

-- Users
create table if not exists public.app_users (
  id             bigserial primary key,
  username       text not null unique,
  email          text unique,
  password_hash  text not null,
  role           text not null default 'staff' check (role in ('admin','manager','staff')),
  first_name     text,
  last_name      text,
  contact_number text,
  location       text,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

-- Products
create table if not exists public.products (
  id             bigserial primary key,
  sku            text unique,
  name           text not null unique,
  brand          text,
  category       text,
  manufacturer   text,
  price          numeric(10,2) not null default 0 check (price >= 0),
  stock          int not null default 0 check (stock >= 0),
  status         text not null default 'Available' check (status in ('Available','Low in Stock','No Stock')),
  description    text,
  release_date   date,
  tags           text[],
  image          text,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

-- Audit log
create table if not exists public.audit_logs (
  id           bigserial primary key,
  user_id      bigint references public.app_users(id),
  entity_type  text not null,   -- e.g., 'product'
  entity_id    bigint,
  action       text not null,   -- e.g., 'CREATE','UPDATE','DELETE','UPDATE_STOCK','UPDATE_PRICE'
  details      jsonb,
  created_at   timestamptz default now()
);

-- updated_at trigger helper
drop function if exists public.set_updated_at cascade;
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

-- Attach updated_at triggers
drop trigger if exists trg_upd_products on public.products;
create trigger trg_upd_products before update on public.products
for each row execute function public.set_updated_at();

drop trigger if exists trg_upd_app_users on public.app_users;
create trigger trg_upd_app_users before update on public.app_users
for each row execute function public.set_updated_at();

-- Helpful indexes
create unique index if not exists products_name_lower_idx on public.products (lower(name));
create index if not exists products_name_search_idx on public.products using gin (to_tsvector('simple', name));

-- Seed (optional; rerunnable)
insert into public.app_users (id, username, email, password_hash, role, first_name, last_name)
values
  (1, 'admin', 'admin@example.com', 'admin123', 'admin', 'Alice', 'Admin'),
  (2, 'staff', 'staff@example.com', 'staff123', 'staff', 'Sam', 'Staff')
on conflict (id) do update set
  username = excluded.username,
  email = excluded.email,
  password_hash = excluded.password_hash,
  role = excluded.role,
  first_name = excluded.first_name,
  last_name = excluded.last_name;

insert into public.products (id, sku, name, brand, category, manufacturer, price, stock, status, description, release_date, tags)
values
  (1, 'PS5-DISC', 'PlayStation 5', 'Sony', 'Console', 'Sony', 499.00, 8, 'Available', 'Disc edition console', '2020-11-12', array['console','next-gen']),
  (2, 'XSX-001', 'Xbox Series X', 'Microsoft', 'Console', 'Microsoft', 499.00, 3, 'Low in Stock', 'Flagship Xbox console', '2020-11-10', array['console','flagship'])
on conflict (id) do update set
  sku = excluded.sku,
  name = excluded.name,
  brand = excluded.brand,
  category = excluded.category,
  manufacturer = excluded.manufacturer,
  price = excluded.price,
  stock = excluded.stock,
  status = excluded.status,
  description = excluded.description,
  release_date = excluded.release_date,
  tags = excluded.tags;
