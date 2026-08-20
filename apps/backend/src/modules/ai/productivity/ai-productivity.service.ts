import { Injectable } from '@nestjs/common';
import { Task } from '../../tasks/entities/task.entity';
import { TasksService } from '../../tasks/tasks.service';
import { DashboardService } from '../../dashboard/dashboard.service';
import { CalendarEventService } from '../../calendar/calendar-event.service';
import { TaskListView } from '../../../common/enums/task-list-view.enum';
import { TaskPriority } from '../../../common/enums/task-priority.enum';
import { TaskStatus } from '../../../common/enums/task-status.enum';
import {
  addDaysYmd,
  formatYmd,
  getZonedDayBounds,
  normalizeTimeZone,
} from '../../../common/utils/date-time.util';
import {
  DayPlanItem,
  DayPlanResult,
  ProductivityInsightsResult,
  ProductivityTaskSnapshot,
  CategoryWorkload,
} from './ai-productivity.types';

const PRIORITY_RANK: Record<TaskPriority, number> = {
  [TaskPriority.URGENT]: 4,
  [TaskPriority.HIGH]: 3,
  [TaskPriority.MEDIUM]: 2,
  [TaskPriority.LOW]: 1,
};

const PLANNING_FETCH_LIMIT = 50;

@Injectable()
export class AiProductivityService {
  constructor(
    private readonly tasksService: TasksService,
    private readonly dashboardService: DashboardService,
    private readonly calendarEventService: CalendarEventService,
  ) {}

  async planDay(userId: string, timeZone?: string): Promise<DayPlanResult> {
    const tz = normalizeTimeZone(timeZone);
    const today = formatYmd(new Date(), tz);

    const [overdueResult, todayResult, upcomingResult] = await Promise.all([
      this.tasksService.findAll(
        userId,
        { view: TaskListView.OVERDUE, limit: PLANNING_FETCH_LIMIT, page: 1 },
        tz,
      ),
      this.tasksService.findAll(
        userId,
        { view: TaskListView.TODAY, limit: PLANNING_FETCH_LIMIT, page: 1 },
        tz,
      ),
      this.tasksService.findAll(
        userId,
        {
          view: TaskListView.UPCOMING,
          priority: TaskPriority.HIGH,
          limit: PLANNING_FETCH_LIMIT,
          page: 1,
        },
        tz,
      ),
    ]);

    const seen = new Set<string>();
    const candidates: Array<{ task: Task; tier: number; reason: string }> = [];

    for (const task of overdueResult.items) {
      if (seen.has(task.id)) continue;
      seen.add(task.id);
      candidates.push({
        task,
        tier: 1,
        reason: 'Overdue — needs attention first',
      });
    }

    for (const task of todayResult.items) {
      if (seen.has(task.id)) continue;
      seen.add(task.id);

      if (
        task.priority === TaskPriority.URGENT ||
        task.priority === TaskPriority.HIGH
      ) {
        candidates.push({
          task,
          tier: 2,
          reason: 'High priority and due today',
        });
        continue;
      }

      if (task.status === TaskStatus.IN_PROGRESS) {
        candidates.push({
          task,
          tier: 3,
          reason: 'Already in progress and due today',
        });
        continue;
      }

      candidates.push({
        task,
        tier: 4,
        reason: 'Due today',
      });
    }

    for (const task of upcomingResult.items) {
      if (seen.has(task.id)) continue;
      if (
        task.priority !== TaskPriority.HIGH &&
        task.priority !== TaskPriority.URGENT
      ) {
        continue;
      }
      seen.add(task.id);
      candidates.push({
        task,
        tier: 5,
        reason: 'Upcoming high-priority work to prepare for',
      });
    }

    candidates.sort((a, b) => {
      if (a.tier !== b.tier) {
        return a.tier - b.tier;
      }
      const priorityDiff =
        PRIORITY_RANK[b.task.priority] - PRIORITY_RANK[a.task.priority];
      if (priorityDiff !== 0) {
        return priorityDiff;
      }
      const aDue = a.task.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const bDue = b.task.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return aDue - bDue;
    });

    const priorities: DayPlanItem[] = candidates.map((entry, index) => ({
      rank: index + 1,
      reason: entry.reason,
      ...this.toTaskSnapshot(entry.task, tz, today),
    }));

    const inProgressToday = todayResult.items.filter(
      (task) => task.status === TaskStatus.IN_PROGRESS,
    ).length;
    const highPriorityToday = todayResult.items.filter(
      (task) =>
        task.priority === TaskPriority.HIGH ||
        task.priority === TaskPriority.URGENT,
    ).length;

    const summary =
      priorities.length === 0
        ? 'No prioritized work found for today. Your schedule looks clear.'
        : `Recommended ${priorities.length} task(s): ${overdueResult.pageInfo.total} overdue, ${todayResult.pageInfo.total} due today.`;

    return {
      timeZone: tz,
      today,
      priorities,
      summary,
      counts: {
        overdue: overdueResult.pageInfo.total,
        dueToday: todayResult.pageInfo.total,
        inProgressToday,
        highPriorityToday,
      },
    };
  }

