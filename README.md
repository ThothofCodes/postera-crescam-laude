# Postera Crescam Laude — Integrated Platform

**Author:** Thoth of Codes · `codeofthoth@outlook.com`  
**Stack:** MongoDB · Express · React · Node.js (MERN) · Socket.io  
**Location:** PCL Centre, Nairobi County, Kenya  

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Prerequisites](#2-prerequisites)
3. [Quick Start](#3-quick-start)
4. [Environment Variables](#4-environment-variables)
5. [API Keys Reference](#5-api-keys-reference)
6. [Features](#6-features)
7. [Access the Platform](#7-access-the-platform)
8. [Tech Hub (Astro)](#8-tech-hub-astro)
9. [API Documentation](#9-api-documentation)
10. [Security](#10-security)
11. [Performance](#11-performance)
12. [Troubleshooting](#12-troubleshooting)
13. [Project Structure](#13-project-structure)

---

## 1. Architecture Overview

```
  Browser (port 3000)              Infrastructure
  ┌──────────────┐         ┌──────────────────────┐
  │  React SPA   │────────▶│  Express API (:5001)  │
  │  (Vite dev)  │  proxy  │  Socket.IO · Zod      │
  └──────────────┘         └────────┬─────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
             ┌──────▼─────┐ ┌──────▼─────┐ ┌───────▼─────┐
             │  MongoDB   │ │   Redis    │ │    MinIO     │
             │  (:27017)  │ │  (:6379)   │ │ (:9000/9001)│
             │  Atlas     │ │  Cache     │ │  Object Store│
             └────────────┘ └────────────┘ └─────────────┘
                                                    │
                                          ┌─────────▼─────────┐
                                          │    LiveKit         │
                                          │  Video Conf.       │
                                          │    (:7880)         │
                                          └───────────────────┘
```

| Technology | Role |
|------------|------|
| **MinIO** | S3-compatible object storage (avatars, products, receipts) |
| **Redis** | API response caching, session storage |
| **Zod** | Request validation middleware |
| **LiveKit** | Self-hosted video conferencing |
| **Astro** | Static tech hub (tips, news, facts, articles) |
| **CSRF + httpOnly cookies** | XSS/CSRF prevention |

---

## 2. Prerequisites

| Tool | Version | Check |
|------|---------|-------|
| Node.js | 20.x+ | `node --version` |
| npm | 10.x+ | `npm --version` |
| MongoDB | 7.x+ | Atlas (cloud) or local `mongod` |
| Redis | 7.x+ | `redis-cli ping` (optional, falls back gracefully) |
| MinIO | Latest | `minio server /data` (required for file uploads) |
| Git | Any | `git --version` |

---

## 3. Quick Start

```bash
# Clone and setup
git clone https://github.com/Thothofcodes/pcl_solutions.git
cd pcl_solutions
make setup         # Install deps + generate secrets

# Fill in API keys
nano backend/.env

# Start everything
make dev           # Backend (:5001) + Frontend (:3000)

# Or start individually
make backend       # Backend only
make frontend      # Frontend only
```

### Makefile Commands

```bash
make setup         # Install dependencies + generate secrets
make dev           # Start backend + frontend
make backend       # Start backend only
make frontend      # Start frontend only
make stop          # Stop all Node processes
make status        # Check all services
make build         # Build frontend for production
make seed          # Seed database
make smoke         # Run smoke test
make clean-logs    # Remove temp log files
make help          # Show all commands
```

---

## 4. Environment Variables

Key sections from `backend/.env`:

| Variable | Description |
|----------|-------------|
| `NODE_ENV` | `development` or `production` |
| `PORT` | Backend port (default: `5001`) |
| `CLIENT_URL` | Frontend URL for CORS (default: `http://localhost:3000`) |
| `MONGO_URI` | MongoDB Atlas connection string |
| `JWT_SECRET` | JWT signing key |
| `CSRF_SECRET` | CSRF token signing |
| `REDIS_HOST` / `REDIS_PORT` | Redis connection (optional) |
| `MINIO_ENDPOINT` / `MINIO_ACCESS_KEY` | MinIO storage |
| `MPESA_CONSUMER_KEY` / `MPESA_PASSKEY` | M-Pesa payments |
| `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | Video conferencing |
| `EMAIL_HOST` / `EMAIL_USER` / `EMAIL_PASS` | SMTP email |
| `SANITY_PROJECT_ID` | Tech hub content |

---

## 5. API Keys Reference

| Service | Cost | Where to Register |
|---------|------|-------------------|
| **MongoDB Atlas** | Free tier | [cloud.mongodb.com](https://cloud.mongodb.com) |
| **Redis** | Free (self-hosted) | `apt install redis-server` |
| **MinIO** | Free (self-hosted) | [min.io](https://min.io) |
| **LiveKit** | Free tier | [livekit.io](https://livekit.io) |
| **M-Pesa Daraja** | Pay-per-use | [developer.safaricom.co.ke](https://developer.safaricom.co.ke) |
| **Sanity CMS** | Free tier | [sanity.io](https://sanity.io) |
| **Gmail SMTP** | Free | [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords) |

### How to Get Each Key

**M-Pesa (Safaricom Daraja):**
1. Go to [developer.safaricom.co.ke](https://developer.safaricom.co.ke)
2. Create account → Apps → Create New App
3. Select "Lipa Na M-Pesa Online" product
4. Copy Consumer Key, Consumer Secret, Passkey, and Shortcode

**MongoDB Atlas:**
1. Create free cluster at [cloud.mongodb.com](https://cloud.mongodb.com)
2. Database Access → Add user with read/write access
3. Network Access → Allow from anywhere (0.0.0.0/0) for dev
4. Copy connection string, replace `<user>` and `<password>`

**MinIO:**
1. `minio server /data --console-address ":9001"`
2. Open http://localhost:9001 → login with `minioadmin`/`minioadmin`
3. Buckets auto-created on first start

---

## 6. Features

### Core Business
- Multi-department management — Finance, Inventory, CRM, Booking, Consultation
- Role-based access — Super Admin, Admin, Staff with granular permissions
- M-Pesa payments — STK push, callback handling, receipt generation
- Public storefront — Products, services, bookings, consultations
- Client portal — Order tracking, payment history, receipts

### Real-time
- Socket.IO — Live chat, presence tracking, notifications
- Video conferencing — LiveKit-powered meetings
- Meeting scheduler — Create, share, manage video meetings

### Security
- CSRF protection + JWT in httpOnly cookies
- Rate limiting — tiered by role (public/write/auth)
- Brute-force protection — progressive delays
- Zod validation on all routes
- Cookie consent banner — GDPR compliant with 6-month re-consent

### Developer Experience
- API versioning — `/api/v1/` with `/api/` backward alias
- Swagger/OpenAPI docs
- Redis caching with auto-invalidation
- 102-point smoke test suite

---

## 7. Access the Platform

| Role | URL | Credentials |
|------|-----|-------------|
| **Public Storefront** | `http://localhost:3000` | Browse freely |
| **Super Admin** | `http://localhost:3000/admin/super` | `codeofthoth@outlook.com` |
| **Tech Hub** | `http://localhost:4321` | Public |
| **MinIO Console** | `http://localhost:9001` | `minioadmin` / `minioadmin` |

---

## 8. Tech Hub (Astro)

```bash
cd tech-hub
npm install
npm run dev    # → http://localhost:4321
```

---

## 9. API Documentation

### Versioning

All endpoints prefixed with `/api/v1/` (backward-compatible `/api/` alias accepted).

### Rate Limits

| Tier | Limit | Applies To |
|------|-------|-----------|
| Public | 200 req/15min | Unauthenticated reads |
| Write | 30 req/15min | Authenticated mutations |
| Auth | 10 req/15min | Login, register, password reset |

### Key Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/health` | No | Health check |
| `POST` | `/api/v1/auth/login` | No | Login |
| `GET` | `/api/v1/products` | No | List products |
| `POST` | `/api/v1/orders` | Yes | Create order |
| `GET` | `/api/v1/meetings/rooms` | Yes | List meetings |
| `GET` | `/api/docs` | No | Swagger UI |

---

## 10. Security

| Layer | Implementation |
|-------|---------------|
| **XSS** | JWT in httpOnly cookies |
| **CSRF** | Double-submit cookie with signed tokens |
| **Brute-force** | Progressive delays per IP |
| **Rate limiting** | Tiered: public, write, auth |
| **Input validation** | Zod schemas on all routes |
| **Security headers** | Helmet: CSP, HSTS, X-Content-Type-Options |
| **Webhook verification** | M-Pesa callback signature validation |

---

## 11. Performance

- **Redis caching** — Product listings, dashboard stats (30s TTL)
- **MongoDB indexes** — Covering indexes for aggregations
- **Connection pooling** — min 5, max 20 connections
- **Compression** — Brotli + gzip via Vite proxy

---

## 12. Troubleshooting

**Backend crashes on startup:**
```bash
cat backend/.env | grep -v "^#" | grep -v "^$"
LOG_LEVEL=debug node backend/server.js
```

**M-Pesa STK push not arriving:**
- Ensure `MPESA_CALLBACK_URL` is publicly reachable HTTPS
- For local dev: use ngrok

**Rate limiting too aggressive:**
Adjust in `backend/middleware/rateLimiter.js`

**Redis connection refused (non-fatal):**
Redis is optional — app works without it.

---

## 13. Project Structure

```
pcl_solutions/
├── backend/
│   ├── config/           # MongoDB, MinIO, Redis, LiveKit
│   ├── controllers/      # Route controllers
│   ├── middleware/        # Auth, CSRF, rate limit, validation
│   ├── models/           # 37 Mongoose schemas
│   ├── routes/           # 43 route files (versioned /api/v1/)
│   ├── test/             # Smoke test suite
│   ├── utils/            # Logger, cache, error tracker
│   └── server.js         # Entry point
├── frontend/
│   ├── src/
│   │   ├── admin/        # Admin panels
│   │   ├── components/   # Shared UI
│   │   ├── pages/        # Public, staff, client portals
│   │   └── utils/        # API, analytics, error tracker
│   └── vite.config.js    # Dev server with API proxy
├── tech-hub/             # Astro static site
├── .github/workflows/    # CI/CD
├── Makefile              # Native dev commands
└── README.md
```

---

© 2026 Postera Crescam Laude · PCL Centre, Nairobi County, Kenya  
Super Administrator: **Thoth of Codes** · `codeofthoth@outlook.com`
