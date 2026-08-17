# Todo App — Architecture

## Overview

Standalone personal productivity application with:

- **Angular 19** SPA frontend
- **NestJS 11** GraphQL API
- **PostgreSQL** database via TypeORM
- **Google OAuth 2.0** authentication with JWT httpOnly cookies

This project is intentionally independent from HRMS/WalkZero systems.

## High-Level Architecture

```
Browser (Angular)
    ↓ HTTPS + credentials
NestJS GraphQL API (/graphql)
    ↓
PostgreSQL
```

OAuth redirect flow:

```
Frontend → GET /auth/google
Google → GET /auth/google/callback
Backend → JWT cookie + redirect to frontend dashboard
```

## Backend Layers

```
Resolver → Service → Repository → TypeORM → PostgreSQL
```

## Security Model

- JWT stored in httpOnly cookie (`access_token`)
- GraphQL guarded with `GqlAuthGuard`
- All task/category queries scoped by authenticated user ID from token
- Frontend never sends `userId` for authorization decisions
- Rate limiting on auth routes via `@nestjs/throttler`

## Modules

| Module | Responsibility |
|--------|----------------|
| auth | Google OAuth, JWT, logout |
| users | User persistence |
| tasks | Task CRUD, filtering, pagination |
| categories | Category CRUD |
| dashboard | Productivity summary |

## Database

See [database.md](./database.md).

## Deployment

See [deployment.md](./deployment.md).
