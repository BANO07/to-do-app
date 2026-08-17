# Todo App

A standalone, production-ready personal productivity application built with Angular, NestJS, GraphQL, and PostgreSQL.

Sign in with Google, manage tasks and categories, and track daily productivity — completely independent from HRMS/WalkZero.

## Features

- Google OAuth 2.0 sign-in
- Private per-user task workspace
- Task CRUD with priority, due dates, categories
- Complete, reopen, archive, delete tasks
- Server-side search, filter, sort, pagination
- Dashboard with today/overdue/upcoming metrics
- Category management with default seed categories
- Responsive SaaS-style UI (mobile + desktop)
- Toast notifications with undo, empty states, skeleton loaders
- Bulk select: complete, archive, delete multiple tasks
- Quick add with smart parsing (`@Category`, `tomorrow`, `!high`)
- Keyboard shortcuts: `/` search, `N` new task, `Esc` close
- 9 background styles, themes, motion intensity, compact layout
- TypeORM migrations (no `synchronize` in production)

## Architecture

Monorepo layout:

```
todo-app/
├── apps/
│   ├── frontend/   # Angular 19 SPA
│   └── backend/    # NestJS 11 GraphQL API
├── docs/
├── docker-compose.yml
├── .env.example
└── README.md
```

See [docs/architecture.md](./docs/architecture.md) for details.

## Tech Stack

**Frontend:** Angular 19, TypeScript, RxJS, Apollo GraphQL, SCSS

**Backend:** NestJS 11, GraphQL, TypeORM, PostgreSQL, Passport Google OAuth, JWT

## Requirements

- Node.js 20+ (22 LTS recommended)
- npm 10+
- PostgreSQL 14+
- Google Cloud OAuth credentials

## Local Setup

### 1. Clone and install

```bash
cd todo-app
cp .env.example .env
npm install --workspace apps/backend
npm install --workspace apps/frontend
```

### 2. Start PostgreSQL

```bash
docker compose up -d postgres
```

### 3. Configure environment

Edit `.env` at repo root (backend loads from root or `apps/backend/.env`).

Required variables:

```
DATABASE_URL=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback
JWT_SECRET=
FRONTEND_URL=http://localhost:4200
BACKEND_URL=http://localhost:3000
```

### 4. Run migrations

```bash
npm run migrate:run --workspace apps/backend
```

### 5. Start backend

```bash
npm run start:backend
```

GraphQL playground: http://localhost:3000/graphql

### 6. Start frontend

```bash
npm run start:frontend
```

App: http://localhost:4200

## Google OAuth Setup

1. Create a project in [Google Cloud Console](https://console.cloud.google.com/)
2. Configure OAuth consent screen (External)
3. Create OAuth Client ID (Web application)
4. Authorized JavaScript origins: `http://localhost:4200`
5. Authorized redirect URIs: `http://localhost:3000/auth/google/callback`
6. Copy Client ID/Secret to `.env`

Production URLs are documented in [docs/deployment.md](./docs/deployment.md).

## Database Setup

Uses PostgreSQL with TypeORM migrations.

```bash
cd apps/backend
npm run migrate:run
npm run migrate:revert   # undo last migration
```

Schema details: [docs/database.md](./docs/database.md)

## Running Backend

```bash
cd apps/backend
npm run start:dev      # development
npm run build && npm run start:prod  # production
```

## Running Frontend

```bash
cd apps/frontend
npm start              # development
npm run build          # production build
```

## Testing

```bash
npm run test:backend
npm run test:frontend
```

Backend tests cover auth and task ownership/completion logic.

## Production Build

```bash
npm run build
```

- Backend output: `apps/backend/dist`
- Frontend output: `apps/frontend/dist/frontend/browser`

## Deployment

See [docs/deployment.md](./docs/deployment.md) for Vercel + Render + Neon setup.

```bash
# Print env var checklist + JWT secret
bash scripts/deploy-checklist.sh

# Verify builds before pushing
bash scripts/verify-deploy.sh
```

## Security

- OAuth secrets and JWT secret via environment variables only
- httpOnly JWT cookie
- GraphQL auth guard on protected operations
- User ownership enforced in repositories/services
- CORS restricted to frontend origin
- Rate limiting on auth endpoints
- No raw DB errors exposed to clients

## API Reference

See [docs/api.md](./docs/api.md).

## Future Improvements

- Recurring tasks and reminders
- Dark mode and PWA/offline support
- Subtasks, labels, attachments
- Team/shared tasks and collaboration
- Calendar integration

## License

Private / internal use.
