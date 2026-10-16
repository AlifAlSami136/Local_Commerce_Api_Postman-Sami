# Local Commerce API

CSV-backed localhost API for QA / SDET practice. On every `npm start`, fresh CSV data is generated, JSON seed files are rebuilt from those CSVs, then the server boots.

Runs at **http://localhost:3002** (change via `.env`).

## Quick start

From the **repo root**:

```bash
npm run commerce-local
```

Or from the project folder:

```bash
cd "API Testing/Local_Commerce_API"
npm install
npm start
```

`prestart` always runs `npm run seed`, so each localhost boot gets **new CSV values**.

**Visual dashboard:** [http://localhost:3002/dashboard](http://localhost:3002/dashboard)  
Sections: **CU** Customer · **DL** Dealer · **AD** Admin · **SA** Super Admin (each keeps its own login).

**Product price rules** (from `.env` only): float between `PRODUCT_PRICE_MIN` and `PRODUCT_PRICE_MAX`.  
Current bounds: `GET /api/meta/products`  
Duplicate products are blocked when SKU matches, or same dealer + name + category + price.

| Command | What it does |
| --- | --- |
| `npm start` | Regenerate CSV + JSON seeds, then start API |
| `npm run seed` | Regenerate CSV + JSON only |
| `npm run dev` | Seed then start with `--watch` |

## Project layout

```
Local_Commerce_API/
├── .env                          # BASE_URL / PORT / JWT / seed sizes
├── data/
│   ├── csv/                      # CSV "database" (rewritten every start)
│   └── seeds/                    # JSON pulled from CSV for seeding / inspection
├── scripts/seed.js               # Generates new CSV → writes JSON seeds
└── src/
    ├── apis.js                   # All API routes (users, dealers, products, …)
    ├── auth.js                   # Token creator + auth handler
    ├── config.js                 # Loads .env
    ├── csvStore.js               # CSV read/write helpers
    └── server.js                 # Localhost runner
```

## Environment (`.env`)

```env
PORT=3002
BASE_URL=http://localhost:3002
JWT_SECRET=commerce-local-dev-secret
ACCESS_TOKEN_TTL=1h
SEED_USERS=8
SEED_DEALERS=5
SEED_PRODUCTS=12
SEED_PAYMENTS=10
SEED_PURCHASES=6
```

Change `PORT` / `BASE_URL` whenever you need a different localhost target.

## Auth

1. `POST /api/auth/login` → receive `access_token`
2. Send `Authorization: Bearer <access_token>` on every protected route

### Demo users (always present after seed)

| Email | Password | Role | Capabilities |
| --- | --- | --- | --- |
| superadmin@commerce.local | Super@123 | SA super_admin | Full access over every role/action |
| admin@commerce.local | Admin@123 | AD admin | Create customers & dealers; manage inventory |
| dealer@commerce.local | Password@123 | DL dealer | Full product CRUD; stock add/out with price; sell/transfer |
| customer@commerce.local | Password@123 | CU customer | Buy / own payments / returns — no deletes |

### Role rules

- **CU Customer:** no product management, no deletes
- **DL Dealer:** add/edit/delete products, stock out with `unit_price`, sell, transfer
- **AD Admin:** create/update customers & dealers; inventory adjust/add/out
- **SA Super admin:** unrestricted; force cascade deletes with `?force=true`

## API map (CRUD in `src/apis.js`)

| Resource | Create | Read | Update | Delete |
| --- | --- | --- | --- | --- |
| Users | `POST /api/users` (admin+) | `GET /api/users` | `PUT /api/users/:id` (admin+) | `DELETE` super_admin |
| Dealers | `POST /api/dealers` | `GET /api/dealers` | `PUT /api/dealers/:id` | `DELETE` super_admin (`?force=true`) |
| Products | `POST /api/products` | `GET /api/products` | `PUT /api/products/:id` | `DELETE` super_admin |
| Product state | — | — | `PUT /api/products/:id/state` | — |
| Product details | `POST /api/product-details` | `GET /api/product-details` | `PUT /api/product-details/:id` | `DELETE` super_admin |
| Payments | `POST /api/payments` | `GET /api/payments` | `PUT /api/payments/:id` | `DELETE` super_admin |
| Orders | buy/sell | `GET /api/orders` | `PUT /api/orders/:id` | `DELETE` super_admin |
| Stock | add/out/adjust | `GET /api/stock` | via stock/state | — |

Also: buy, sell, returns, transfers, purchases confirm, dashboard snapshot.

## Example flow

```bash
# 1) Login
curl -s -X POST http://localhost:3002/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"customer@commerce.local","password":"Password@123"}'

# 2) Browse stock / products
curl -s http://localhost:3002/api/stock \
  -H "Authorization: Bearer <access_token>"

# 3) Buy a product
curl -s -X POST http://localhost:3002/api/buy \
  -H "Authorization: Bearer <access_token>" \
  -H 'Content-Type: application/json' \
  -d '{"product_id":"prd_...","quantity":1,"method":"card"}'

# 4) Admin stock add
curl -s -X POST http://localhost:3002/api/stock/add \
  -H "Authorization: Bearer <admin_token>" \
  -H 'Content-Type: application/json' \
  -d '{"product_id":"prd_...","quantity":25,"reason":"restock"}'
```

## Postman

Import both files from `postman/`:

| File | What it is |
| --- | --- |
| `commerce-api.postman_collection.json` | Full suite (80 requests, all endpoints + negative/authz + SA cleanup) |
| `commerce-api.postman_environment.json` | `baseUrl`, CU/DL/AD/SA credentials, and runtime IDs |

1. Start the API (`npm start`).
2. In Postman: **Import** the collection and the environment, then select **Local Commerce API** as the active environment.
3. Run folder **00 Setup** first (health, all four logins, bootstrap IDs). After that, `accessToken` is the super-admin bearer token and role tokens (`CU_token`, `DL_token`, `AD_token`, `SA_token`) are populated.

CLI:

```bash
npx newman run postman/commerce-api.postman_collection.json \
  -e postman/commerce-api.postman_environment.json
```

### Validation layers

**Collection (every request)**

- JSON `Content-Type`, response time < 3s, body parses as JSON
- Dynamic expected status from the request pre-script (`expectedStatus`)
- Error envelope schema `{ error, message }` on 4xx/5xx
- JSON schema lookup by `schemaName`
- List envelope check: `total === array.length`
- Dynamic ID harvest into the environment (tokens, created resources, seed IDs)

**Request**

- Status + JSON schema for that contract
- Business assertions (role, stock direction, duplicate SKU, 403/409 cases)
- Saves chain variables (`createdProductId`, `buyOrderId`, `createdSku`, …)

Regenerate both files after API contract changes:

```bash
node postman/generate-collection.js
```