  async getInsights(
    userId: string,
    timeZone?: string,
    period: 'today' | 'week' = 'today',
  ): Promise<ProductivityInsightsResult> {
    const tz = normalizeTimeZone(timeZone);
    const today = formatYmd(new Date(), tz);
    const weekStart = addDaysYmd(today, -6);
    const weekEnd = today;

    const dashboard = await this.dashboardService.getSummary(userId, tz);

    const [overdueResult, activeResult, completedResult] = await Promise.all([
      this.tasksService.findAll(
        userId,
        { view: TaskListView.OVERDUE, limit: PLANNING_FETCH_LIMIT, page: 1 },
        tz,
      ),
      this.tasksService.findAll(
        userId,
        { view: TaskListView.ALL, limit: PLANNING_FETCH_LIMIT, page: 1 },
        tz,
      ),
      this.tasksService.findAll(
        userId,
        { view: TaskListView.COMPLETED, limit: PLANNING_FETCH_LIMIT, page: 1 },
        tz,
      ),
    ]);

    const completedInPeriod = completedResult.items.filter((task) =>
      this.isCompletedInPeriod(task, period, tz, today, weekStart),
    ).length;

    const categoryWorkload = this.buildCategoryWorkload(
      activeResult.items,
      overdueResult.items.map((task) => task.id),
      tz,
      today,
    );

    const blockingTasks = overdueResult.items
      .slice(0, 5)
      .map((task) => this.toTaskSnapshot(task, tz, today));

    const carriedForwardCount = overdueResult.pageInfo.total;

    const summary = this.buildInsightsSummary(
      period,
      dashboard,
      completedInPeriod,
      carriedForwardCount,
      categoryWorkload,
    );

    return {
      period,
      timeZone: tz,
      today,
      weekStart,
      weekEnd,
      dashboard,
      completedInPeriod,
      categoryWorkload,
      carriedForwardCount,
      blockingTasks,
      summary,
    };
  }

  toTaskSnapshot(
    task: Task,
    timeZone: string,
    todayYmd: string,
  ): ProductivityTaskSnapshot {
    const dueYmd = task.dueDate ? formatYmd(task.dueDate, timeZone) : null;
    const overdue =
      !!dueYmd &&
      dueYmd < todayYmd &&
      task.status !== TaskStatus.COMPLETED &&
      task.status !== TaskStatus.ARCHIVED;
    const dueToday = dueYmd === todayYmd;

    return {
      id: task.id,
      title: task.title,
      description: task.description ?? null,
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate?.toISOString() ?? null,
      overdue,
      dueToday,
      category: task.category?.name ?? null,
      progress: task.progress
        ? {
            completed: task.progress.completed,
            total: task.progress.total,
            percentage: task.progress.percentage,
          }
        : undefined,
      recurrence: task.recurrence
        ? {
            frequency: task.recurrence.frequency,
            isActive: task.recurrence.isActive,
          }
        : null,
    };
  }

  private buildCategoryWorkload(
    activeTasks: Task[],
    overdueIds: string[],
    timeZone: string,
    todayYmd: string,
  ): CategoryWorkload[] {
    const overdueSet = new Set(overdueIds);
    const buckets = new Map<string, CategoryWorkload>();

    for (const task of activeTasks) {
      if (
        task.status === TaskStatus.COMPLETED ||
        task.status === TaskStatus.ARCHIVED
      ) {
        continue;
      }

      const key = task.categoryId ?? '__uncategorized__';
      const name = task.category?.name ?? 'Uncategorized';
      const bucket =
        buckets.get(key) ??
        ({
          categoryId: task.categoryId ?? null,
          categoryName: name,
          openCount: 0,
          inProgressCount: 0,
          overdueCount: 0,
        } satisfies CategoryWorkload);

      if (task.status === TaskStatus.IN_PROGRESS) {
        bucket.inProgressCount += 1;
      } else {
        bucket.openCount += 1;
      }

      const snapshot = this.toTaskSnapshot(task, timeZone, todayYmd);
      if (snapshot.overdue || overdueSet.has(task.id)) {
        bucket.overdueCount += 1;
      }

      buckets.set(key, bucket);
    }

    return [...buckets.values()].sort(
      (a, b) =>
        b.openCount +
        b.inProgressCount +
        b.overdueCount -
        (a.openCount + a.inProgressCount + a.overdueCount),
    );
  }

  private isCompletedInPeriod(
    task: Task,
    period: 'today' | 'week',
    timeZone: string,
    todayYmd: string,
    weekStartYmd: string,
  ): boolean {
    if (!task.completedAt) {
      return false;
    }

    const completedYmd = formatYmd(task.completedAt, timeZone);
    if (period === 'today') {
      return completedYmd === todayYmd;
    }

    return completedYmd >= weekStartYmd && completedYmd <= todayYmd;
  }

