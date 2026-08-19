# AI Productivity Platform — Architecture

Phase 0 audit of the existing standalone Todo app, plus the proposed incremental architecture.

This document is the source of truth for rollout. It does **not** authorize implementation of later phases until each phase is explicitly requested.

Related: [architecture.md](./architecture.md), [database.md](./database.md), [api.md](./api.md), [deployment.md](./deployment.md).

---

## 1. Current architecture (as implemented)

### 1.1 Product

Standalone personal productivity app. Independent from WalkZero/HRMS.

**Live (do not break):**

| Layer | URL / host |
|-------|------------|
| Frontend | Vercel (Angular SPA) |
| Backend | `https://todo-app-api-kcr1.onrender.com` |
| GraphQL | `https://todo-app-api-kcr1.onrender.com/graphql` |
| Health | `https://todo-app-api-kcr1.onrender.com/health` |
| Database | Neon PostgreSQL |

Repo: GitHub `BANO07/to-do-app`.

### 1.2 Monorepo

```
todo-app/
├── apps/backend/          NestJS 11 GraphQL API
├── apps/frontend/         Angular 19 SPA
├── docs/
├── scripts/
├── docker-compose.yml     Local Postgres on 5434
├── render.yaml            Render web service (rootDir: apps/backend)
├── package.json           npm workspaces
└── .env.example
```

Root scripts: `start:backend`, `start:frontend`, `build`, `test:backend`, `migrate:run`.

### 1.3 Request flow

```
Browser (Angular 19)
  ├─ GET {API}/auth/google          → Google OAuth
  ├─ POST {API}/auth/logout         → clears httpOnly cookie
  └─ POST {API}/graphql             → Apollo, withCredentials: true
        ↓
NestJS (Helmet, CORS, cookie-parser, trust proxy)
  GqlThrottlerGuard (100/min) + GqlAuthGuard (JWT)
        ↓
Resolver → Service → Repository (always filters by user.id)
        ↓
PostgreSQL (TypeORM, synchronize: false)
```

OAuth:

```
Frontend → GET /auth/google
Google → GET /auth/google/callback
Backend sets cookie access_token, redirects FRONTEND_URL/dashboard
```

### 1.4 Backend modules (reuse these)

| Module | Path | Responsibility |
|--------|------|----------------|
| auth | `apps/backend/src/modules/auth/` | Google OAuth, JWT cookie, REST logout, GraphQL `me` |
| tasks | `apps/backend/src/modules/tasks/` | CRUD, filters, pagination, complete/reopen/archive, subtasks, recurrence, reminder persistence |
| users | `apps/backend/src/modules/users/` | Persistence + `updateMyTimezone` |
| categories | `apps/backend/src/modules/categories/` | CRUD, unique `(userId, name)`, seed defaults |
| dashboard | `apps/backend/src/modules/dashboard/` | `dashboardSummary` metrics |

**Patterns to keep:**

- Resolver → Service → Repository
- `@UseGuards(GqlAuthGuard)` + `@CurrentUser()` — never trust client `userId`
- `findByIdForUser(id, userId)` on every resource
- Code-first GraphQL → `apps/backend/src/schema.gql`
- Offset pagination: `TaskConnection { items, pageInfo }`
- Migrations only: `apps/backend/src/database/migrations/`

### 1.5 Auth and security (current)

| Mechanism | Implementation |
|-----------|----------------|
| Cookie | `access_token`, httpOnly, Secure in production, SameSite=None prod / Lax local, 7d |
| JWT payload | `{ sub, email }` |
| Extractors | Cookie then `Authorization: Bearer` |
| CORS | Single origin `FRONTEND_URL`, `credentials: true` |
| Helmet | Enabled (`crossOriginResourcePolicy: cross-origin`) |
| ValidationPipe | whitelist, forbidNonWhitelisted, transform |
| Throttler | Global 100/min; OAuth routes 10/min |
| GraphQL errors | `GraphqlExceptionFilter` — generic 500 to client |
| DB SSL | Production `{ rejectUnauthorized: false }` (Neon-compatible, weaker MITM protection) |

