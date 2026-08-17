export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'ARCHIVED';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type TaskListView =
  | 'ALL'
  | 'TODAY'
  | 'UPCOMING'
  | 'OVERDUE'
  | 'COMPLETED'
  | 'ARCHIVED';
export type TaskSortField =
  | 'CREATED_AT'
  | 'UPDATED_AT'
  | 'DUE_DATE'
  | 'PRIORITY';
export type SortOrder = 'ASC' | 'DESC';

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string | null;
}

export interface Category {
  id: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string | null;
  completedAt?: string | null;
  category?: Category | null;
  createdAt: string;
  updatedAt: string;
}

export interface PageInfo {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface TaskConnection {
  items: Task[];
  pageInfo: PageInfo;
}

export interface DashboardSummary {
  todayTotal: number;
  todayCompleted: number;
  todayPending: number;
  todayHighPriority: number;
  overdueCount: number;
  upcomingCount: number;
  completedTodayCount: number;
  totalActiveTasks: number;
  completionPercentage: number;
}

export interface TaskFilterInput {
  search?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  categoryId?: string;
  view?: TaskListView;
  sortBy?: TaskSortField;
  sortOrder?: SortOrder;
  page?: number;
  limit?: number;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  priority?: TaskPriority;
  dueDate?: string;
  categoryId?: string;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string | null;
  categoryId?: string | null;
}

export interface CreateCategoryInput {
  name: string;
  description?: string;
  icon?: string;
}

export interface UpdateCategoryInput {
  name?: string;
  description?: string;
  icon?: string;
}
