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
export type SubtaskStatus = 'TODO' | 'COMPLETED';
export type RecurrenceFrequency =
  | 'DAILY'
  | 'WEEKDAYS'
  | 'WEEKLY'
  | 'BIWEEKLY'
  | 'MONTHLY'
  | 'YEARLY'
  | 'CUSTOM';
export type ReminderChannel = 'IN_APP' | 'PUSH' | 'EMAIL';
export type NotificationType = 'REMINDER';
export type NotificationStatus = 'PENDING' | 'SENT' | 'FAILED';

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
  ianaTimezone?: string | null;
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

export interface TaskProgress {
  completed: number;
  total: number;
  percentage: number;
}

export interface RecurrenceRule {
  id: string;
  seriesId: string;
  frequency: RecurrenceFrequency;
  interval: number;
  daysOfWeek?: number[] | null;
  dayOfMonth?: number | null;
  startDate: string;
  endDate?: string | null;
  timezone: string;
  isActive: boolean;
}

export interface Subtask {
  id: string;
  taskId: string;
  title: string;
  description?: string | null;
  status: SubtaskStatus;
  position: number;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Reminder {
  id: string;
  taskId: string;
  fireAt: string;
  offsetMinutes?: number | null;
  channel: ReminderChannel;
  sentAt?: string | null;
  createdAt: string;
}

export interface Notification {
  id: string;
  taskId?: string | null;
  type: NotificationType;
  channel: ReminderChannel;
  status: NotificationStatus;
  title: string;
  message: string;
  scheduledAt?: string | null;
  deliveredAt?: string | null;
  readAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationConnection {
  items: Notification[];
  pageInfo: PageInfo;
}

export interface NotificationPreferences {
  id: string;
  inAppEnabled: boolean;
  emailEnabled: boolean;
  pushEnabled: boolean;
  reminderEnabled: boolean;
  pushAvailable: boolean;
  emailAvailable: boolean;
  pushPublicKey?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PushSubscriptionRecord {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
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
  seriesId?: string | null;
  occurrenceDate?: string | null;
  progress?: TaskProgress;
  recurrence?: RecurrenceRule | null;
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
  todayOpen: number;
  todayInProgress: number;
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

export interface RecurrenceInput {
  frequency: RecurrenceFrequency;
  interval?: number;
  daysOfWeek?: number[];
  dayOfMonth?: number;
  endDate?: string;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  priority?: TaskPriority;
  dueDate?: string;
  categoryId?: string;
  recurrence?: RecurrenceInput;
  subtaskTitles?: string[];
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string | null;
  categoryId?: string | null;
  recurrence?: RecurrenceInput | null;
  stopRecurrence?: boolean;
}

export interface ReminderDraft {
  offsetMinutes?: number;
  localDateTime?: string;
  channel?: ReminderChannel;
}

export interface TaskFormSubmit {
  input: CreateTaskInput | UpdateTaskInput;
  reminderDrafts: ReminderDraft[];
  deleteReminderIds: string[];
  subtaskTitles: string[];
}

export interface CreateSubtaskInput {
  taskId: string;
  title: string;
  description?: string;
  position?: number;
}

export interface UpdateSubtaskInput {
  title?: string;
  description?: string | null;
  position?: number;
}

export interface CreateReminderInput {
  taskId: string;
  offsetMinutes?: number;
  localDateTime?: string;
  fireAt?: string;
  channel?: ReminderChannel;
}

export interface UpdateReminderInput {
  offsetMinutes?: number;
  localDateTime?: string;
  fireAt?: string;
  channel?: ReminderChannel;
}

export interface NotificationsFilterInput {
  unreadOnly?: boolean;
  page?: number;
  limit?: number;
}

export interface UpdateNotificationPreferencesInput {
  inAppEnabled?: boolean;
  emailEnabled?: boolean;
  pushEnabled?: boolean;
  reminderEnabled?: boolean;
}

export interface SavePushSubscriptionInput {
  endpoint: string;
  p256dh: string;
  auth: string;
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

export type AiMessageRole = 'USER' | 'ASSISTANT' | 'TOOL';

export interface AiUsageStatus {
  dailyLimit: number;
  used: number;
  remaining: number;
  resetAt: string;
  providerConfigured: boolean;
}

export interface AiConversation {
  id: string;
  title?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AiMessage {
  id: string;
  role: AiMessageRole;
  content: string;
  toolName?: string | null;
  toolCallId?: string | null;
  toolStatus?: string | null;
  createdAt: string;
}

export interface AiMessagesPage {
  items: AiMessage[];
  limit: number;
}

export interface AiToolCallResult {
  toolName: string;
  toolCallId?: string | null;
  summary: string;
  success: boolean;
}

export interface AiPendingConfirmation {
  id: string;
  action: string;
  title: string;
  description: string;
  toolName: string;
}

export interface AiChatResponse {
  conversation: AiConversation;
  assistantMessage?: AiMessage | null;
  toolCalls: AiToolCallResult[];
  pendingConfirmation?: AiPendingConfirmation | null;
  completed: boolean;
  usage?: AiUsageStatus | null;
}

export interface AiConfirmActionResponse {
  conversation: AiConversation;
  assistantMessage?: AiMessage | null;
  toolResult: AiToolCallResult;
  completed: boolean;
}

export interface AiChatInput {
  conversationId: string;
  message: string;
}

export interface ConfirmAiActionInput {
  confirmationId: string;
}

export const RECURRENCE_LABELS: Record<RecurrenceFrequency | 'NEVER', string> = {
  NEVER: 'Never',
  DAILY: 'Daily',
  WEEKDAYS: 'Weekdays',
  WEEKLY: 'Weekly',
  BIWEEKLY: 'Every 2 weeks',
  MONTHLY: 'Monthly',
  YEARLY: 'Yearly',
  CUSTOM: 'Custom',
};
