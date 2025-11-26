# Play & Palm Inventory

An end-to-end demo inventory app:
- Backend: Node/Express + Supabase (falls back to local JSON if Supabase is down).
- Frontend: React (Vite) dashboard and inventory screens.
- Database: MySQL/Supabase schema in `database/mysql-schema.sql` with seed data.

## Quick start (copy/paste friendly)
1) Backend  
```powershell
cd C:\play-and-palm-inventory\backend
notepad .env   # add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
npm install
npm run dev
```

2) Frontend (new terminal)  
```powershell
cd C:\play-and-palm-inventory\frontend
npm install
npm run dev
```

3) Open http://localhost:5173 and log in with `admin / admin123`.

If Supabase keys are missing or wrong, the backend will still work by saving to `backend/database/*.json`.

## Database schema (what the tables are for)
- `users`: staff accounts with roles (admin, manager, staff).
- `products`: catalog items (name, sku, brand, category, tags, stock, status, price).
- `inventory_movements`: stock in/out history tied to users and products.
- `suppliers`: who you buy from.
- `purchase_orders` + `purchase_order_items`: what you ordered from suppliers and how many units arrived.
- `customers`: who you sell to.
- `sales_orders` + `sales_order_items`: simple sales/fulfillment tracking.

### Apply the schema
- Local MySQL: `mysql -u <user> -p < database/mysql-schema.sql`
- Supabase: open the SQL editor, paste the file contents, and run it; it creates/updates tables with seed rows.

## API basics (backend at http://localhost:4000)
- `POST /api/auth/login` → returns `{ token, user }` (use demo creds above).
- `GET /api/products` → list products (frontend uses this).
- Protected routes need header `Authorization: Bearer <token>`.

## Tips if stuck
- Check backend health: `curl http://localhost:4000/health`.
- White screen? Open browser devtools → Console + Network and confirm calls to `http://localhost:4000` succeed.
- Port taken? Edit `PORT` in `backend/.env` (e.g., 4001) and restart.
