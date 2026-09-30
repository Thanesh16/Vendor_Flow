# VENDORFLOW — Vendor Management System

A production-grade MERN stack enterprise procurement portal for onboarding suppliers, evaluating vendor performance, and managing purchase order lifecycles.

> **Current Status: Phase 5 Complete — Vendor Onboarding Workflow**
>
> **Completed Phases:**
> - **Phase 1:** Clean MERN architecture, responsive layout tokens, and API health check
> - **Phase 2:** MongoDB integration, Mongoose configuration, and 7 foundational data models
> - **Phase 3:** User authentication, bcrypt password hashing, JWT generation, RBAC middleware, protected routes, and authentication UI
> - **Phase 4:** Responsive application layout (Sidebar + Header), role-based dashboards (Admin, Procurement, Vendor) powered by live MongoDB queries, and future module placeholder routing
> - **Phase 5:** End-to-end Vendor Onboarding workflow with profile submission (`PENDING`), review management (`UNDER_REVIEW`), approval/rejection (`APPROVED` / `REJECTED`), strict ownership enforcement, and live database synchronization

---

## Technology Stack

### Frontend
- **React (v18)** - Component-based user interface
- **Vite** - High-speed modern bundler
- **React Router (v6)** - Dynamic routing with role-guarded layout wrappers (`AppLayout`, `ProtectedRoute`)
- **Axios** - HTTP client configured with JWT request interceptors
- **Modern CSS** - Modular design system with design tokens, responsive tables, review modals, and status badges

### Backend
- **Node.js & Express.js** - REST API backend
- **Mongoose (v8/v9)** - MongoDB object modeling and live count aggregation
- **bcryptjs** - Salted password hashing (passwords never stored or returned in plaintext)
- **jsonwebtoken (JWT)** - Cryptographically signed authentication tokens with 24h expiration
- **CORS & dotenv** - Cross-origin security and environment variable management

### Database
- **MongoDB** - Document database on `mongodb://127.0.0.1:27017/vendor_management`

---

## Vendor Onboarding Workflow

```text
       VENDOR USER                                 ADMIN / PROCUREMENT MANAGER
 ─────────────────────────                     ───────────────────────────────────
 1. Submit Onboarding Form ──> [ PENDING ]
                                    │
                                    ├───> 2. Click "Start Review" ──> [ UNDER_REVIEW ]
                                    │                                        │
                                    │                                        ├──> 3. Click "Approve" ──> [ APPROVED ]
                                    │                                        │
                                    │                                        └──> 3. Click "Reject"  ──> [ REJECTED ]
                                    │
                                    └───> (Optional Direct Action) ─────────────> [ APPROVED / REJECTED ]
```

### Strict Ownership & Role Permissions

| Operation | ADMIN | PROCUREMENT_MANAGER | VENDOR |
| :--- | :---: | :---: | :---: |
| **View All Vendors (`GET /api/vendors`)** | Allowed | Allowed | Denied (403) |
| **View Own Profile (`GET /api/vendors/profile/me`)** | Denied (Vendor only) | Denied (Vendor only) | Allowed |
| **View Specific Vendor (`GET /api/vendors/:id`)** | Allowed | Allowed | Own Record Only (403 otherwise) |
| **Submit Onboarding (`POST /api/vendors`)** | Allowed | Allowed | Allowed (1 per account) |
| **Update Own Profile (`PUT /api/vendors/:id`)** | Allowed | Allowed | Allowed (Cannot self-approve) |
| **Change Status (`PATCH /api/vendors/:id/status`)** | Allowed | Allowed | Denied (403) |

---

## Seeded Accounts & Credentials

To seed or refresh the environment to the official starting state, run `npm run seed`:

| Role | Email | Password | Status |
| :--- | :--- | :--- | :--- |
| **ADMIN** | `thaneshselvam4@gmail.com` | `123456` | Pre-seeded |
| **PROCUREMENT_MANAGER** | `sanjai12@gmail.com` | `123456` | Pre-seeded |
| **EMPLOYEE** | *(User created via registration)* | *(User defined)* | Register via `/register` |
| **VENDOR** | *(User created via registration)* | *(User defined)* | Register via `/register` |

*The login page (`/login`) includes 1-click quick-fill buttons for the seeded Admin and Procurement Manager roles, with fields ready for Employee and Vendor accounts.*

---

## API Endpoints

### Vendor Management APIs (`/api/vendors`)
- `GET /api/vendors` — List all registered vendors with status (*Admin & Procurement Manager only*)
- `GET /api/vendors/profile/me` — Retrieve the authenticated vendor's own profile (*Vendor only*)
- `GET /api/vendors/:id` — Retrieve detailed vendor profile (*Admin, Procurement, or owning Vendor*)
- `POST /api/vendors` — Submit vendor onboarding form (forces `PENDING` status; prevents duplicate accounts)
- `PUT /api/vendors/:id` — Update vendor profile details (*Ownership enforced for Vendors*)
- `PATCH /api/vendors/:id/status` — Review action to transition status (*Admin & Procurement only*)

### Dashboard APIs (`/api/dashboard`)
- `GET /api/dashboard/admin` — Total users, total vendors, pending approvals, purchase requests, purchase orders
- `GET /api/dashboard/procurement` — Active suppliers, pending reviews, purchase requests, orders requiring attention
- `GET /api/dashboard/vendor` — Scoped strictly to authenticated vendor: onboarding status, assigned orders, rating

### Authentication (`/api/auth`)
- `POST /api/auth/register` — Public vendor registration (strictly creates `VENDOR` account)
- `POST /api/auth/login` — Authenticates credentials, returns JWT token and sanitized user payload
- `GET /api/auth/me` — Protected endpoint returning the current user's profile

### System Health (`/api/health`)
- `GET /api/health` — Reports operational status and live MongoDB connection state

---

## Running the Application

### Option 1: Run Both Concurrently (Recommended)
From project root:
```bash
npm run dev
```

### Option 2: Run Separately

**Backend:**
```bash
cd backend
npm run dev
```
> Running on `http://localhost:5000`

**Frontend:**
```bash
cd frontend
npm run dev
```
> Running on `http://localhost:5173`

---

## Planned Architecture (Phases 6-19)

- **Phase 6:** Purchase Requests & Requisition Workflow
- **Phase 7:** Purchase Order Lifecycle & Fulfillment Tracking
- **Phase 8:** Vendor Evaluation & Performance Scoring
- **Phases 9-19:** Notifications, Reports, Audit Logs, and Final UX Hardening
