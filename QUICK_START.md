# Play & Palm IMS - Quick Start Guide

## Setup

### 1. Backend Setup
```powershell
cd C:\play-and-palm-inventory\backend

# Create or verify .env file
notepad .env
```

Add these lines to `backend/.env`:
```
SUPABASE_URL=https://zcrytpyuxmrnjdbyjhsr.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...your_service_role_key_here...
PORT=4000
```

**Replace** `SUPABASE_SERVICE_ROLE_KEY` with your actual key from Supabase Dashboard → Settings → API → Service Role Key (keep it secret).

### 2. Frontend Setup
Frontend `.env` is already configured. It uses:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `PORT` (for reference only, Vite runs on port 5173 by default)

## Running the App

### Terminal 1: Backend
```powershell
cd C:\play-and-palm-inventory\backend
npm install
npm run dev
```

**Expected output:**
```
Supabase URL: https://...
Supabase Key present: true
Supabase client created. Using service-role key: true
Backend server running on http://localhost:4000
```

### Terminal 2: Frontend
```powershell
cd C:\play-and-palm-inventory\frontend
npm install
npm run dev
```

**Expected output:**
```
  VITE v7.2.x  ready in XXX ms
  ➜  Local:   http://localhost:5173/
```

## Troubleshooting

### White Screen on Frontend
1. **Check browser console** (F12 → Console tab) for JavaScript errors
2. **Check network tab** (F12 → Network) — look for failed requests to `http://localhost:4000`
3. **Verify backend is running** — open `http://localhost:4000/health` in browser (should show JSON)
4. **Check frontend terminal** — look for build errors

### Port 4000 Already in Use
```powershell
netstat -ano | Select-String ":4000"
# Find the PID (last number)
taskkill /PID <PID> /F

# Or change PORT in backend/.env to 4001
```

### Supabase Error (Invalid API Key)
- Products will still work with local JSON fallback in `backend/database/products.json`
- Check backend console for "Supabase client created" message

## Quick Test

1. **Login** (use demo credentials):
   - Username: `admin`
   - Password: `admin123`

2. **View Inventory** (should show products from backend/Supabase)

3. **Add Product** (should save to Supabase or local JSON)

## API Endpoints

All go through: `http://localhost:4000/api/`

- `GET /api/products` — list all products
- `GET /api/products/:id` — get one product
- `POST /api/products` — create product
- `PUT /api/products/:id` — update product
- `DELETE /api/products/:id` — delete product
- `POST /api/auth/login` — login
- `GET /api/health` — backend status

## File Structure

- `backend/server.js` — Express app entry
- `backend/routes/products.js` — product CRUD (uses Supabase or local JSON)
- `backend/utils/supabaseClient.js` — Supabase client initializer
- `backend/database/products.json` — local fallback DB
- `frontend/src/pages/InventoryList.jsx` — fetch products from backend
- `frontend/src/pages/AddProduct.jsx` — POST to backend
