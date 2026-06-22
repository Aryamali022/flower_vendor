# 🌸 ફૂલ દુકાન — Flower Shop Order Management System

A production-ready, **Gujarati-first**, mobile-first order management system for a
single flower shop with a few employees. Replaces the handwritten order book with a
real-time digital queue so **no customer order is ever missed**.

- **Frontend:** HTML + CSS + Vanilla JavaScript (SPA, mobile-first)
- **Backend:** Python + FastAPI (JWT auth, role-based access)
- **Database:** Supabase PostgreSQL (full Gujarati Unicode)
- **Realtime:** Supabase Realtime (live order queue across all devices)
- **Deploy:** Frontend → Netlify/Vercel · Backend → Render · DB → Supabase

---

## 📁 Folder Structure

```
flowervendor/
├── README.md                  ← you are here (setup + deploy + APK)
├── database/
│   └── schema.sql             ← run this in Supabase SQL editor
├── backend/
│   ├── requirements.txt
│   ├── .env.example
│   ├── render.yaml            ← Render deploy blueprint
│   └── app/
│       ├── main.py            ← FastAPI app + CORS + routers
│       ├── config.py          ← env settings
│       ├── database.py        ← Supabase client (service role)
│       ├── security.py        ← bcrypt + JWT
│       ├── deps.py            ← auth dependencies / role guards
│       ├── schemas.py         ← Pydantic models
│       ├── services.py        ← shared order logic (totals, late, etc.)
│       ├── seed.py            ← create first admin
│       └── routers/
│           ├── auth.py        ← login, /me
│           ├── employees.py   ← admin: add/remove/reset/logs
│           ├── items.py       ← flower item CRUD
│           ├── customers.py   ← lookup, history, search
│           ├── orders.py      ← queue, CRUD, status, payment, search
│           └── reports.py     ← dashboard, daily/weekly/monthly
└── frontend/
    ├── index.html
    ├── netlify.toml
    ├── css/styles.css
    └── js/
        ├── config.js          ← API URL + Supabase keys (EDIT THIS)
        ├── api.js             ← fetch wrapper + session
        ├── ui.js              ← toast/modal/format helpers
        ├── realtime.js        ← Supabase live subscription
        ├── app.js             ← bootstrap + router
        └── views/             ← queue, dashboard, neworder, items,
                                  reports, admin, orderdetail
```

---

## 🚀 Quick Start (Local)

### 1. Database (Supabase)

1. Create a free project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** → paste the contents of [`database/schema.sql`](database/schema.sql) → **Run**.
3. Go to **Project Settings → API** and copy:
   - **Project URL** → `SUPABASE_URL`
   - **service_role** secret key → `SUPABASE_SERVICE_ROLE_KEY` (backend only!)
   - **anon public** key → frontend `SUPABASE_ANON_KEY`
4. **Database → Replication / Publications**: confirm `orders` and `order_items`
   are in the `supabase_realtime` publication (the schema script adds them).

### 2. Backend (FastAPI)

```bash
cd backend
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env          # then edit .env with your Supabase values

# create the first admin (mobile 9999999999 / password admin123 by default)
python -m app.seed --mobile 9999999999 --name "એડમિન" --password admin123

uvicorn app.main:app --reload
```

API now runs at **http://localhost:8000** · interactive docs at **/docs**.

### 3. Frontend (static)

1. Edit [`frontend/js/config.js`](frontend/js/config.js):
   ```js
   API_BASE:        "http://localhost:8000",
   SUPABASE_URL:    "https://YOUR-PROJECT.supabase.co",
   SUPABASE_ANON_KEY:"YOUR-ANON-PUBLIC-KEY",
   ```
2. Serve the folder (any static server). The app uses ES modules, so open it
   over HTTP, **not** `file://`:
   ```bash
   cd frontend
   python -m http.server 5500
   ```
3. Open **http://localhost:5500** and log in with the admin you seeded.
   > Add `http://localhost:5500` to `CORS_ORIGINS` in the backend `.env`.

---

## 👥 Roles

| Role  | Can do |
|-------|--------|
| **Admin** | Everything staff can + add/remove employees, reset passwords, view system logs (double-click the header title to open the admin screen). |
| **Staff** | Create/edit/soft-delete orders, manage items, update status & payment, search, view reports. |

---

## 🔌 API Overview

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/auth/login` | Login (mobile + password) → JWT |
| GET  | `/auth/me` | Current employee |
| GET  | `/orders/queue` | **Live queue** (late first, then pickup time) |
| POST | `/orders` | Create order (auto total/remaining, find-or-create customer) |
| GET  | `/orders` | Search (customer, status, payment, date, item) |
| GET  | `/orders/{id}` | Order detail |
| PUT  | `/orders/{id}` | Edit order |
| PATCH| `/orders/{id}/status` | Update order status |
| PATCH| `/orders/{id}/payment` | Update payment (status auto-derived) |
| DELETE | `/orders/{id}` | **Soft** delete |
| GET/POST/PUT/DELETE | `/items` | Flower item master list |
| GET | `/customers/by-mobile/{mobile}` | Repeat-customer auto-fill + history |
| GET | `/reports/dashboard` | Today's snapshot |
| GET | `/reports/{daily\|weekly\|monthly}` | Reports |
| POST/DELETE | `/employees` | Admin: manage staff |
| GET | `/employees/logs` | Admin: system logs |

Full interactive docs: **`/docs`** (Swagger) and **`/redoc`**.

---

## ☁️ Deployment

### Database — Supabase
Already hosted. Keep the `service_role` key secret (backend only).

### Backend — Render
1. Push this repo to GitHub.
2. Render → **New → Blueprint** → select the repo (it reads
   [`backend/render.yaml`](backend/render.yaml)).
3. Set the secret env vars in the dashboard: `SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY`, and `CORS_ORIGINS` (your Netlify URL).
4. Deploy → note the URL, e.g. `https://flower-shop-api.onrender.com`.

### Frontend — Netlify (or Vercel)
1. Update `frontend/js/config.js` → `API_BASE` to the Render URL, and the
   Supabase URL + anon key.
2. Netlify → **Add new site → Import** → set **base/publish** to `frontend`.
   ([`netlify.toml`](frontend/netlify.toml) handles SPA redirects + headers.)
3. Add the Netlify URL to the backend `CORS_ORIGINS` and redeploy the backend.

---

## 🔒 Security

- **JWT** auth (`python-jose`), 12-hour tokens for long shifts.
- **bcrypt** password hashing (`passlib`).
- **Role-based access** — admin-only routes guarded server-side (`require_admin`).
- **Input validation** via Pydantic (mobile regex, amounts ≥ 0, status enums).
- **SQL injection**: all DB access goes through Supabase's parameterized client.
- **XSS**: frontend escapes all user content (`esc()` helper).
- **Soft delete** everywhere — records are never physically removed.
- The `service_role` key lives only on the backend; the frontend uses the
  read-only `anon` key for realtime, protected by RLS (anon = SELECT only).

---

## 🧱 Future-Ready Architecture

Designed so these need **no schema redesign**:
multi-shop (add `shop_id`), WhatsApp/SMS alerts (hook into order events),
voice/OCR order entry (feed the same `POST /orders`), inventory, and thermal printing.

---

## 🌐 Gujarati Status Values

**Order:** `ઓર્ડર બાકી` · `તૈયાર થઈ રહ્યું છે` · `તૈયાર` · `આપી દીધો`
**Payment:** `બાકી` · `આંશિક ચૂકવણી` · `પૂર્ણ ચૂકવણી`

Late orders show **🚨 મોડો ઓર્ડર** and jump to the top of the queue with a red indicator.
