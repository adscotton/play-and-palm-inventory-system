# Play & Palm Inventory

Full-stack inventory demo for consoles and accessories.
- Backend: Node/Express + Supabase (auto-falls back to local JSON persistence when Supabase creds are missing).
- Frontend: React (Vite) with tabbed stock/price controls and refreshed purple UI.
- Database: Normalized Postgres/Supabase schema with lookup tables for brands/categories/manufacturers and product statuses (no SKU column).

## Quick start
1) Backend  
```powershell
cd C:\play-and-palm-inventory\backend
notepad .env   # set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, JWT_SECRET (optional), PORT=4000
npm install
npm run dev
```

2) Frontend (new terminal)  
```powershell
cd C:\play-and-palm-inventory\frontend
notepad .env   # VITE_API_BASE=http://localhost:4000
npm install
npm run dev
```

3) Open http://localhost:5173 and log in with `admin / admin123` or `staff / staff123`.

If Supabase keys are missing/invalid, the API transparently uses `backend/database/products.json` so the app still works.

## Database (Supabase/Postgres)
- Run `database/schema_full.sql` in the Supabase SQL editor to create/seed everything (roles, statuses, brands, categories, manufacturers, products, users, audit logs, triggers).
- Tables:
  - `user_roles` / `product_statuses`: text lookup tables.
  - `brands`, `categories`, `manufacturers`: `id, name (unique)`.
  - `app_users`: `id, username, email, password_hash, role (FK), first_name, last_name, contact_number, location, created_at, updated_at`.
  - `products`: `id, name (unique), brand_id, category_id, manufacturer_id, storage, edition, price numeric(10,2), stock int >= 0, status (FK), description, release_date, tags text[], image, created_at, updated_at`. API responses still expose `brand`, `category`, and `manufacturer` as names for the frontend.
  - `audit_logs`: captures `user_id`, `entity_type`, `entity_id`, `action`, `details`, `created_at` (username included in `details` when available).

Legacy seed row helpers remain in `database/*.sql` if you prefer to load only data.

## API map (http://localhost:4000)
- `POST /api/auth/login` -> `{ token, user }` (JWT stores `id`, `username`, `role`).
- `GET /api/products` / `GET /api/products/:id` -> list or single product.
- `POST /api/products` (manager/admin) -> create product; `stock` optional, defaults to 0; storage/edition supported.
- `PUT /api/products/:id` (manager/admin; staff can send stock only) -> edits details; blank stock leaves value unchanged.
- `PUT /api/products/:id/stock` (staff/manager/admin) -> add stock via `delta` or absolute `stock` (must be non-negative).
- `PUT /api/products/:id/stock/reduce` (staff/manager/admin) -> subtract sold units; clamps at 0.
- `PUT /api/products/:id/price` (manager/admin) -> update price.
- `GET /api/products/search?name=` -> auth-required search for tab pickers.
- `DELETE /api/products/:id` (manager/admin) -> remove product.

## Frontend pages
- Login `/` - Purple hero card with eye/eye-off toggle; stores JWT, username, role.
- Dashboard `/dashboard` - Inventory snapshot widgets (status, category mix, restock watch, recent items).
- Inventory `/inventory` - List/search/filter products, link into detail.
- Product Detail `/product/:id` - Full specs (brand/category/storage/edition/manufacturer/release/tags/stock/price/status) with actions that deep-link to the updates tab.
- Add Product `/add` - Admin/manager form; storage value + unit dropdown (TB/GB/MB), edition, manufacturer, release date, tags; stock optional; thick form outlines.
- Edit Product `/product/:id/edit` - Same fields as Add; staff can only change stock; blank stock leaves it unchanged; status auto-calculates.
- Update Stock & Price `/updates` - Tab bar for Add Stock, Reduce Stock, and Update Price (consistent purple active state); search & preview; logs user in audit trail.
- UpdateStock/UpdatePrice legacy routes - thin wrappers that open the `/updates` tab with prefilled search.
- Account, About, Create User (admin), and other supportive screens share the refreshed styling.

## Design highlights
- Thicker form outlines, pill badges, and purple gradients across login, add/edit product, and update tabs.
- Storage unit dropdown (TB/GB/MB), edition/color, manufacturer, and release date visible on detail/edit/add flows.
- Stock controls split into Add vs Reduce to match business rules (no arbitrary overwrite from 8 to 1).

## Troubleshooting
- Auth failures: confirm `JWT_SECRET` matches between sessions; verify Supabase keys in `backend/.env`.
- SKU errors: there is no `sku` column anywhere—ensure your Supabase schema matches `database/schema_full.sql` and restart the backend to refresh the cache.
- Stock/price validation: stock must be non-negative; reduce uses `delta`; price must be >= 0.
- Health check: `curl http://localhost:4000/health`.
