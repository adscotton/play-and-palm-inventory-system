-- Supabase sample schema for products
create table if not exists public.products (
  id bigint generated always as identity primary key,
  name text not null,
  brand text not null,
  category text,
  price numeric(10,2) not null default 0,
  stock integer not null default 0,
  status text not null default 'Available',
  description text,
  sku text,
  manufacturer text,
  release_date date,
  tags text[],
  image text,
  created_at timestamptz not null default now()
);

-- Unique product names (case-insensitive)
create unique index if not exists products_name_lower_idx on public.products (lower(name));

-- Sample rows
insert into public.products (name, brand, category, price, stock, status, description, sku)
values
  ('PlayStation 5', 'Sony', 'Console', 499.00, 8, 'Available', 'Disc edition console', 'PS5-DISC'),
  ('Xbox Series X', 'Microsoft', 'Console', 499.00, 3, 'Low in Stock', 'Flagship Xbox console', 'XSX-001'),
  ('Nintendo Switch OLED', 'Nintendo', 'Handheld', 349.00, 0, 'No Stock', 'OLED handheld/console hybrid', 'SWITCH-OLED'),
  ('DualSense Controller', 'Sony', 'Accessories', 69.00, 24, 'Available', 'PS5 wireless controller', 'DS-PS5');
