# News Portal Backend

Enterprise-grade news portal backend built with **NestJS 11 (TypeScript)**, **PostgreSQL 18** (via TypeORM), **Redis caching**, and **Role-Based Access Control (RBAC)**.

---

## 🌟 Key Features

- **Editorial Workflow & Publishing Pipeline**:
  - **Reporters**: Create/edit draft articles, submit for review (`PENDING_REVIEW`).
  - **Chief Editors & Admins**: Review, approve, publish, schedule (`scheduledAt`), or archive.
  - Role protection guarantees reporters cannot self-publish.
- **Hierarchical Taxonomy**:
  - Nested category tree structure with ordering and slug-based routing.
  - Automatic tag resolution and creation.
- **High Performance & Redis Caching**:
  - Cached public category tree, breaking news feed, and featured top stories.
  - Automatic targeted cache eviction upon article publication or updates.
  - Asynchronous, non-blocking article view count increments.
- **Role-Based Access Control (RBAC)**:
  - 4 distinct roles: `ADMIN`, `CHIEF_EDITOR`, `REPORTER`, `READER`.
  - JWT access token authentication.
  - Pre-seeded default admin account on startup.
- **Validation & Environment Security**:
  - **Zod Schema Validation**: All API request payloads and DTOs are validated using Zod schemas (`createZodDto`).
  - **Fail-Fast Zod Env Validator**: Startup environment variables validated against strict Zod type constraints.
  - **Global Zod Error Handler**: Unhandled exceptions and Zod schema violations are caught and formatted with exact field-level validation errors.
- **Developer Experience & OpenAPI**:
  - Interactive Swagger OpenAPI UI available at `/api/docs`.
  - Containerized PostgreSQL 18 and Redis 7 via `docker-compose.yml`.
  - Rate limiting via `@nestjs/throttler`.

---

## 🛠 Tech Stack

- **Framework:** [NestJS 11](https://nestjs.com/) (TypeScript strict mode)
- **Database & ORM:** [PostgreSQL 18](https://www.postgresql.org/) with [TypeORM 0.3](https://typeorm.io/)
- **Caching:** [Redis 7](https://redis.io/) via [ioredis](https://github.com/redis/ioredis)
- **Validation:** [Zod](https://zod.dev/) & [nestjs-zod](https://github.com/risen228/nestjs-zod)
- **Authentication:** Passport JWT, bcryptjs
- **API Documentation:** OpenAPI / Swagger (`@nestjs/swagger`)

---

## 🚀 Getting Started

### 1. Prerequisites

- Node.js >= 20 (Tested on Node v24.15)
- Docker & Docker Compose (for PostgreSQL 18 & Redis)

### 2. Start PostgreSQL 18 & Redis

```bash
docker compose up -d
```

### 3. Configure Environment

Copy `.env.example` to `.env` (already done by default):

```bash
cp .env.example .env
```

### 4. Run Application

```bash
# Development mode with hot-reload
npm run start:dev

# Production build & run
npm run build
npm run start:prod
```

The API will be available at:
- **Base URL:** `http://localhost:3000/api/v1`
- **Swagger Documentation:** `http://localhost:3000/api/docs`

---

## 🔐 Default Admin Credentials

Upon the first boot, the system automatically initializes a default Administrator:

- **Email:** `admin@newsportal.com`
- **Password:** `AdminPassword123!`
- **Role:** `ADMIN`

---

## 📚 API Endpoints Overview

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| **POST** | `/api/v1/auth/register` | Public | Register a new Reader account |
| **POST** | `/api/v1/auth/login` | Public | Login and obtain JWT access token |
| **GET** | `/api/v1/articles` | Public | Get published articles feed with filters and pagination |
| **GET** | `/api/v1/articles/breaking` | Public (Cached) | Get breaking news banner headlines |
| **GET** | `/api/v1/articles/featured` | Public (Cached) | Get top featured stories |
| **GET** | `/api/v1/articles/:idOrSlug` | Public | Get full article details and increment view count |
| **POST** | `/api/v1/articles` | Reporter / Editor / Admin | Create draft or submit article |
| **GET** | `/api/v1/articles/editorial/list` | Reporter / Editor / Admin | View editorial queue with status filters |
| **PATCH** | `/api/v1/articles/:id` | Reporter / Editor / Admin | Edit article content |
| **PATCH** | `/api/v1/articles/:id/status` | Reporter / Editor / Admin | Update workflow status (Review, Publish, Archive) |
| **DELETE**| `/api/v1/articles/:id` | Chief Editor / Admin | Delete article |
| **GET** | `/api/v1/categories` | Public (Cached) | Get category tree |
| **POST** | `/api/v1/categories` | Chief Editor / Admin | Create category |
| **GET** | `/api/v1/tags` | Public | List tags |
| **POST** | `/api/v1/media/upload` | Reporter / Editor / Admin | Upload media file (multipart/form-data) |
| **GET** | `/api/v1/users` | Chief Editor / Admin | List user accounts |

## 🗄 Database Migrations

TypeORM migrations can be run or inspected via npm scripts:

```bash
# Run all pending migrations
npm run migration:run

# Revert the last executed migration
npm run migration:revert

# Show migration status
npm run migration:show

# Generate a new migration from entity schema changes
npm run migration:generate -- src/database/migrations/NewMigrationName

# Create an empty migration file
npm run migration:create -- src/database/migrations/ManualMigrationName
```

---

## 🧪 Testing & Quality Gates

```bash
# Run unit tests
npm test

# Run linter
npm run lint

# Compile TypeScript
npm run build
```
