Play & Palm — backend

This is a minimal demo backend for the Play & Palm inventory app. It provides a small authentication flow (demo JWT) and user update endpoints useful for testing with tools like Postman.

Quick start
1. Open a terminal in `backend/`.
2. Install dependencies:

```powershell
npm install
```

3. Start the server (dev):

```powershell
npm run dev
```

The server listens on `http://localhost:4000` by default.

Run the server (development):

```powershell
npm run dev
```

Or run the server directly:

```powershell
node server.js
```

Environment
- `JWT_SECRET` (optional) — secret used to sign JWTs. If not set, a default development secret is used. Set it for any real testing that requires stable tokens.

Demo users
The demo users are in `backend/database/users.json`. For convenience the file contains two users:
- `admin` / `admin123` (role: admin)
- `staff` / `staff123` (role: staff)

Notes: the demo stores plaintext passwords for convenience. For any serious testing or deployment, replace with hashed passwords and a real database.

API endpoints
- `POST /api/auth/login` — login
	- Request JSON body: `{ "username": "admin", "password": "admin123" }`
	- Response: `{ token: "<jwt>", user: { id, username, firstName, lastName, email, role, contactNumber, location } }`

- `GET /api/products` — fetch all products
	- Response: array of product objects

- `GET /api/products/:id` — fetch single product by id
	- Response: product object or 404

- `POST /api/products` — create product (protected)
	- Requires header: `Authorization: Bearer <token>`
	- Body JSON: `{ name, brand, category, price, stock, status, description }`

- `PUT /api/products/:id` — update product (protected)
	- Requires header: `Authorization: Bearer <token>`

- `DELETE /api/products/:id` — delete product (protected)

- `GET /api/users/me` — get current user (protected)
	- Requires header: `Authorization: Bearer <token>`
	- Response: current user object (password excluded)

- `PUT /api/users/:id` — update user (protected)
	- Requires header: `Authorization: Bearer <token>`
	- Allowed fields to update: `firstName`, `lastName`, `username`, `email`, `role`, `contactNumber`, `location`
	- Note: The endpoint allows a user to update their own data, or an `admin` to update others.

Using Postman (step-by-step)
1. Login and obtain token
	- Method: `POST`
	- URL: `http://localhost:4000/api/auth/login`
	- Body (JSON):

```json
{
	"username": "admin",
	"password": "admin123"
}
```

	- Response contains `token`. Copy the token.

2. Call protected endpoint (`GET /api/users/me`)
	- Method: `GET`
	- URL: `http://localhost:4000/api/users/me`
	- Headers:
		- `Authorization`: `Bearer <paste token here>`

Example curl (login):

```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

Example curl (get product):

```bash
curl http://localhost:4000/api/products/1
```

3. Update the user (`PUT /api/users/:id`)
	- Method: `PUT`
	- URL example: `http://localhost:4000/api/users/1`
	- Headers: `Authorization: Bearer <token>` and `Content-Type: application/json`
	- Body (JSON): only include allowed fields, for example:

```json
{
	"firstName": "Alice",
	"lastName": "Administrator",
	"contactNumber": "999-888-7777",
	"location": "Remote"
}
```

Security & production notes
- This demo stores plaintext passwords in `backend/database/users.json` for simplicity. For any real deployment:
	- Hash passwords using a secure algorithm like `bcrypt`.
	- Use a strong `JWT_SECRET` stored in environment variables or a secrets manager.
	- Serve the API over HTTPS in production.
	- Add rate-limiting, input validation, and logging.

Troubleshooting
- If you see `Invalid or expired token` when calling protected endpoints, ensure the correct token is added in the `Authorization` header and the `JWT_SECRET` is unchanged between server restarts (set `JWT_SECRET` in your environment if needed).

Local development tips
- If you update route files, restart the server or use `nodemon` to auto-reload.
- The products data is stored in `backend/database/products.json` and will be created automatically on first request if missing.

Security & production notes
- This demo stores plaintext passwords in `backend/database/users.json` for simplicity. For any real deployment:
	- Hash passwords using a secure algorithm like `bcrypt`.
	- Use a strong `JWT_SECRET` stored in environment variables or a secrets manager.
	- Serve the API over HTTPS in production.
	- Add rate-limiting, input validation, logging, and proper CORS restrictions.

Questions or next steps
- If you'd like, I can wire the frontend `Login.jsx` to call this login endpoint and automatically store the token in `localStorage` so pages like `/account` work seamlessly.

