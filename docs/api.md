# GraphQL API

Endpoint: `{BACKEND_URL}/graphql`

Authentication: httpOnly cookie (`access_token`) or `Authorization: Bearer <token>`

## Queries

### `me`
Returns the authenticated user.

### `tasks(filter: TaskFilterInput)`
Paginated task list with server-side search/filter/sort.

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

### `categories`
All categories for current user.

### `dashboardSummary`
Productivity metrics for dashboard.

## Mutations

| Mutation | Description |
|----------|-------------|
| `createTask` | Create task |
| `updateTask` | Update task fields |
| `completeTask` | Mark completed |
| `reopenTask` | Move completed task back to TODO |
| `archiveTask` | Archive task |
| `deleteTask` | Delete task |
| `createCategory` | Create category |
| `updateCategory` | Update category |
| `deleteCategory` | Delete category |
| `logout` | Client-side logout marker (cookie cleared via REST) |

## REST Auth Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/auth/google` | Start Google OAuth |
| GET | `/auth/google/callback` | OAuth callback |
| POST | `/auth/logout` | Clear auth cookie |
| GET | `/auth/status` | Check auth status |

## Error Handling

GraphQL errors return friendly messages. Internal errors are logged server-side only.
