# Universal POS

### Standalone Offline + Online POS & Admin Management System

A configurable Point-of-Sale and admin management system for **Mobile Shops**, **Furniture Shops**, and **Food / Hotel** businesses — built with **React + Vite + Tailwind CSS** on the frontend, a lightweight **PHP** REST API on the backend, and **MySQL** for storage. Fully independent application; not a module of any other project.

---

## 🌟 Key Features

1. **One App, Three Business Types**
   Switch the active **Business Type** (Mobile / Furniture / Food & Hotel) from Master Settings. The Product Creation screen, specification fields, and variant options change dynamically — driven by a configurable attribute schema, not hardcoded per type. Switching business types never deletes existing products or invoices.

2. **Offline-First Billing**
   Billing, customer creation, stock adjustments, purchases, expenses and income all work with no network connection. Writes are queued in an IndexedDB outbox (keyboard-friendly POS screen, barcode scanning, hold/resume bills) and synced to the server automatically when connectivity returns, or on demand via **Sync Now**. Every offline write carries a client-generated UUID so retried syncs are idempotent — no duplicate invoices, purchases, or stock movements.

3. **Mobile Shop**
   IMEI (single/dual) and serial-number tracking per unit, with a dedicated picker in the billing screen so a sale is tied to one specific physical device.

4. **Furniture Shop**
   Dimension, material and other specification fields, plus configurable product **variants** (e.g. 4-Seater / 6-Seater) with their own price adjustment and stock.

5. **Food / Hotel**
   Veg/non-veg, spice level, sweetness, portion and other food-specific fields; variants for size/spice combinations and a selectable **Add-ons** list priced and snapshotted onto each sale.

6. **Full Admin Suite**
   Inventory (stock ledger, low-stock alerts, manual adjustments), Purchases with supplier payments, Sales & Purchase Returns, Customers/Suppliers with running balances, Expenses & Income, and a Reports module (sales, purchases, profit & loss, inventory valuation, tax, payments, and more).

7. **Granular Roles & Permissions**
   Three roles (Admin / Manager / Cashier) each with a default permission matrix across POS, Products, Inventory, Purchases, Parties, Finance and Admin — editable from the UI. Individual users can also be granted or denied specific permissions beyond their role's default. Every sensitive action is recorded in an **Audit Log**.

8. **Tamil & English**
   Full UI translation via i18next, including dynamic content such as permission labels and dashboard figures. Persisted across restarts; switch anytime from the header.

9. **Light & Dark Theme**
   Centralized design tokens, persisted per device.

10. **Installable PWA**
    Valid manifest with maskable icons, installable on desktop and mobile, offline app-shell caching via a service worker.

---

## 📁 Repository Structure

```
universal-pos/
├── backend/
│   ├── config/              # Database and app configuration
│   ├── database/
│   │   ├── schema.sql       # Full schema
│   │   └── seed.sql         # Default admin user, permissions, masters
│   ├── public/              # API entry point (index.php)
│   ├── src/
│   │   ├── Controllers/     # One controller per resource
│   │   ├── Helpers/         # Router, Response, JWT, UUID helpers
│   │   ├── Middleware/      # Auth, permission, CORS middleware
│   │   └── Services/        # AuditLogger
│   ├── .env.example
│   └── composer.json
├── frontend/
│   ├── public/               # PWA icons
│   ├── src/
│   │   ├── config/           # Axios instance (api.js)
│   │   ├── components/       # Layout, sync status badge, route guard
│   │   ├── db/                # IndexedDB cache + offline sync engine
│   │   ├── hooks/             # useAuth, useSettings
│   │   ├── i18n/              # English & Tamil translation resources
│   │   ├── pages/             # One page per module (POS, Products, Reports...)
│   │   ├── print/             # Receipt generation
│   │   ├── theme/             # Light/dark theme provider
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── .env.example
│   ├── package.json
│   ├── tailwind.config.js
│   └── vite.config.js
├── .gitignore
└── README.md
```

---

## 🚀 Installation & Setup

### Prerequisites
- PHP 8.1+ with the `pdo_mysql` extension
- [Composer](https://getcomposer.org/)
- Node.js 18+ and npm
- MySQL 5.7+ / MariaDB 10.3+

### 1. Database Setup

Import the schema, then the seed data (seed.sql creates the database if it doesn't exist via `schema.sql`'s `CREATE DATABASE IF NOT EXISTS`):

```bash
mysql -u root -p < backend/database/schema.sql
mysql -u root -p universal_pos < backend/database/seed.sql
```

This creates the `universal_pos` database, all tables, the default admin user, the permission matrix, and starter masters (payment methods, units, tax rates, categories, brands, and the Mobile/Furniture/Food attribute field definitions).

### 2. Backend Setup

```bash
cd backend
cp .env.example .env
```

Edit `.env` with your database credentials:

```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=universal_pos
DB_USERNAME=root
DB_PASSWORD=your_password
JWT_SECRET=replace-with-a-long-random-string
```

Install dependencies and start the API:

```bash
composer install
composer run serve
```

The API listens on **http://127.0.0.1:8091** (serves `/api/...`). To run it under Apache/XAMPP instead, point a vhost (or an htdocs subfolder) at `backend/public` and adjust `frontend/.env`'s `VITE_API_BASE_URL` accordingly — the router auto-strips a subfolder prefix if served from somewhere other than the webroot.

### 3. Frontend Setup

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

By default the Vite dev server runs on **http://localhost:5175** and proxies `/api` to `http://127.0.0.1:8091` (see `vite.config.js`). For a production build:

```bash
npm run build
npm run preview
```

### 4. Log In

Open the frontend URL and sign in with the seeded admin account:

- **Username**: `admin`
- **Password**: `Admin@123`

Change this password immediately after first login (Users & Roles → edit the admin user).

---

## 🔧 Configuration Notes

- **Business type, company profile, invoice numbering, tax, printer/paper width, and barcode scanner mode** are all set from **Master Settings** inside the app — no code changes needed.
- **Offline sync status** (online/offline, pending/failed items, last sync time) is visible from the header badge and from the Master Settings → Offline Synchronization panel, where queued items can be retried or discarded individually.
- **Roles & Permissions** (default matrix per role, plus per-user overrides) are managed from Users & Roles → Manage Roles & Permissions.
