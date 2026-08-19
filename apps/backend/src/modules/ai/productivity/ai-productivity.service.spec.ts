import { AiProductivityService } from './ai-productivity.service';
import { TaskStatus } from '../../../common/enums/task-status.enum';
import { TaskPriority } from '../../../common/enums/task-priority.enum';

describe('AiProductivityService', () => {
  const tasksService = {
    findAll: jest.fn(),
  };

  const dashboardService = {
    getSummary: jest.fn(),
  };

  let service: AiProductivityService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AiProductivityService(
      tasksService as any,
      dashboardService as any,
    );
  });

  it('prioritizes overdue tasks before due-today work', async () => {
    tasksService.findAll.mockImplementation(
      (_userId: string, filter: { view?: string }) => {
        if (filter.view === 'OVERDUE') {
          return Promise.resolve({
            items: [
              buildTask({
                id: 'overdue-1',
                title: 'Late report',
                priority: TaskPriority.MEDIUM,
                dueDate: new Date('2026-08-17T10:00:00.000Z'),
              }),
            ],
            pageInfo: { total: 1 },
          });
        }
        if (filter.view === 'TODAY') {
          return Promise.resolve({
            items: [
              buildTask({
                id: 'today-1',
                title: 'Daily standup prep',
                priority: TaskPriority.HIGH,
                dueDate: new Date('2026-08-19T10:00:00.000Z'),
              }),
            ],
            pageInfo: { total: 1 },
          });
        }
        return Promise.resolve({ items: [], pageInfo: { total: 0 } });
      },
    );

    const plan = await service.planDay('user-1', 'UTC');

    expect(plan.priorities[0]?.id).toBe('overdue-1');
    expect(plan.priorities[1]?.id).toBe('today-1');
    expect(plan.priorities[0]?.reason).toContain('Overdue');
  });

  it('ranks in-progress due-today tasks ahead of other due-today tasks', async () => {
    tasksService.findAll.mockImplementation(
      (_userId: string, filter: { view?: string }) => {
        if (filter.view === 'OVERDUE') {
          return Promise.resolve({ items: [], pageInfo: { total: 0 } });
        }
        if (filter.view === 'TODAY') {
          return Promise.resolve({
            items: [
              buildTask({
                id: 'todo-today',
                title: 'Low effort',
                status: TaskStatus.TODO,
                priority: TaskPriority.LOW,
                dueDate: new Date('2026-08-19T12:00:00.000Z'),
              }),
              buildTask({
                id: 'wip-today',
                title: 'Finish deck',
                status: TaskStatus.IN_PROGRESS,
                priority: TaskPriority.MEDIUM,
                dueDate: new Date('2026-08-19T14:00:00.000Z'),
              }),
            ],
            pageInfo: { total: 2 },
          });
        }
        return Promise.resolve({ items: [], pageInfo: { total: 0 } });
      },
    );

    const plan = await service.planDay('user-1', 'UTC');
    expect(plan.priorities.map((item) => item.id)).toEqual([
      'wip-today',
      'todo-today',
    ]);
  });

  it('uses DashboardService completion rate as the insights source of truth', async () => {
    dashboardService.getSummary.mockResolvedValue({
      todayTotal: 4,
      todayCompleted: 2,
      todayOpen: 1,
      todayInProgress: 1,
      todayPending: 2,
      todayHighPriority: 1,
      overdueCount: 3,
      upcomingCount: 5,
      completedTodayCount: 2,
      totalActiveTasks: 10,
      completionPercentage: 50,
    });

    tasksService.findAll.mockResolvedValue({ items: [], pageInfo: { total: 0 } });

    const insights = await service.getInsights('user-1', 'UTC', 'today');

    expect(insights.dashboard.completionPercentage).toBe(50);
    expect(insights.summary).toContain('50%');
  });

  it('ranks high-priority due-today tasks ahead of lower-priority due-today work', async () => {
    tasksService.findAll.mockImplementation(
      (_userId: string, filter: { view?: string }) => {
        if (filter.view === 'OVERDUE') {
          return Promise.resolve({ items: [], pageInfo: { total: 0 } });
        }
        if (filter.view === 'TODAY') {
          return Promise.resolve({
            items: [
              buildTask({
                id: 'low-today',
                title: 'Low effort',
                priority: TaskPriority.LOW,
                dueDate: new Date('2026-08-19T08:00:00.000Z'),
              }),
              buildTask({
                id: 'high-today',
                title: 'Submit report',
                priority: TaskPriority.HIGH,
                dueDate: new Date('2026-08-19T10:00:00.000Z'),
              }),
            ],
            pageInfo: { total: 2 },
          });
        }
        return Promise.resolve({ items: [], pageInfo: { total: 0 } });
      },
    );

    const plan = await service.planDay('user-1', 'UTC');
    expect(plan.priorities.map((item) => item.id)).toEqual([
      'high-today',
      'low-today',
    ]);
    expect(plan.priorities[0]?.reason).toContain('High priority');
  });

  it('reports carried-forward workload from overdue tasks', async () => {
    dashboardService.getSummary.mockResolvedValue({
      todayTotal: 0,
      todayCompleted: 0,
      todayOpen: 0,
      todayInProgress: 0,
      todayPending: 0,
      todayHighPriority: 0,
      overdueCount: 2,
      upcomingCount: 0,
      completedTodayCount: 0,
      totalActiveTasks: 2,
      completionPercentage: 0,
    });

    tasksService.findAll.mockImplementation(
      (_userId: string, filter: { view?: string }) => {
        if (filter.view === 'OVERDUE') {
          return Promise.resolve({
            items: [
              buildTask({ id: 'o1', title: 'A' }),
              buildTask({ id: 'o2', title: 'B' }),
            ],
            pageInfo: { total: 2 },
          });
        }
        return Promise.resolve({ items: [], pageInfo: { total: 0 } });
      },
    );

    const insights = await service.getInsights('user-1', 'UTC', 'week');
    expect(insights.carriedForwardCount).toBe(2);
    expect(insights.blockingTasks).toHaveLength(2);
  });
});

function buildTask(overrides: Partial<ReturnType<typeof baseTask>> = {}) {
  return {
    ...baseTask(),
    ...overrides,
  };
}

function baseTask() {
  return {
    id: 'task-1',
    title: 'Task',
    description: null,
    status: TaskStatus.TODO,
    priority: TaskPriority.MEDIUM,
    dueDate: new Date('2026-08-19T09:00:00.000Z'),
    completedAt: null,
    categoryId: null,
    category: null,
    progress: { completed: 0, total: 0, percentage: 0 },
    recurrence: null,
  };
}
