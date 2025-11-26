# Database folder (MySQL / Supabase SQL)

Single SQL file to build everything:
- `mysql-schema.sql` creates the `play_palm_inventory` database with 9 tables:
  - users (staff roles)
  - products (catalog + tags + stock/status)
  - inventory_movements (stock in/out audit)
  - suppliers
  - purchase_orders + purchase_order_items
  - customers
  - sales_orders + sales_order_items
- Seed rows are included so you see data right away.

## Load it (fast steps)
MySQL locally:
```powershell
mysql -u <user> -p < database/mysql-schema.sql
```

Supabase:
1) Open your project -> SQL Editor.  
2) Paste the contents of `mysql-schema.sql`.  
3) Run it. (Supabase accepts MySQL-ish SQL for these columns.)

## Quick checks
- `SHOW TABLES;` should list all 9 tables.
- `SELECT * FROM products;` should return the seeded consoles.
- `SELECT * FROM purchase_orders;` should show two sample POs with line items.

If a column is missing (e.g., `tags` on products) rerun the script or run `ALTER TABLE products ADD COLUMN tags TEXT;`.