  async getWeeklyReview(
    userId: string,
    timeZone?: string,
  ): Promise<Record<string, unknown>> {
    const tz = normalizeTimeZone(timeZone);
    const now = new Date();
    const todayYmd = formatYmd(now, tz);

    // Week: Monday to Sunday
    const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon...
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const weekStartYmd = addDaysYmd(todayYmd, -daysFromMonday);
    const weekEndYmd = addDaysYmd(weekStartYmd, 6);

    const weekStartDate = new Date(weekStartYmd + 'T12:00:00Z');
    const weekEndDate = new Date(weekEndYmd + 'T12:00:00Z');
    const weekStartBounds = getZonedDayBounds(weekStartDate, tz);
    const weekEndBounds = getZonedDayBounds(weekEndDate, tz);

    const [dashboard, allTasksResult] = await Promise.all([
      this.dashboardService.getSummary(userId, tz),
      this.tasksService.findAll(
        userId,
        { view: TaskListView.ALL, limit: 500, page: 1 },
        tz,
      ),
    ]);

    const tasks = allTasksResult.items;

    let tasksCompleted = 0;
    let tasksCreated = 0;
    let highPriorityCompleted = 0;
    let highPriorityOpen = 0;
    let recurringCompleted = 0;
    let carryForwardCount = 0;

    const categoryCompletions: Map<string, { name: string; count: number }> = new Map();

    for (const task of tasks) {
      // Tasks completed this week
      if (
        task.completedAt &&
        task.completedAt >= weekStartBounds.start &&
        task.completedAt < weekEndBounds.endExclusive
      ) {
        tasksCompleted++;
        if (
          task.priority === TaskPriority.HIGH ||
          task.priority === TaskPriority.URGENT
        ) {
          highPriorityCompleted++;
        }
        if (task.recurrence?.frequency) {
          recurringCompleted++;
        }
        // Category breakdown
        const catKey = task.categoryId ?? '__none__';
        const catName = task.category?.name ?? 'Uncategorized';
        const existing = categoryCompletions.get(catKey);
        categoryCompletions.set(catKey, {
          name: catName,
          count: (existing?.count ?? 0) + 1,
        });
      }

      // Tasks created this week (approximate by checking createdAt if available, else skip)
      // We don't have a createdAt on Task visible here — skip for now

      // High priority open
      if (
        task.status !== TaskStatus.COMPLETED &&
        task.status !== TaskStatus.ARCHIVED &&
        (task.priority === TaskPriority.HIGH || task.priority === TaskPriority.URGENT)
      ) {
        highPriorityOpen++;
      }

      // Carry-forward: due before today, not completed, not archived
      if (
        task.dueDate &&
        formatYmd(task.dueDate, tz) < todayYmd &&
        task.status !== TaskStatus.COMPLETED &&
        task.status !== TaskStatus.ARCHIVED
      ) {
        carryForwardCount++;
      }
    }

    // Calendar events count for the week (best-effort — empty if not connected)
    let calendarEventsCount = 0;
    try {
      calendarEventsCount = await this.calendarEventService.countEventsInWeek(
        userId,
        weekStartBounds.start,
        weekEndBounds.endExclusive,
      );
    } catch {
      // Non-fatal — calendar may not be connected
    }

    return {
      weekStart: weekStartYmd,
      weekEnd: weekEndYmd,
      tasksCompleted,
      tasksCreated: null, // No createdAt in Task entity — reported as null
      overdueCount: dashboard.overdueCount,
      completionRate: dashboard.completionPercentage,
      carryForwardCount,
      highPriorityCompleted,
      highPriorityOpen,
      recurringTasksCompleted: recurringCompleted,
      categoryBreakdown: [...categoryCompletions.values()].sort(
        (a, b) => b.count - a.count,
      ),
      calendarEventsCount,
    };
  }

  private buildInsightsSummary(
    period: 'today' | 'week',
    dashboard: Awaited<ReturnType<DashboardService['getSummary']>>,
    completedInPeriod: number,
    carriedForwardCount: number,
    categoryWorkload: CategoryWorkload[],
  ): string {
    const periodLabel = period === 'today' ? 'today' : 'this week';
    const topCategory = categoryWorkload[0];
    const categoryNote = topCategory
      ? ` Highest unfinished workload: ${topCategory.categoryName}.`
      : '';

    return (
      `Productivity for ${periodLabel}: completion rate ${dashboard.completionPercentage}% ` +
      `(completed due today ${dashboard.todayCompleted}/${dashboard.todayTotal}), ` +
      `${dashboard.overdueCount} overdue, ${completedInPeriod} completed in period, ` +
      `${carriedForwardCount} carried forward.${categoryNote}`
    );
  }
}
