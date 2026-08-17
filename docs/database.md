# Database Design

PostgreSQL with TypeORM migrations (`synchronize: false`).

## Entities

### users
- `id` UUID PK
- `google_id` unique
- `email` unique
- `name`
- `avatar_url`
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
- `due_date`, `completed_at`
- `category_id` FK → categories (nullable, SET NULL on delete)

## Indexes

- `users.google_id`, `users.email`
- `categories.user_id`
- `tasks(user_id, status)`
- `tasks(user_id, due_date)`
- `tasks(user_id, category_id)`
- `tasks(user_id, created_at)`

## Migrations

```bash
cd apps/backend
npm run migrate:run
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
