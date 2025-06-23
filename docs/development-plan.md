# Development Plan: POS & Inventory System MVP for Multi-Store SaaS Wholesaler

## Overview
This document outlines the development plan for a web-based POS and inventory system MVP, tailored for large wholesalers in Kenya (e.g., KK Sha or Jalaram Wholesalers, Kitale) and designed as a multi-tenant SaaS platform. The MVP will be built using Next.js and Supabase, with a focus on VAT compliance, KRA eTIMS integration, robust offline capabilities, and support for multiple stores/shops under a single SaaS deployment. The plan is structured for a 6-8 week timeline, with offline functionality prioritized after core features are complete.

---

## 1. MVP Scope & Objectives
- **Core Functionality:** Fast sales processing, inventory management, VAT toggling (16% or zero-rated), and KRA eTIMS compliance.
- **Multi-Store Support:** Each store/shop operates independently with its own inventory, transactions, and users, all under a single SaaS platform.
- **Scalability:** Support for high transaction volumes and multiple users (cashiers, managers) across multiple stores, desktop, and mobile devices.
- **User Needs:** Intuitive UI for low-tech users, M-Pesa integration, and PDF receipts.
- **Development Efficiency:** Leverage React/Next.js skills for rapid delivery.
- **Offline Capabilities:** Full offline support (implemented after core features).

---

## 2. Core Features
### A. Multi-Store/Shop Management
- Each store/shop has its own inventory, transactions, and user base.
- Store-level settings (e.g., VAT, M-Pesa details, address, branding).
- Admins can manage multiple stores; users are scoped to a store.

### B. Inventory Management
- Stock tracking: name, SKU, quantity, price, VAT status, category (per store).
- Low-stock alerts (e.g., <10 units).
- Bulk updates: CSV import/manual entry.
- Search/filter by name, SKU, category.

### C. Point of Sale (POS)
- Sales processing: product selection, quantity, payment method (cash, M-Pesa, credit).
- VAT toggle: per transaction, with automatic calculation.
- Invoice generation: PDF invoices with VAT details, downloadable/shareable.
- M-Pesa integration: Paybill/Till Number, confirmation in UI.

### D. VAT Compliance (KRA eTIMS)
- eTIMS integration: submit tax invoices to KRA's eTIMS API for VAT-registered transactions.
- VAT reporting: basic report of taxable transactions, exportable as CSV.
- Exempt transactions: allow non-VAT transactions, clearly marked in reports.

### E. User Management
- Roles: admin (full access), cashier (sales-only), store manager.
- Authentication: email/password login via Supabase Auth, JWT for secure access.
- Permissions: restrict cashiers from editing inventory or viewing tax reports.
- Users are assigned to specific stores; super-admins can access all stores.

### F. Reporting
- Sales report: daily/weekly sales, total revenue, VAT collected (per store and across stores for super-admins).
- Inventory report: current stock, low-stock items (per store).
- Export: CSV/PDF for offline use or KRA submission.

---

## 3. Technical Architecture
### A. Frontend (Next.js)
- Next.js 14+ with React for a responsive PWA.
- Tailwind CSS for rapid, responsive design.
- Pages:
  - `/pos`: Sales interface (per store)
  - `/inventory`: Stock management (per store)
  - `/reports`: Sales/inventory reports (per store and global for super-admin)
  - `/stores`: Store management (for admins/super-admins)
  - `/login`: Authentication
- API routes: M-Pesa and eTIMS API calls via Next.js API routes.

### B. Backend (Supabase)
- PostgreSQL for structured data.
- Schema:
  - `stores` (id, name, address, vat_number, kra_pin, mpesa_details, ...)
  - `products` (id, store_id, name, sku, quantity, price, vat_status, category)
  - `transactions` (id, store_id, product_id, quantity, total, vat_amount, payment_method, timestamp, synced)
  - `users` (id, store_id, email, role, password_hash)
- Supabase REST API for CRUD; Edge Functions for M-Pesa/eTIMS.
- Real-time subscriptions for inventory updates (when online).
- Supabase Auth for user management and JWT-based access control.
- Row-level security to ensure users can only access data for their assigned store(s).

### C. Security
- HTTPS for API calls; encrypt sensitive data in Supabase.
- JWT tokens for secure sessions.
- Data validation on client and server.
- Row-level security for multi-tenancy.

---

## 4. Development Phases (6-8 Weeks)

### **Phase 1: Setup and Design (Week 1)**
- Set up Next.js project with Tailwind CSS.
- Configure Supabase (database schema, auth, Edge Functions, row-level security for multi-tenancy).
- Create low-fidelity wireframes for POS, inventory, reports, and store management pages.
- Define API endpoints for eTIMS and M-Pesa integration.
- **Deliverables:** Project scaffold, database schema, basic UI mockups.

### **Phase 2: Core Development (Weeks 2-4)**
- Build POS interface: product search, VAT toggle, payment processing (M-Pesa, cash) per store.
- Implement inventory module: add/edit products, bulk import, low-stock alerts per store.
- Store management: create/edit stores, assign users.
- Integrate eTIMS API for VAT invoice submission (mock API for testing if KRA sandbox is unavailable).
- Implement M-Pesa Paybill/Till Number integration via Supabase Edge Functions.
- Add user authentication and role-based access (admin, store manager, cashier).
- **Deliverables:** Functional POS, inventory, store management, user management, partial API integrations.