**Google scopes today:** `email`, `profile` only. Calendar must use a **separate connect flow** with calendar scopes.

### 1.6 GraphQL surface (current)

**Queries:** `me`, `tasks(filter)`, `task(id)`, `subtasks(taskId)`, `reminders(taskId)`, `categories`, `dashboardSummary`

**Mutations:** `createTask`, `updateTask`, `completeTask`, `reopenTask`, `archiveTask`, `deleteTask`, `stopRecurrence`, `createSubtask`, `updateSubtask`, `completeSubtask`, `reopenSubtask`, `deleteSubtask`, `createReminder`, `updateReminder`, `deleteReminder`, `updateMyTimezone`, `createCategory`, `updateCategory`, `deleteCategory`, `logout` (no-op; cookie cleared via REST)

**Enums:** `TaskStatus` (TODO, IN_PROGRESS, COMPLETED, ARCHIVED), `TaskPriority`, `TaskListView`, `TaskSortField`, `SortOrder`, `SubtaskStatus`, `RecurrenceFrequency`, `ReminderChannel`

Frontend operations: `apps/frontend/src/app/core/graphql/operations.ts` (hand-written `gql`, no codegen).

**Phase B additions:** `updateMyTimezone`, `subtasks` CRUD, `reminders` CRUD, `stopRecurrence`, `Task.progress`, `Task.recurrence`, optional `recurrence` / `stopRecurrence` on task create/update. `me` includes `ianaTimezone`.

### 1.7 Database (current)

Migrations:

- `1723900000000-InitialSchema.ts` — `users`, `categories`, `tasks`
- `1724000000000-AdvancedTasksFoundation.ts` — `users.iana_timezone`, `tasks.series_id` / `occurrence_date`, `subtasks`, `recurrence_rules`, `reminders`

Task fields: title, description, status, priority, due_date, completed_at, category_id, series_id, occurrence_date.

Indexes: user-scoped composites on status, due_date, category_id, created_at, plus series/subtask/reminder indexes. Partial unique `(series_id, occurrence_date)`.

### 1.8 Frontend (current)

Standalone Angular 19, Apollo, SCSS tokens, glass UI, theme/background picker.

| Area | Location |
|------|----------|
| Routes | `app.routes.ts` — dashboard, tasks views, categories, settings |
| Auth | `AuthService` — Google redirect, `me` query, REST logout |
| Tasks UI | `TasksPageComponent` + `TaskCardComponent` + `TaskFormComponent` |
| Quick add | `QuickAddComponent` + `quick-add.parser.ts` (`@Category`, today/tomorrow, `!high`) |
| Toasts | `ToastService` + `ToastContainerComponent` (in-app only; Undo recreates task) |
| Shortcuts | `/` search, `N` new task, `Esc` close |
| Preferences | landing page, compact layout, motion, background style |

**Not present:** PWA, kanban, calendar grid, AI chat, voice, attachments, push, email, in-app notification center.

### 1.9 Deployment (current)

| File | Role |
|------|------|
| `render.yaml` | `rootDir: apps/backend`, `npm ci --include=dev && npm run migrate:run && npm run build`, health `/health` |
| `apps/frontend/vercel.json` | SPA rewrite to `index.html` |
| `apps/frontend/scripts/set-env.js` | Injects `API_URL` into `environment.prod.ts` at Vercel build |

Required backend env (validated): `DATABASE_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`, `JWT_SECRET` (≥32), `FRONTEND_URL`, `BACKEND_URL`. Optional: `PORT`, `JWT_EXPIRES_IN`, `NODE_ENV`.

### 1.10 Tests (current)

