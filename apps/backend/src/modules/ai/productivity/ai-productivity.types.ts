import { TaskPriority } from '../../../common/enums/task-priority.enum';
import { TaskStatus } from '../../../common/enums/task-status.enum';
import { DashboardSummary } from '../../dashboard/dto/dashboard-summary.dto';

export interface ProductivityTaskSnapshot {
  id: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string | null;
  overdue: boolean;
  dueToday: boolean;
  category?: string | null;
  progress?: {
    completed: number;
    total: number;
    percentage: number;
  };
  recurrence?: {
    frequency: string;
    isActive: boolean;
  } | null;
}

export interface DayPlanItem extends ProductivityTaskSnapshot {
  rank: number;
  reason: string;
}

export interface DayPlanResult {
  timeZone: string;
  today: string;
  priorities: DayPlanItem[];
  summary: string;
  counts: {
    overdue: number;
    dueToday: number;
    inProgressToday: number;
    highPriorityToday: number;
  };
}

export interface CategoryWorkload {
  categoryId?: string | null;
  categoryName: string;
  openCount: number;
  inProgressCount: number;
  overdueCount: number;
}

export interface ProductivityInsightsResult {
  period: 'today' | 'week';
  timeZone: string;
  today: string;
  weekStart: string;
  weekEnd: string;
  dashboard: DashboardSummary;
  completedInPeriod: number;
  categoryWorkload: CategoryWorkload[];
  carriedForwardCount: number;
  blockingTasks: ProductivityTaskSnapshot[];
  summary: string;
}