### **Phase 3: Offline Capabilities (Weeks 5-6)**
- Set up PWA (next-pwa) for offline asset caching.
- Implement offline storage with Dexie.js for transactions and inventory (per store context).
- Implement sync queue and conflict resolution for offline data.
- Display sync status and handle user feedback for offline/online transitions.
- **Deliverables:** Offline functionality, sync mechanism, user feedback.

### **Phase 4: Reporting, Testing, and Deployment (Weeks 7-8)**
- Build reporting module: sales and inventory reports with CSV/PDF export (per store and global).
- Unit test core modules (POS, inventory, sync, multi-store logic) using Jest.
- Conduct user acceptance testing (UAT) with Kitale wholesalers.
- Test offline sync in low-network conditions.
- Fix bugs, optimize performance, and deploy to Vercel.
- Document setup and usage for wholesalers and SaaS onboarding.
- **Deliverables:** Deployed MVP, user guide, pilot feedback.

---

## 5. Key Considerations
- **Multi-Tenancy:** Row-level security and store scoping for all data.
- **High Transaction Volume:** Supabase PostgreSQL and Next.js API routes scale for thousands of transactions across stores.
- **Multiple Users:** Role-based access for admins, store managers, and cashiers.
- **Kitale's Connectivity:** Offline sync prioritized after core features.
- **KRA Compliance:** eTIMS integration is mandatory; test with KRA's sandbox API early.
- **M-Pesa:** Integrate Paybill/Till Number API for payments.
- **Hardware:** Use PDF invoices for MVP; defer Bluetooth printer support.

---

## 6. Team & Tools
- **Team:** 2 React Developers, 1 Backend Developer, 1 UI/UX Designer, 1 QA Tester.
- **Frontend:** Next.js 14, Tailwind CSS, next-pwa, Dexie.js, Tanstack Query.
- **Backend:** Supabase (PostgreSQL, Auth, Edge Functions).
- **Testing:** Jest, Postman.
- **CI/CD:** Vercel, GitHub.
- **Budget:** Supabase & Vercel free tiers; budget for low-end Android phones/desktops for testing.

---

## 7. Post-MVP Roadmap
- Hardware integration (Bluetooth printer, barcode scanning).
- Advanced reporting (Power BI, Supabase views).
- Multi-branch sync and analytics.
- Native app (Flutter) if PWA performance is insufficient.
- Store-level branding and white-labeling.

---

## 8. Critical Notes
- Pilot with wholesalers to validate offline sync, VAT compliance, and multi-store logic.
- Monitor KRA's API updates; use mock APIs if sandbox is delayed.
- Test on low-end devices for usability.
- Stick to free tiers for MVP to control costs.

---

## 9. Sample Code Snippets

### A. Supabase Schema (SQL) for Multi-Store
```sql
CREATE TABLE stores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  address TEXT,
  vat_number TEXT,
  kra_pin TEXT,
  mpesa_details JSONB
);

CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID REFERENCES stores(id),
  name TEXT NOT NULL,
  sku TEXT UNIQUE,
  quantity INTEGER NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  vat_status BOOLEAN DEFAULT TRUE,
  category TEXT
);

CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID REFERENCES stores(id),
  product_id UUID REFERENCES products(id),
  quantity INTEGER NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  vat_amount DECIMAL(10,2) DEFAULT 0,
  payment_method TEXT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  synced BOOLEAN DEFAULT FALSE
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID REFERENCES stores(id),
  email TEXT UNIQUE NOT NULL,
  role TEXT CHECK (role IN ('super-admin', 'admin', 'store-manager', 'cashier')),
  password_hash TEXT NOT NULL
);
```

### B. Next.js PWA Setup (next.config.js)
```js
const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  scope: '/',
});

module.exports = withPWA({
  reactStrictMode: true,
});
```

### C. Offline Transaction Storage (Dexie.js)
```js
import Dexie from 'dexie';

const db = new Dexie('POSDatabase');
db.version(1).stores({
  transactions: '++id, product_id, quantity, total, vat_amount, payment_method, timestamp, synced',
});

export async function saveTransaction(transaction) {
  await db.transactions.add({ ...transaction, synced: false, timestamp: new Date() });
}

export async function syncTransactions() {
  const unsynced = await db.transactions.where('synced').equals(0).toArray();
  for (const tx of unsynced) {
    try {
      // Call Supabase API to sync
      await fetch('/api/sync-transaction', { method: 'POST', body: JSON.stringify(tx) });
      await db.transactions.update(tx.id, { synced: true });
    } catch (error) {
      console.error('Sync failed:', error);
    }
  }
}
```

### D. eTIMS Integration (Next.js API Route)
```js
// pages/api/etims.js
export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { invoiceData } = req.body;
    try {
      const response = await fetch('https://etims.kra.go.ke/api/invoice', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer KRA_TOKEN' },
        body: JSON.stringify(invoiceData),
      });
      const result = await response.json();
      res.status(200).json(result);
    } catch (error) {
      res.status(500).json({ error: 'eTIMS submission failed' });
    }
  }
}
``` 

the app will have a styling and structure similar to that of Paystack company website, start with making a layout/sidebar/navbar and color theme similar to Paystack @https://dashboard.paystack.com/ 


npx supabase gen types typescript --project-id xugqiojkjvqzqewugldk --schema public > src/types/supabase.ts
```

---

## 10. Responsive Design InitiativeP

To ensure optimal usability on all devices, especially mobile phonesP, we are launching a comprehensive responsive design initiative. This will target breakpoints at 480px, 409px, and 380px, and will involve refactoring layouts, components, and pages for mobile-friendliness while preserving all critical functionalities. For detailed steps, see `docs/responsive-design-plan.md`.