| File | Coverage |
|------|----------|
| `auth.service.spec.ts` (backend) | Google upsert + inactive user |
| `tasks.service.spec.ts` | Ownership on find/complete/delete |
| `auth.service.spec.ts` (frontend) | Unauthenticated + Google URL |
| `test/app.e2e-spec.ts` | **Stale Nest starter** (`GET /` Hello World) — will fail |

### 1.11 Known gaps to fix during rollout (not blockers for Phase 0)

- Dashboard `todayCompleted` / `completionPercentage` used to be ~0 because TODAY view excludes COMPLETED. **Fixed in Phase B** via dedicated due-today counts in the user's timezone. Completion rate is `completed due today ÷ (Open + In Progress + Completed due today)`. The UI shows "—" when there are no eligible tasks.
- GraphQL `logout` does not clear the cookie; frontend correctly uses REST `/auth/logout`.
- `GET /auth/status` returns full User entity including `googleId`.
- Cookie `maxAge` hardcoded 7d vs `JWT_EXPIRES_IN`.
- TODAY/OVERDUE used **server local midnight**. **Fixed in Phase B** (`getZonedDayBounds` + `users.iana_timezone`).
- `TODO` remains the stored status; the UI labels it **Open**. Status changes use the same `tasks.status` field (Open → In Progress → Completed).
- Archived tasks have a dedicated `/tasks/archived` view with restore.
- No CSRF token (CORS origin + SameSite=None for split Vercel/Render).
- Health check does not probe the database.
- GraphQL introspection still enabled in production.

### 1.12 What does **not** exist (greenfield)

No `@nestjs/schedule`, mailer, web-push, Gemini/OpenAI SDK, calendar SDK, file storage, queues, or AI modules.

Do **not** duplicate: task CRUD, category CRUD, Google login, JWT cookies, dashboard query, toast UI, quick-add parser, GqlAuthGuard, user-scoped repositories.

---

## 2. Proposed architecture

Extend existing layers. New capabilities are **modules**, not a rewrite.

```
Angular SPA
  ├─ existing GraphQL (tasks, categories, dashboard, me)
  ├─ AI chat / voice / attachments  ──► GraphQL AI operations
  ├─ notification center            ──► GraphQL notifications
  ├─ calendar connect               ──► REST OAuth (calendar scopes) + GraphQL
  └─ Web Push subscribe             ──► GraphQL / REST (public VAPID only)
           │
           ▼
NestJS
  ├─ existing auth / tasks / categories / dashboard
  ├─ reminders + scheduler (@nestjs/schedule)
  ├─ notifications (in-app, email, push)
  ├─ ai (AIService → AIProvider → GeminiProvider)
  │     └─ tools call existing TasksService / CategoriesService only
  ├─ attachments (StorageProvider)
  └─ calendar (CalendarProvider, separate OAuth tokens)
           │
           ▼
Neon PostgreSQL (migrations only)
```

### 2.1 Module map (new)

| Module | Depends on | Must not depend on |
|--------|------------|--------------------|
| `subtasks` (or extend `tasks`) | TasksService, GqlAuthGuard | AI, calendar |
| `reminders` | tasks, notifications | AI |
| `notifications` | EmailProvider, PushProvider | Gemini |
| `ai` | AIProvider, AIUsageService, existing domain services | TypeORM repositories directly for mutations |
| `attachments` | StorageProvider, AI (optional) | public buckets |
| `calendar` | CalendarProvider, separate Google tokens | login access_token |
| `activity` | domain events from services | |

### 2.2 AI provider abstraction

```
Angular  ──never calls Gemini──►  GraphQL
                                    AIResolver (GqlAuthGuard)
                                    AIUsageService (daily + per-minute limits)
                                    AIConversationService
                                    AIService
                                      AIProvider.generateResponse / generateStructuredResponse
                                      GeminiProvider (first impl)
                                    AI tools → TasksService / CategoriesService / RemindersService
```

`interface AIProvider` lives in backend. Swapping Gemini later must not change GraphQL or Angular.

