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
NestJS GraphQL API (/graphql) + auth REST
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

Reminder delivery flow:

```
Reminder (persisted)
    ↓ scheduler scan (UTC fire_at, sent_at IS NULL)
NotificationService
    ├─ IN_APP → notifications table / inbox
    ├─ EMAIL → EmailProvider
    └─ PUSH  → PushProvider (VAPID)
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
| users | User persistence, `updateMyTimezone` |
| tasks | Task CRUD, filtering, pagination, subtasks, recurrence, reminders |
| categories | Category CRUD |
| dashboard | Productivity summary (user-timezone TODAY metrics) |
| notifications | Notification inbox, preferences, push subscriptions, reminder scheduler, email/push delivery |
| ai | Gemini provider, conversations, tool calling, confirmation flow, usage limits, `aiUsage` + chat GraphQL |

## AI architecture (Phase E)

```
Angular AI panel → GraphQL aiChat / confirmAiAction
    ↓
AiChatService (auth, limits, tool loop)
    ↓
GeminiProvider (function declarations)
    ↓
AiToolsService → TasksService / CategoriesService / DashboardService / RemindersService / SubtasksService
```

- Frontend never calls Gemini or stores API keys.
- Tool arguments from the model never override `@CurrentUser()` ownership.
- Message history is paginated/bounded to control token usage.

## Database

See [database.md](./database.md).

## Deployment

See [deployment.md](./deployment.md).

## Phase C Notes

- `Reminder.channel` remains a single selected delivery channel. Preferences do not fan one reminder out to multiple channels.
- `Reminder.sentAt` remains `null` until the selected channel succeeds.
- Scheduler comparisons stay in UTC because `reminders.fire_at` is stored as UTC.
- User IANA timezone is used only when rendering human-readable notification text.
- Idempotency is database-backed via reminder row locking plus a unique `notifications.idempotency_key`.
- Render free instances can sleep, so the in-process scheduler is best-effort and cannot guarantee exact-on-time delivery while the service is suspended.
