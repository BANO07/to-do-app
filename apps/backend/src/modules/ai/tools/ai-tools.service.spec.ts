import { Test, TestingModule } from '@nestjs/testing';
import { AiToolsService } from './ai-tools.service';
import { TasksService } from '../../tasks/tasks.service';
import { CategoriesService } from '../../categories/categories.service';
import { DashboardService } from '../../dashboard/dashboard.service';
import { RemindersService } from '../../tasks/reminders.service';
import { SubtasksService } from '../../tasks/subtasks.service';
import { AiProductivityService } from '../productivity/ai-productivity.service';
import { CalendarEventService } from '../../calendar/calendar-event.service';

describe('AiToolsService', () => {
  let service: AiToolsService;

  const tasksService = {
    findAll: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    complete: jest.fn(),
    reopen: jest.fn(),
  };

  const categoriesService = {
    findAll: jest.fn(),
  };

  const dashboardService = {
    getSummary: jest.fn(),
  };

  const remindersService = {
    findByTask: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  const subtasksService = {
    create: jest.fn(),
  };

  const productivityService = {
    planDay: jest.fn(),
    getInsights: jest.fn(),
    getWeeklyReview: jest.fn(),
    toTaskSnapshot: jest.fn((task: Record<string, unknown>, _tz: string) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      priority: task.priority,
      dueDate:
        task.dueDate instanceof Date
          ? task.dueDate.toISOString()
          : (task.dueDate ?? null),
      overdue: false,
      dueToday: true,
      category: null,
    })),
  };

  const calendarEventService = {
    getEvents: jest.fn(),
    getTodayEvents: jest.fn(),
    getUpcomingEvents: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiToolsService,
        { provide: TasksService, useValue: tasksService },
        { provide: CategoriesService, useValue: categoriesService },
        { provide: DashboardService, useValue: dashboardService },
        { provide: RemindersService, useValue: remindersService },
        { provide: SubtasksService, useValue: subtasksService },
        { provide: AiProductivityService, useValue: productivityService },
        { provide: CalendarEventService, useValue: calendarEventService },
      ],
    }).compile();

    service = module.get(AiToolsService);
  });

  it('exposes all required tools including calendar and weekly review tools', () => {
    const names = service.getToolDefinitions().map((tool) => tool.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'getCalendarEvents',
        'getTodayCalendar',
        'getUpcomingCalendar',
        'getWeeklyReview',
        'getTasks',
        'getTask',
        'getCategories',
        'getDashboardStats',
        'getProductivityInsights',
        'planMyDay',
        'getReminders',
        'createTask',
        'updateTask',
        'deleteTask',
        'completeTask',
        'reopenTask',
        'createSubtask',
        'createReminder',
        'updateReminder',
        'deleteReminder',
      ]),
    );
    expect(names).toHaveLength(20); // 16 original + 4 new: getCalendarEvents, getTodayCalendar, getUpcomingCalendar, getWeeklyReview
  });

  it('uses authenticated user for getTasks', async () => {
    tasksService.findAll.mockResolvedValue({
      items: [
        {
          id: 't1',
          title: 'A',
          status: 'TODO',
          priority: 'LOW',
          dueDate: null,
        },
      ],
      pageInfo: { total: 1 },
    });

    await service.executeTool(
      { userId: 'user-1', timeZone: 'UTC', conversationId: 'conv-1' },
      'call-1',
      'getTasks',
      { userId: 'other-user', view: 'TODAY' },
    );

    expect(tasksService.findAll).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ view: 'TODAY' }),
      'UTC',
    );
  });

  it('delegates planMyDay to productivity service with user timezone', async () => {
    productivityService.planDay.mockResolvedValue({
      summary: 'Recommended 2 task(s)',
      priorities: [],
    });

    const result = await service.executeTool(
      { userId: 'user-1', timeZone: 'Asia/Kolkata', conversationId: 'conv-1' },
      'call-1',
      'planMyDay',
      {},
    );

    expect(productivityService.planDay).toHaveBeenCalledWith(
      'user-1',
      'Asia/Kolkata',
    );
    expect(result.success).toBe(true);
    expect(result.summary).toContain('Recommended');
  });

  it('delegates getProductivityInsights with period filter', async () => {
    productivityService.getInsights.mockResolvedValue({
      summary: 'Productivity for this week: completion rate 75%',
      dashboard: { completionPercentage: 75 },
    });

    await service.executeTool(
      { userId: 'user-1', timeZone: 'UTC', conversationId: 'conv-1' },
      'call-1',
      'getProductivityInsights',
      { period: 'week' },
    );

    expect(productivityService.getInsights).toHaveBeenCalledWith(
      'user-1',
      'UTC',
      'week',
    );
  });

  it('marks deleteTask as requiring confirmation', () => {
    const deleteTool = service.getTool('deleteTask');
    expect(deleteTool?.requiresConfirmation).toBe(true);
    expect(deleteTool?.destructive).toBe(true);
  });

  it('marks deleteReminder as requiring confirmation', () => {
    const deleteTool = service.getTool('deleteReminder');
    expect(deleteTool?.requiresConfirmation).toBe(true);
    expect(deleteTool?.destructive).toBe(true);
  });

  it('creates tasks with ownership and timezone from context', async () => {
    tasksService.create.mockResolvedValue({
      id: 'task-1',
      title: 'New task',
      status: 'TODO',
      priority: 'MEDIUM',
      dueDate: null,
    });

    const result = await service.executeTool(
      { userId: 'user-1', timeZone: 'America/New_York', conversationId: 'conv-1' },
      'call-1',
      'createTask',
      { title: 'New task', userId: 'someone-else' },
    );

    expect(tasksService.create).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ title: 'New task' }),
      'America/New_York',
    );
    expect(result.success).toBe(true);
  });

  it('maps natural-language createTask with recurrence and subtasks in one call', async () => {
    tasksService.create.mockResolvedValue({
      id: 'task-2',
      title: 'Website Launch',
      status: 'TODO',
      priority: 'HIGH',
      dueDate: new Date('2026-08-22T17:00:00.000Z'),
    });

    await service.executeTool(
      { userId: 'user-1', timeZone: 'UTC', conversationId: 'conv-1' },
      'call-2',
      'createTask',
      {
        title: 'Website Launch',
        priority: 'HIGH',
        dueDate: '2026-08-22T17:00:00.000Z',
        recurrenceFrequency: 'DAILY',
        recurrenceInterval: 1,
        subtaskTitles: ['design homepage', 'implement backend', 'deploy'],
      },
    );

    expect(tasksService.create).toHaveBeenCalledTimes(1);
    expect(tasksService.create).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        title: 'Website Launch',
        priority: 'HIGH',
        recurrence: { frequency: 'DAILY', interval: 1 },
        subtaskTitles: ['design homepage', 'implement backend', 'deploy'],
      }),
      'UTC',
    );
  });

  it('maps natural-language reminder with localDateTime and timezone', async () => {
    remindersService.create.mockResolvedValue({
      id: 'rem-1',
      taskId: 'task-1',
      fireAt: new Date('2026-08-20T03:30:00.000Z'),
      channel: 'IN_APP',
    });

    await service.executeTool(
      { userId: 'user-1', timeZone: 'Asia/Kolkata', conversationId: 'conv-1' },
      'call-3',
      'createReminder',
      {
        taskId: 'task-1',
        localDateTime: '2026-08-20T09:00',
        channel: 'IN_APP',
      },
    );

    expect(remindersService.create).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        taskId: 'task-1',
        localDateTime: '2026-08-20T09:00',
        channel: 'IN_APP',
      }),
      'Asia/Kolkata',
    );
  });

  describe('calendar tools — ownership enforcement', () => {
    const ctx = { userId: 'user-99', timeZone: 'UTC', conversationId: 'conv-1' };

    it('getCalendarEvents passes userId from context, not from args', async () => {
      calendarEventService.getEvents.mockResolvedValue([]);
      await service.executeTool(ctx, 'call-cal-1', 'getCalendarEvents', {
        from: '2026-08-01',
        to: '2026-08-31',
      });
      expect(calendarEventService.getEvents).toHaveBeenCalledWith(
        'user-99',
        '2026-08-01',
        '2026-08-31',
      );
    });

    it('getTodayCalendar uses userId from context', async () => {
      calendarEventService.getTodayEvents.mockResolvedValue([]);
      await service.executeTool(ctx, 'call-cal-2', 'getTodayCalendar', {});
      expect(calendarEventService.getTodayEvents).toHaveBeenCalledWith(
        'user-99',
        'UTC',
      );
    });

    it('getUpcomingCalendar uses default 24 hours when not specified', async () => {
      calendarEventService.getUpcomingEvents.mockResolvedValue([]);
      await service.executeTool(ctx, 'call-cal-3', 'getUpcomingCalendar', {});
      expect(calendarEventService.getUpcomingEvents).toHaveBeenCalledWith('user-99', 24);
    });

    it('getUpcomingCalendar caps at 168 hours max', async () => {
      calendarEventService.getUpcomingEvents.mockResolvedValue([]);
      await service.executeTool(ctx, 'call-cal-4', 'getUpcomingCalendar', { hours: 999 });
      expect(calendarEventService.getUpcomingEvents).toHaveBeenCalledWith('user-99', 168);
    });

    it('getWeeklyReview delegates to productivityService with user context', async () => {
      productivityService.getWeeklyReview.mockResolvedValue({ tasksCompleted: 5 });
      const result = await service.executeTool(ctx, 'call-wr-1', 'getWeeklyReview', {});
      expect(productivityService.getWeeklyReview).toHaveBeenCalledWith('user-99', 'UTC');
      expect(result.data).toEqual(expect.objectContaining({ tasksCompleted: 5 }));
    });
  });
});
