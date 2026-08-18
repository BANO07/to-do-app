# GraphQL API

Endpoint: `{BACKEND_URL}/graphql`

Authentication: httpOnly cookie (`access_token`) or `Authorization: Bearer <token>`

Ownership always comes from `@CurrentUser()`. Clients must never send `userId` for authorization.

## Queries

### `me`
Returns the authenticated user, including `ianaTimezone` (IANA, default `UTC`).

### `tasks(filter: TaskFilterInput)`
Paginated task list with server-side search/filter/sort.

`TODAY`, `UPCOMING`, and `OVERDUE` use the authenticated user's IANA timezone midnight boundaries. The TODAY **list** still shows incomplete tasks due today.

Each task includes:
- `progress { completed, total, percentage }` from actual subtasks
- `recurrence` when a series rule exists
- `seriesId`, `occurrenceDate`

Filter fields:
- `search`
- `status`
- `priority`
- `categoryId`
- `view` (`ALL`, `TODAY`, `UPCOMING`, `OVERDUE`, `COMPLETED`, `ARCHIVED`)
- `sortBy`, `sortOrder`
- `page`, `limit`

### `task(id: ID!)`
Single task owned by current user.

### `subtasks(taskId: ID!)`
Subtasks for a task owned by the current user.

### `reminders(taskId: ID!)`
Reminder configuration for a task owned by the current user.

Phase C delivery rule:
- `channel` remains the single selected delivery channel for that reminder
- preferences are channel enablement gates only
- `sentAt` stays null until the selected channel succeeds

### `notifications(filter: NotificationsInput)`
Paginated in-app notification inbox for the current user, newest first.

Filter fields:
- `unreadOnly`
- `page`
- `limit`

Only `IN_APP` notification rows are returned in the inbox query.

### `unreadNotificationCount`
Unread in-app notification badge count for the current user.

### `notificationPreferences`
Returns the current users delivery preferences plus server capability flags (`emailAvailable`, `pushAvailable`, `pushPublicKey`).

### `pushSubscriptions`
Web push subscriptions saved for the current user.

### `categories`
All categories for current user.

### `dashboardSummary`
Productivity metrics in the user's timezone.

- `todayOpen` — Open (`TODO`) tasks due today
- `todayInProgress` — In Progress tasks due today
- `todayPending` — `todayOpen + todayInProgress` (kept for compatibility)
- `todayCompleted` — completed tasks whose **due date** is today (not the TODAY list, which excludes COMPLETED)
- `todayTotal` — Open + In Progress + Completed due today (archived and deleted are excluded)
- `completionPercentage` — `todayCompleted / todayTotal × 100`, rounded. In Progress is in the denominator only. When `todayTotal` is 0 the API returns `0`; the UI shows "—" / "No tasks due today".
- `completedTodayCount` — tasks whose `completedAt` falls in the user's today window (separate from due-today completion)
- `overdueCount` / `upcomingCount` — incomplete, timezone-aware
- `totalActiveTasks` — Open + In Progress across all dates (not archived)

Task status source of truth is `tasks.status`:

- `TODO` is shown in the UI as **Open**
- Workflow: Open → In Progress → Completed
- `ARCHIVED` is a separate lifecycle (hidden from active lists; restore returns the task to Open)

## Mutations

| Mutation | Description |
|----------|-------------|
| `createTask` | Create task. Optional `recurrence` starts a series (`series_id` + `occurrence_date`). Optional `subtaskTitles` creates linked subtasks in the same request. One mutation creates one parent task. |
| `updateTask` | Update task fields including `status`. Optional `recurrence` or `stopRecurrence`. |
| `completeTask` | Mark completed. If the series is active, creates the **next** occurrence only. |
| `reopenTask` | Move completed task back to TODO (Open) |
| `archiveTask` | Archive task (removed from active lists) |
| `restoreTask` | Restore an archived task to TODO (Open) |
| `deleteTask` | Delete task |
| `stopRecurrence(taskId)` | Deactivate the series rule. Existing future rows are not deleted. |
| `createSubtask` | Create a subtask on an owned task |
| `updateSubtask` | Update title/description/position |
| `completeSubtask` / `reopenSubtask` | Toggle subtask completion |
| `deleteSubtask` | Delete a subtask |
| `createReminder` | Persist a reminder. `offsetMinutes`, `localDateTime` (user TZ), or `fireAt`. |
| `updateReminder` | Update fire time / channel |
| `deleteReminder` | Delete a reminder |
| `markNotificationRead` | Mark one owned in-app notification as read |
| `markAllNotificationsRead` | Mark all owned in-app notifications as read |
| `updateNotificationPreferences` | Update current-user notification preference flags |
| `savePushSubscription` | Save or replace a browser push subscription for the current user |
| `removePushSubscription` | Remove one owned push subscription |
| `updateMyTimezone(timezone)` | Set `users.iana_timezone` after IANA validation |
| `createCategory` | Create category |
| `updateCategory` | Update category |
| `deleteCategory` | Delete category |
| `logout` | Client-side logout marker (cookie cleared via REST) |

Reminder `channel`: `IN_APP`, `PUSH`, `EMAIL`.

Phase C delivery semantics:
- `IN_APP`: creates a durable inbox notification
- `EMAIL`: sends email only when `email_enabled=true`
- `PUSH`: sends web push only when `push_enabled=true`
- non-selected channels are never fanned out automatically
- failed `EMAIL`/`PUSH` deliveries remain retryable because `sentAt` stays null until success

## REST Auth Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/auth/google` | Start Google OAuth |
| GET | `/auth/google/callback` | OAuth callback |
| POST | `/auth/logout` | Clear auth cookie |
| GET | `/auth/status` | Check auth status |

## Error Handling

GraphQL errors return friendly messages. Internal errors are logged server-side only.
