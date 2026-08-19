# Database Design

PostgreSQL with TypeORM migrations (`synchronize: false`).

## Entities

### users
- `id` UUID PK
- `google_id` unique
- `email` unique
- `name`
- `avatar_url`
- `iana_timezone` IANA zone, default `UTC` (for example `Asia/Kolkata`)
- `created_at`, `updated_at`, `last_login_at`
- `is_active`

### categories
- `id` UUID PK
- `user_id` FK → users
- `name`, `description`, `icon`
- unique (`user_id`, `name`)

### tasks
- `id` UUID PK
- `user_id` FK → users
- `title`, `description`
- `status` enum: TODO, IN_PROGRESS, COMPLETED, ARCHIVED
- `priority` enum: LOW, MEDIUM, HIGH, URGENT
- `due_date`, `completed_at` (`timestamptz`, stored as UTC instants)
- `category_id` FK → categories (nullable, SET NULL on delete)
- `series_id` UUID (nullable) — recurrence series identity
- `occurrence_date` date (nullable) — civil date of this occurrence
- partial unique index `UQ_tasks_series_occurrence` on (`series_id`, `occurrence_date`) where both are not null

### subtasks
- `id` UUID PK
- `task_id` FK → tasks (CASCADE)
- `user_id` FK → users (CASCADE)
- `title`, `description`
- `status` enum: TODO, COMPLETED
- `position`
- `completed_at`, `created_at`, `updated_at`
- index (`user_id`, `task_id`)

### recurrence_rules
- `id` UUID PK
- `user_id` FK → users (CASCADE)
- `series_id` unique — shared with `tasks.series_id`
- `frequency` enum: DAILY, WEEKDAYS, WEEKLY, BIWEEKLY, MONTHLY, YEARLY, CUSTOM
- `interval` (default 1)
- `days_of_week` int[] (0 = Sunday … 6 = Saturday)
- `day_of_month`
- `start_date`, `end_date`
- `timezone` IANA zone copied from the user at rule creation
- `last_generated_occurrence`
- `is_active`
- Completing an occurrence inserts the **next** task only. Duplicate dates are rejected by `UQ_tasks_series_occurrence`.

### reminders
- `id` UUID PK
- `user_id` FK → users (CASCADE)
- `task_id` FK → tasks (CASCADE)
- `fire_at` timestamptz (UTC)
- `offset_minutes` nullable — relative to task due date
- `channel` enum: IN_APP, PUSH, EMAIL (single selected delivery channel)
- `sent_at` nullable — set only after the selected delivery channel succeeds
- indexes (`user_id`, `task_id`), (`fire_at`)

### notification_preferences
- `id` UUID PK
- `user_id` unique FK → users (CASCADE)
- `in_app_enabled` default `true`
- `email_enabled` default `true`
- `push_enabled` default `false`
- `reminder_enabled` default `true`
- `created_at`, `updated_at`

### push_subscriptions
- `id` UUID PK
- `user_id` FK → users (CASCADE)
- `endpoint` unique
- `p256dh`
- `auth`
- `created_at`, `updated_at`
- index (`user_id`, `created_at`)

### notifications
- `id` UUID PK
- `user_id` FK → users (CASCADE)
- `reminder_id` nullable FK → reminders (SET NULL)
- `task_id` nullable FK → tasks (SET NULL)
- `type` enum: `REMINDER`
- `channel` enum: IN_APP, PUSH, EMAIL
- `status` enum: PENDING, SENT, FAILED
- `title`, `message`
- `scheduled_at`, `delivered_at`, `read_at`
- `idempotency_key` unique
- `last_error` nullable
- `created_at`, `updated_at`
- indexes (`user_id`, `created_at`), (`user_id`, `read_at`), (`status`, `scheduled_at`), (`reminder_id`), (`task_id`)

### ai_usage
- `id` UUID PK
- `user_id` FK → users (CASCADE)
- `usage_date` date (UTC calendar day)
- `request_count` integer NOT NULL DEFAULT 0
- `created_at`, `updated_at`
- unique (`user_id`, `usage_date`)

### ai_conversations (Phase E)
- `id` UUID PK
- `user_id` FK → users (CASCADE)
- `title` varchar nullable
- `created_at`, `updated_at`
- index (`user_id`, `updated_at`)

### ai_messages (Phase E)
- `id` UUID PK
- `conversation_id` FK → ai_conversations (CASCADE)
- `user_id` FK → users (CASCADE) — must match conversation owner
- `role` enum: `USER`, `ASSISTANT`, `TOOL`
- `content` text
- `tool_name`, `tool_call_id`, `tool_status` nullable
- `metadata` jsonb nullable (internal; not exposed in GraphQL)
- `created_at`
- indexes (`conversation_id`, `created_at`), (`user_id`, `created_at`)

## Indexes

- `users.google_id`, `users.email`
- `categories.user_id`
- `tasks(user_id, status)`
- `tasks(user_id, due_date)`
- `tasks(user_id, category_id)`
- `tasks(user_id, created_at)`
- `tasks(user_id, series_id)`
- `subtasks(user_id, task_id)`
- `recurrence_rules(user_id)`
- `reminders(user_id, task_id)`, `reminders(fire_at)`
- `notification_preferences(user_id)`
- `push_subscriptions(endpoint)`, `push_subscriptions(user_id, created_at)`
- `notifications(user_id, created_at)`, `notifications(user_id, read_at)`, `notifications(status, scheduled_at)`, `notifications(reminder_id)`, `notifications(task_id)`, `notifications(idempotency_key)`
- `ai_usage(user_id, usage_date)`
- `ai_conversations(user_id, updated_at)`
- `ai_messages(conversation_id, created_at)`, `ai_messages(user_id, created_at)`

## Migrations

Do not edit `1723900000000-InitialSchema.ts`. Phase B lives in `1724000000000-AdvancedTasksFoundation.ts`. Phase C lives in `1724100000000-NotificationsPhaseC.ts`. Phase D lives in `1724200000000-AIFoundation.ts`. Phase E lives in `1724300000000-AIConversationsPhaseE.ts`.

```bash
cd apps/backend
npm run migrate:run
npm run typeorm -- migration:show
```

Revert last migration:

```bash
npm run migrate:revert
```

## Local PostgreSQL

```bash
docker compose up -d postgres
```

Connection string example:

```
postgresql://todo_user:todo_password@localhost:5434/todo_app
```