### 2.3 Tool calling (mandatory)

AI **never** runs SQL. Tools:

`getTasks`, `getTask`, `createTask`, `updateTask`, `deleteTask`, `completeTask`, `reopenTask`, `createSubtask`, `getCategories`, `getDashboardStats`, `getReminders`, `createReminder`, `updateReminder`, `deleteReminder`

Each tool: authenticate → ownership → validate DTO → existing service → structured result.

**Reads:** auto-execute. **Mutations:** confirmation UI when destructive or ambiguous (e.g. delete many). Planner/review never silently writes.

### 2.4 Notification architecture

```
Reminder due / overdue job / AI suggestion
  → NotificationService.create(userId, type, payload)
  → persist notification (in-app)
  → if prefs allow and not quiet hours:
       PushProvider.send (VAPID)
       EmailProvider.send
```

Channels: `IN_APP`, `PUSH`, `EMAIL`. Deduplicate by `(userId, type, taskId, scheduledFor)` or equivalent unique key.

Quiet hours: skip PUSH/EMAIL except critical (optional flag). Always persist IN_APP.

### 2.5 Calendar architecture

Separate Google OAuth client **or** incremental authorization with calendar scopes when the user clicks Connect.

Store refresh tokens encrypted at rest in `calendar_connections`. Login JWT is **not** reused for Calendar API.

Sync: upsert by Google `event.id`. No infinite loop: task→event writes a metadata flag; inbound sync ignores events we created unless user edits them.

AI planning **reads** calendar; creating events requires confirmation.

### 2.6 Voice

Same AI tools as text. Pipeline: STT (browser) → language detect → AIService → optional TTS (browser). Push-to-talk only. Locale list is config, not hardcoded business branches.

### 2.7 Storage

`StorageProvider`: local disk in development, S3-compatible later. Signed/private GET. MIME + size validation. Owner-only access.

---

## 3. Database changes

All via **new TypeORM migrations**. Never `synchronize: true`. UUIDs, `user_id` FKs, CASCADE/SET NULL consistent with existing schema.

| Table | Purpose | Key constraints |
|-------|---------|-----------------|
| `subtasks` | Child items of a task | FK task_id, user_id; index (user_id, task_id) |
| `recurrence_rules` | Recurrence attached to a task | 1:1 or 1:n with tasks; no duplicate generation without `last_generated_at` / occurrence key |
| `reminders` | Multiple reminders per task | FK task_id, user_id; `fire_at`, `channel`, `sent_at` unique per fire |
| `notifications` | In-app inbox | user_id, read_at, type |
| `notification_preferences` | Per-user prefs + quiet hours | unique user_id |
| `push_subscriptions` | Web Push endpoints | unique endpoint; user_id |
| `ai_conversations` | Chat threads | user_id |
| `ai_messages` | Role + content | conversation_id, user_id |
| `ai_usage` | Daily counters | **unique (user_id, date)**; atomic increment |
| `attachments` | File metadata | user_id, optional task_id; storage key |
| `calendar_connections` | OAuth tokens | unique user_id; encrypted refresh token |
| `calendar_sync_metadata` | Cursor / etag | user_id |
| `activity_logs` | Audit | user_id, entity_type, entity_id |

Also add to `tasks` (migration alter): `estimated_duration_minutes` (nullable), `timezone` or store user timezone on `users` (`iana_timezone`, default UTC) for correct TODAY/OVERDUE.

**Recurrence design (no accidental duplicates):**

- Store rule on the **template** task (`recurrence_rules`).
- Generate the **next occurrence** only after the current one is completed/archived, **or** generate dated instances with unique `(series_id, occurrence_date)`.
- Prefer instance table keyed by occurrence date so edits to one day do not rewrite the series unless the user chooses “all future”.

**AI usage race:** `INSERT ... ON CONFLICT (user_id, date) DO UPDATE SET total = total + 1 WHERE total < :limit RETURNING *`. Reject if no row returned.

