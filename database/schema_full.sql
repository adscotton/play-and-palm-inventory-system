-- =============================================================
-- FULLY NORMALIZED SCHEMA (3NF) WITH SEED DATA
-- Updated for unique product variant logic: (name, edition)
-- =============================================================

-- Drop tables in dependency order
drop table if exists public.audit_logs cascade;
drop table if exists public.products cascade;
drop table if exists public.app_users cascade;
drop table if exists public.user_roles cascade;
drop table if exists public.product_statuses cascade;
drop table if exists public.manufacturers cascade;
drop table if exists public.categories cascade;
drop table if exists public.brands cascade;

-- Drop function
drop function if exists public.set_updated_at cascade;

-- =============================================================
-- REFERENCE / LOOKUP TABLES
-- =============================================================

create table if not exists public.user_roles (
  role text primary key
);

create table if not exists public.product_statuses (
  status text primary key
);

create table if not exists public.brands (
  id bigserial primary key,
  name text not null unique
);

create table if not exists public.categories (
  id bigserial primary key,
  name text not null unique
);

create table if not exists public.manufacturers (
  id bigserial primary key,
  name text not null unique
);

-- =============================================================
-- MAIN TABLES
-- =============================================================

create table if not exists public.app_users (
  id             bigserial primary key,
  username       text not null unique,
  email          text unique,
  password_hash  text not null,
  role           text not null default 'staff' references public.user_roles(role) on update cascade,
  first_name     text,
  last_name      text,
  contact_number text,
  location       text,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

create table if not exists public.products (
  id               bigserial primary key,
  name             text not null,
  brand_id         bigint not null references public.brands(id) on delete set null,
  category_id      bigint references public.categories(id) on delete set null,
  manufacturer_id  bigint references public.manufacturers(id) on delete set null,
  storage          text,
  edition          text,
  price            numeric(10,2) not null default 0 check (price >= 0),
  stock            int not null default 0 check (stock >= 0),
  status           text not null default 'Available' references public.product_statuses(status) on update cascade,
  description      text,
  release_date     date,
  tags             text[],  -- kept as array for simplicity
  image            text,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now(),
  -- Composite natural key: product variant must be unique (name + edition)
  constraint uk_product_variant unique (name, edition)
);

create table if not exists public.audit_logs (
  id           bigserial primary key,
  user_id      bigint references public.app_users(id) on delete set null,
  entity_type  text not null,
  entity_id    bigint,
  action       text not null,
  details      jsonb,
  created_at   timestamptz default now()
);

-- =============================================================
-- TRIGGER FUNCTION FOR updated_at
-- =============================================================

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

-- Attach triggers
create trigger trg_upd_products before update on public.products
for each row execute function public.set_updated_at();

create trigger trg_upd_app_users before update on public.app_users
for each row execute function public.set_updated_at();

-- =============================================================
-- SEED REFERENCE TABLES
-- =============================================================

insert into public.user_roles (role) values
  ('admin'), ('manager'), ('staff')
on conflict (role) do nothing;

insert into public.product_statuses (status) values
  ('Available'), ('Low in Stock'), ('No Stock')
on conflict (status) do nothing;

insert into public.brands (name) values
  ('Sony'), ('Microsoft'), ('Nintendo'), ('Seagate'), ('Western Digital')
on conflict (name) do nothing;

insert into public.categories (name) values
  ('Console'), ('Controller'), ('Storage'), ('Headset')
on conflict (name) do nothing;

insert into public.manufacturers (name) values
  ('Sony Interactive Entertainment'),
  ('Microsoft'),
  ('Nintendo Co., Ltd.'),
  ('Seagate Technology'),
  ('Western Digital')
on conflict (name) do nothing;

-- =============================================================
-- SEED MAIN TABLES
-- =============================================================

-- Seed users
insert into public.app_users (id, username, email, password_hash, role, first_name, last_name) values
  (1, 'admin', 'admin@example.com', 'admin123', 'admin', 'Alice', 'Admin'),
  (2, 'staff', 'staff@example.com', 'staff123', 'staff', 'Sam', 'Staff')
on conflict (id) do update set
  username = excluded.username,
  email = excluded.email,
  password_hash = excluded.password_hash,
  role = excluded.role,
  first_name = excluded.first_name,
  last_name = excluded.last_name;

-- Seed products using subqueries to resolve foreign keys
with
  b as (select id, name from brands),
  c as (select id, name from categories),
  m as (select id, name from manufacturers)
insert into public.products (
  id, name, brand_id, category_id, manufacturer_id,
  storage, edition, price, stock, status, description, release_date, tags
)
values
  (1, 'PlayStation 5 Disc',
      (select id from b where name = 'Sony'),
      (select id from c where name = 'Console'),
      (select id from m where name = 'Sony Interactive Entertainment'),
      '825GB SSD', 'Launch Disc (White)', 499.00, 8, 'Available', 'Disc edition console', '2020-11-12', array['console','next-gen']),

  (2, 'Xbox Series X',
      (select id from b where name = 'Microsoft'),
      (select id from c where name = 'Console'),
      (select id from m where name = 'Microsoft'),
      '1TB SSD', 'Standard Black', 499.00, 3, 'Low in Stock', 'Flagship Xbox console', '2020-11-10', array['console','flagship']),

  (3, 'Nintendo Switch OLED',
      (select id from b where name = 'Nintendo'),
      (select id from c where name = 'Console'),
      (select id from m where name = 'Nintendo Co., Ltd.'),
      '64GB eMMC', 'White Joy-Con', 349.00, 6, 'Available', 'OLED model', '2021-10-08', array['console','oled']),

  (4, 'DualSense Controller',
      (select id from b where name = 'Sony'),
      (select id from c where name = 'Controller'),
      (select id from m where name = 'Sony Interactive Entertainment'),
      null, 'White', 69.00, 15, 'Available', 'Wireless controller', null, array['controller','ps5']),

  (5, 'Xbox Wireless Controller',
      (select id from b where name = 'Microsoft'),
      (select id from c where name = 'Controller'),
      (select id from m where name = 'Microsoft'),
      null, 'Electric Volt', 64.99, 10, 'Available', 'BT controller', null, array['controller','xbox']),

  (6, 'Seagate Expansion Card',
      (select id from b where name = 'Seagate'),
      (select id from c where name = 'Storage'),
      (select id from m where name = 'Seagate Technology'),
      '1TB NVMe', 'Xbox Official', 219.99, 5, 'Low in Stock', 'Storage expansion', null, array['storage','xbox']),

  (7, 'WD Black C50 Expansion',
      (select id from b where name = 'Western Digital'),
      (select id from c where name = 'Storage'),
      (select id from m where name = 'Western Digital'),
      '1TB NVMe', 'Xbox Official', 189.99, 7, 'Available', 'Storage expansion', null, array['storage','xbox']),

  (8, 'PS5 Pulse 3D Headset',
      (select id from b where name = 'Sony'),
      (select id from c where name = 'Headset'),
      (select id from m where name = 'Sony Interactive Entertainment'),
      null, 'White', 99.99, 12, 'Available', 'Wireless headset', null, array['headset','ps5'])
on conflict (id) do update set
  name = excluded.name,
  brand_id = excluded.brand_id,
  category_id = excluded.category_id,
  manufacturer_id = excluded.manufacturer_id,
  storage = excluded.storage,
  edition = excluded.edition,
  price = excluded.price,
  stock = excluded.stock,
  status = excluded.status,
  description = excluded.description,
  release_date = excluded.release_date,
  tags = excluded.tags;

-- =============================================================
-- FIX SEQUENCES TO AVOID ID COLLISIONS
-- =============================================================

select setval('app_users_id_seq', (select coalesce(max(id), 0) from public.app_users));
select setval('products_id_seq', (select coalesce(max(id), 0) from public.products));
select setval('brands_id_seq', (select coalesce(max(id), 0) from public.brands));
select setval('categories_id_seq', (select coalesce(max(id), 0) from public.categories));
select setval('manufacturers_id_seq', (select coalesce(max(id), 0) from public.manufacturers));

-- =============================================================
-- DONE
-- =============================================================