Do not create tables until the phase that needs them.

---

## 4. GraphQL changes (conventions)

Keep code-first, `TaskConnection` pagination, `@UseGuards(GqlAuthGuard)`, class-validator DTOs.

Additive operations (by phase):

- Subtasks: `subtasks(taskId)`, `createSubtask`, `updateSubtask`, `completeSubtask`, `reopenSubtask`, `deleteSubtask`; `Task.progress` (completed/total).
- Reminders: `reminders(taskId)`, `createReminder`, `updateReminder`, `deleteReminder`.
- Notifications: `notifications`, `unreadNotificationCount`, `markNotificationRead`, `markAllNotificationsRead`, `deleteNotification`, `notificationPreferences`, `updateNotificationPreferences`.
- Push: `registerPushSubscription`, `unregisterPushSubscription`.
- AI: `aiChat`, `aiConversations`, `clearAiConversation`, `aiUsage`; mutations that return `{ pendingConfirmation, toolCalls }` rather than silent writes.
- Attachments: `upload` via GraphQL multipart **or** REST upload + GraphQL metadata (prefer REST upload if Apollo multipart is painful; keep GraphQL for listing).
- Calendar: `calendarStatus`, `disconnectCalendar`; connect remains REST OAuth.

Do not add a parallel REST CRUD API for tasks.

Friendly AI limit error: GraphQL `extensions.code = AI_LIMIT_REACHED` + message using `AI_FREE_DAILY_LIMIT`.

---

## 5. Frontend changes

Reuse `ToastService`, `ConfirmDialogComponent`, `MainLayoutComponent`, `Gql` operations file, CSS variables, sidebar.

| Capability | UI |
|------------|----|
| Subtasks | Expandable section on task card / form |
| Reminders | Reminder chips + add offset/custom datetime |
| Recurrence | Rule picker on task form |
| Notifications | Bell in topbar, unread badge, panel |
| AI | Sidebar/topbar entry, slide-over chat, suggested prompts, confirmation cards for tools |
| Voice | Mic on AI panel, transcript edit, mute TTS |
| Attachments | Upload on task + AI composer |
| Calendar | Settings connect/disconnect; optional Calendar view |
| Views | List (existing), Kanban (status columns), Calendar (due dates + events) |
| PWA | Angular service worker + manifest (read-only cache first) |
| Analytics | Extend dashboard with real queries; fix TODAY completed bug first |

Angular **never** holds Gemini keys, VAPID private keys, or storage credentials. Public VAPID key only for push subscribe.

---

## 6. External integrations

| Concern | Interface | First implementation | Env |
|---------|-----------|----------------------|-----|
| LLM | `AIProvider` | Gemini | `GEMINI_API_KEY`, `AI_MODEL` |
| Email | `EmailProvider` | Resend or SMTP (TBD at Phase C) | `EMAIL_*` |
| Push | `PushProvider` | `web-push` VAPID | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` |
| Storage | `StorageProvider` | Local disk → R2/S3 later | `STORAGE_*` |
| Calendar | `CalendarProvider` | Google Calendar API | `GOOGLE_CALENDAR_CLIENT_*` (may share client ID with extra scopes) |

Business services depend on interfaces, not vendor SDKs.

---

## 7. Security model (target)

Keep current cookie JWT. Additional rules:

1. Authenticated user always from `req.user` / `@CurrentUser()`.
2. Every new table filtered by `user_id`.
3. AI tools call domain services only.
4. Confirmation for destructive/bulk AI mutations.
5. Attachments: MIME allowlist, size cap, sanitized names, private objects.
6. Calendar tokens encrypted; disconnect revokes refresh token.
7. No secrets in Git / frontend / logs.
8. AI: daily limit + per-minute throttle (config).
9. Helmet, CORS, httpOnly, SameSite=None+Secure in production (required for Vercel ↔ Render).
10. Fix `/auth/status` DTO leak when touching auth.
11. Prefer enabling GraphQL introspection off in production.

---

## 8. Rate limiting

| Layer | Default | Config |
|-------|---------|--------|
| Global GraphQL/HTTP | 100 / min (existing) | keep |
| OAuth | 10 / min (existing) | keep |
| AI per minute | 10 / min / user | `AI_RATE_LIMIT_PER_MINUTE` |
| AI per day (free) | 20 / user / UTC day | `AI_FREE_DAILY_LIMIT` |
| Notification send | skip duplicates + quiet hours | `NOTIFICATION_*` later |

---

## 9. Configuration (placeholders only)

Add to `.env.example` when each phase lands — never write real secrets:

```
AI_PROVIDER=gemini
GEMINI_API_KEY=
AI_MODEL=
AI_FREE_DAILY_LIMIT=20
AI_RATE_LIMIT_PER_MINUTE=10

VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:ops@example.com

EMAIL_PROVIDER=
EMAIL_FROM=
EMAIL_API_KEY=

STORAGE_PROVIDER=local
STORAGE_LOCAL_DIR=./uploads
STORAGE_MAX_BYTES=10485760

GOOGLE_CALENDAR_CALLBACK_URL=
```

---

## 10. Observability

Structured logs (existing filter + new modules): auth failures, GraphQL errors, AI failures/usage, notification/email/push failures, calendar sync, attachment processing.

Never log JWT, OAuth secrets, API keys, file contents, calendar tokens.

Health: keep `GET /health`; add optional `GET /health/ready` with DB ping (Terminus) without breaking Render’s existing `/health` path.

---

## 11. Testing strategy

Reuse `tasks.service.spec.ts` ownership pattern.

Critical cases:

- User A cannot read/update/delete User B tasks, subtasks, reminders, attachments, AI conversations, calendar connections.
- AI usage: 19 allowed, 20 allowed, 21st rejected; concurrent increments cannot exceed limit.
- AI tools: mutating tool without auth fails; tool cannot pass another user’s id.
- Recurrence does not insert duplicate occurrences for the same date.
- Reminders do not send twice (`sent_at`).

Fix or replace stale `test/app.e2e-spec.ts` when adding e2e.

---

## 12. Deployment / rollout

Do **not** change Render rootDir, Vercel SPA rewrite, or Neon as the DB.

- New env vars on Render as features ship.
- Migrations run in existing `render.yaml` build/migrate command.
- Frontend `API_URL` remains the Render origin.
- Google Console: add calendar callback URL only when Phase I ships.
- Render free tier cold start: AI first request may be slow; document, do not “fix” by rewriting host.

Rollout order (implementation phases after this audit):

| Phase | Name | Includes | Status |
|-------|------|----------|--------|
| A | This document | Audit only | Implemented (document) |
| B | Advanced tasks | Subtasks, recurrence, reminders (+ user timezone) | **Implemented** |
| C | Notifications | In-app, prefs, email abstraction, web push, scheduler | **Implemented** |
| D | AI core | Provider, usage table, rate limits | **Implemented** |
| E | AI chat + tools | Conversations, confirmation UI | Not implemented |
| F | Voice | STT/TTS, locales, same tools | Not implemented |
| G | Attachments | Storage + AI summarize/extract | Not implemented |
| H | Calendar | OAuth connect, sync, AI planning context | Not implemented |
| I | Planner / review | Plan My Day, weekly review (real stats) | Not implemented |
| J | UI / PWA | Kanban, calendar view, SW, dashboard charts | Not implemented |
| K | Security + observability + tests | Helmet/auth leaks, logging, ownership tests | Not implemented |

After each implementation phase: backend `nest build`, `npm test --workspace apps/backend`, frontend `build:local` (and production `build` when env is present), review migration, review GraphQL schema.

### Phase B implementation notes

- TODAY list view remains incomplete tasks due today. Dashboard `todayCompleted` counts **completed tasks due today** in the user timezone (separate from the list view).
- Recurrence generates only the **next** occurrence when the current one is completed. Unique `(series_id, occurrence_date)` prevents duplicates.
- **Limitation:** editing a rule (“all future”) updates `recurrence_rules` only. Already-created future task rows are not bulk-rewritten.
- **Limitation:** stopping recurrence deactivates the rule; leftover generated tasks remain until the user archives/deletes them.
- Reminders store `fire_at` / `channel` / `sent_at`. Phase C now delivers reminders through the single selected channel only.
- `Reminder.channel` remains the reminder-level delivery target. Preferences are enablement gates only, not fan-out rules.
- `Reminder.sent_at` stays null until the selected channel succeeds; failed `EMAIL` / `PUSH` deliveries remain retryable.
- Phase C adds an in-process reminder scheduler, notification preferences, push subscriptions, and in-app/email/push delivery audit records.

### Phase D implementation notes

- `ai_usage` tracks accepted AI requests per user per **UTC calendar day** with unique `(user_id, usage_date)`.
- Daily consumption uses PostgreSQL `INSERT ... ON CONFLICT ... DO UPDATE ... WHERE request_count < limit`.
- Per-minute AI throttling is in-memory per user (`AI_RATE_LIMIT_PER_MINUTE`, default 10) and is separate from the global GraphQL throttler.
- Order for future AI invocations: authenticate → per-minute check → atomic daily consume → provider call.
- Rejected limit checks do not increment `ai_usage`. Provider failures after a slot is accepted still consume the daily slot.
- `GEMINI_API_KEY` is optional; the app starts without it and `providerConfigured` is false.
- GraphQL exposes `aiUsage` only in Phase D; chat/conversations/tools remain Phase E+.

### Phase E implementation notes (implemented)

- Tables `ai_conversations` and `ai_messages` store per-user chat history with ownership enforced on every query.
- GraphQL: `aiConversations`, `aiConversation`, `aiMessages`, `createAiConversation`, `aiChat`, `confirmAiAction`, `deleteAiConversation`, `clearAiConversation`.
- `aiChat` flow: authenticate → per-minute limit → atomic daily consume (once per user message) → load bounded history → Gemini tool loop (max 5 rounds) → auto-run read tools → pause destructive mutations for confirmation.
- Fourteen tools call existing domain services (`TasksService`, `CategoriesService`, `DashboardService`, `RemindersService`, `SubtasksService`) — never TypeORM repositories directly.
- Destructive tools (`deleteTask`, `deleteReminder`) return `pendingConfirmation`; `confirmAiAction` executes a server-stored, user-bound, expiring confirmation token.
- Model/client `userId` arguments are stripped; ownership always comes from `@CurrentUser()`.
- Angular AI panel calls backend GraphQL only — never Gemini directly.
- Conversation titles are derived locally from the first user message (no extra model call).

---

## 13. Assumptions

- Single Gemini provider initially; interface ready for a second provider.
- Phase C email provider abstraction ships with a Resend-backed implementation plus a safe no-op fallback when email is not configured.
- Voice uses **browser** SpeechRecognition / speechSynthesis first (no extra vendor cost); server STT can replace later behind the same pipeline.
- Offline **writes** are out of scope until a conflict strategy exists (Phase J caches the shell and reads only).
- Recurring task generation runs in-process via `@nestjs/schedule` on Render (single instance). If multiple instances are added later, move generation to a lock or queue.

---

## 14. Setup (future, after implementation)

Documented here so Phase D+ does not invent a second README:

1. Keep existing Google login env vars.
2. Set `GEMINI_API_KEY` and `AI_FREE_DAILY_LIMIT` on Render.
3. Generate VAPID keys for push and configure them on Render. The public key is exposed through the authenticated GraphQL preferences query.
4. Run `npm run migrate:run` (already part of Render build).
5. Do not commit `.env`.
