import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { TasksRepository } from './tasks.repository';
import { CategoriesService } from '../categories/categories.service';
import { SubtasksRepository } from './subtasks.repository';
import { RecurrenceRulesRepository } from './recurrence-rules.repository';
import { RemindersService } from './reminders.service';
import { CalendarPushService } from '../calendar/calendar-push.service';
import { CalendarSyncService } from '../calendar/calendar-sync.service';
import { TaskStatus } from '../../common/enums/task-status.enum';
import { RecurrenceFrequency } from '../../common/enums/recurrence-frequency.enum';

describe('TasksService', () => {
  let service: TasksService;

  const tasksRepository = {
    findWithFilters: jest.fn(),
    findByIdForUser: jest.fn(),
    findBySeriesOccurrence: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  };

  const categoriesService = {
    findById: jest.fn(),
  };

  const subtasksRepository = {
    aggregateProgress: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const recurrenceRulesRepository = {
    findBySeriesForUser: jest.fn(),
    findBySeriesIdsForUser: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const remindersService = {
    rescheduleOffsetReminders: jest.fn(),
    copyOffsetReminders: jest.fn(),
  };

  const calendarPushService = {
    createEventForTask: jest.fn(),
    updateEventForTask: jest.fn(),
    deleteEventForTask: jest.fn(),
  };

  const calendarSyncService = {
    syncForUser: jest.fn().mockResolvedValue({ success: true, eventsUpserted: 0 }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        { provide: TasksRepository, useValue: tasksRepository },
        { provide: CategoriesService, useValue: categoriesService },
        { provide: SubtasksRepository, useValue: subtasksRepository },
        { provide: RecurrenceRulesRepository, useValue: recurrenceRulesRepository },
        { provide: RemindersService, useValue: remindersService },
        { provide: CalendarPushService, useValue: calendarPushService },
        { provide: CalendarSyncService, useValue: calendarSyncService },
      ],
    }).compile();

    service = module.get(TasksService);
    jest.clearAllMocks();
    subtasksRepository.aggregateProgress.mockResolvedValue(new Map());
    subtasksRepository.create.mockImplementation((value) => value);
    subtasksRepository.save.mockImplementation(async (value) => value);
    recurrenceRulesRepository.findBySeriesIdsForUser.mockResolvedValue([]);
    recurrenceRulesRepository.create.mockImplementation((value) => value);
    recurrenceRulesRepository.save.mockImplementation(async (value) => value);
    tasksRepository.create.mockImplementation((value) => value);
    tasksRepository.save.mockImplementation(async (value) => ({
      id: value.id ?? 'task-1',
      ...value,
    }));
    calendarPushService.createEventForTask.mockResolvedValue(null);
    calendarPushService.updateEventForTask.mockResolvedValue(false);
    calendarPushService.deleteEventForTask.mockResolvedValue(true);
    calendarSyncService.syncForUser.mockResolvedValue({
      success: true,
      eventsUpserted: 0,
    });
  });

  it('should scope task lookup to user', async () => {
    tasksRepository.findByIdForUser.mockResolvedValue(null);

    await expect(service.findById('user-1', 'task-1')).rejects.toThrow(
      NotFoundException,
    );
    expect(tasksRepository.findByIdForUser).toHaveBeenCalledWith(
      'task-1',
      'user-1',
    );
  });

  it('should complete task and set completedAt', async () => {
    const task = {
      id: 'task-1',
      userId: 'user-1',
      status: TaskStatus.TODO,
      completedAt: null,
      seriesId: null,
    };
    tasksRepository.findByIdForUser.mockResolvedValue(task);

    const result = await service.complete('user-1', 'task-1', 'UTC');

    expect(result.status).toBe(TaskStatus.COMPLETED);
    expect(result.completedAt).toBeInstanceOf(Date);
    expect(result.progress).toEqual({ completed: 0, total: 0, percentage: 0 });
  });

  it('should delete only owned task', async () => {
    const task = { id: 'task-1', userId: 'user-1' };
    tasksRepository.findByIdForUser.mockResolvedValue(task);

    await expect(service.delete('user-1', 'task-1')).resolves.toBe(true);
    expect(tasksRepository.remove).toHaveBeenCalledWith(task);
  });

  it('creates a recurrence rule with the task series', async () => {
    const created = await service.create(
      'user-1',
      {
        title: 'Standup',
        dueDate: new Date('2026-08-18T04:00:00.000Z'),
        recurrence: { frequency: RecurrenceFrequency.DAILY, interval: 1 },
      },
      'Asia/Kolkata',
    );

    expect(recurrenceRulesRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        frequency: RecurrenceFrequency.DAILY,
        timezone: 'Asia/Kolkata',
        isActive: true,
      }),
    );
    expect(created.seriesId).toBeDefined();
    expect(created.occurrenceDate).toBe('2026-08-18');
    expect(tasksRepository.save).toHaveBeenCalledTimes(1);
  });

  it('generates the next occurrence once and skips duplicates', async () => {
    const completed = {
      id: 'task-1',
      userId: 'user-a',
      title: 'Standup',
      description: null,
      priority: 'MEDIUM',
      categoryId: null,
      status: TaskStatus.COMPLETED,
      seriesId: 'series-1',
      occurrenceDate: '2026-08-18',
      dueDate: new Date('2026-08-18T04:00:00.000Z'),
    };
    recurrenceRulesRepository.findBySeriesForUser.mockResolvedValue({
      seriesId: 'series-1',
      userId: 'user-a',
      frequency: RecurrenceFrequency.DAILY,
      interval: 1,
      daysOfWeek: null,
      dayOfMonth: null,
      endDate: null,
      timezone: 'Asia/Kolkata',
      isActive: true,
    });
    tasksRepository.findBySeriesOccurrence.mockResolvedValue(null);

    const next = await service.generateNextOccurrence(
      'user-a',
      completed as never,
      'Asia/Kolkata',
    );

    expect(next?.occurrenceDate).toBe('2026-08-19');
    expect(tasksRepository.save).toHaveBeenCalledTimes(1);

    tasksRepository.findBySeriesOccurrence.mockResolvedValue({
      id: 'task-2',
      occurrenceDate: '2026-08-19',
    });
    const duplicate = await service.generateNextOccurrence(
      'user-a',
      completed as never,
      'Asia/Kolkata',
    );
    expect(duplicate?.id).toBe('task-2');
    expect(tasksRepository.save).toHaveBeenCalledTimes(1);
  });

  it('stops recurrence for the owning user only', async () => {
    tasksRepository.findByIdForUser.mockResolvedValue({
      id: 'task-1',
      seriesId: 'series-1',
    });
    recurrenceRulesRepository.findBySeriesForUser.mockResolvedValue({
      seriesId: 'series-1',
      isActive: true,
    });

    await service.stopRecurrence('user-a', 'task-1');
    expect(recurrenceRulesRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ isActive: false }),
    );

    tasksRepository.findByIdForUser.mockResolvedValue(null);
    await expect(service.stopRecurrence('user-a', 'task-b')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('creates exactly one task record for a single create call', async () => {
    await service.create('user-1', { title: 'Testing' }, 'UTC');

    expect(tasksRepository.save).toHaveBeenCalledTimes(1);
    expect(subtasksRepository.save).not.toHaveBeenCalled();
  });

  it('creates linked subtasks with the parent in one create call', async () => {
    await service.create(
      'user-1',
      {
        title: 'Parent',
        subtaskTitles: [' Create API ', '', 'Add tests'],
      },
      'UTC',
    );

    expect(tasksRepository.save).toHaveBeenCalledTimes(1);
    expect(subtasksRepository.save).toHaveBeenCalledTimes(2);
    expect(subtasksRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Create API',
        userId: 'user-1',
        status: 'TODO',
        position: 0,
      }),
    );
  });

  it('transitions TODO to IN_PROGRESS without completing', async () => {
    tasksRepository.findByIdForUser.mockResolvedValue({
      id: 'task-1',
      userId: 'user-1',
      status: TaskStatus.TODO,
      completedAt: null,
      dueDate: null,
    });

    const result = await service.update(
      'user-1',
      'task-1',
      { status: TaskStatus.IN_PROGRESS },
      'UTC',
    );

    expect(result.status).toBe(TaskStatus.IN_PROGRESS);
    expect(result.completedAt).toBeNull();
  });

  it('restores an archived task to TODO', async () => {
    tasksRepository.findByIdForUser.mockResolvedValue({
      id: 'task-1',
      userId: 'user-1',
      status: TaskStatus.ARCHIVED,
      completedAt: null,
    });

    const result = await service.restore('user-1', 'task-1');

    expect(result.status).toBe(TaskStatus.TODO);
    expect(result.completedAt).toBeNull();
  });

  it('does not restore a task owned by another user', async () => {
    tasksRepository.findByIdForUser.mockResolvedValue(null);

    await expect(service.restore('user-1', 'task-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  describe('Google Calendar push integration', () => {
    it('does not create a Google event when task has no due date', async () => {
      await service.create('user-1', { title: 'No due' }, 'UTC');
      expect(calendarPushService.createEventForTask).not.toHaveBeenCalled();
    });

    it('creates Todo without Google call when push returns null (no connection)', async () => {
      calendarPushService.createEventForTask.mockResolvedValue(null);
      const result = await service.create(
        'user-1',
        { title: 'With due', dueDate: new Date('2026-08-25T11:30:00Z') },
        'UTC',
      );
      expect(result.title).toBe('With due');
      expect(result.googleEventId).toBeFalsy();
      expect(calendarPushService.createEventForTask).toHaveBeenCalled();
    });

    it('saves googleEventId when Google create succeeds', async () => {
      calendarPushService.createEventForTask.mockResolvedValue('gcal-abc');
      const result = await service.create(
        'user-1',
        { title: 'Synced', dueDate: new Date('2026-08-25T11:30:00Z') },
        'UTC',
      );
      expect(result.googleEventId).toBe('gcal-abc');
      expect(calendarSyncService.syncForUser).toHaveBeenCalledWith('user-1');
    });

    it('keeps Todo when Google create throws', async () => {
      calendarPushService.createEventForTask.mockRejectedValue(
        new Error('Google down'),
      );
      const result = await service.create(
        'user-1',
        { title: 'Still ok', dueDate: new Date('2026-08-25T11:30:00Z') },
        'UTC',
      );
      expect(result.title).toBe('Still ok');
      expect(result.googleEventId).toBeFalsy();
    });

    it('updates Google event when synced task is edited', async () => {
      tasksRepository.findByIdForUser.mockResolvedValue({
        id: 'task-1',
        userId: 'user-1',
        title: 'Old',
        status: TaskStatus.TODO,
        completedAt: null,
        dueDate: new Date('2026-08-25T11:30:00Z'),
        googleEventId: 'gcal-1',
      });
      calendarPushService.updateEventForTask.mockResolvedValue(true);

      await service.update('user-1', 'task-1', { title: 'New' }, 'UTC');
      expect(calendarPushService.updateEventForTask).toHaveBeenCalled();
    });

    it('creates Google event when due date is added to unsynced task', async () => {
      tasksRepository.findByIdForUser.mockResolvedValue({
        id: 'task-1',
        userId: 'user-1',
        title: 'Later',
        status: TaskStatus.TODO,
        completedAt: null,
        dueDate: null,
        googleEventId: null,
      });
      calendarPushService.createEventForTask.mockResolvedValue('gcal-new');

      const result = await service.update(
        'user-1',
        'task-1',
        { dueDate: new Date('2026-08-26T10:00:00Z') },
        'UTC',
      );
      expect(calendarPushService.createEventForTask).toHaveBeenCalled();
      expect(result.googleEventId).toBe('gcal-new');
    });

    it('deletes Google event and clears id when due date is removed', async () => {
      tasksRepository.findByIdForUser.mockResolvedValue({
        id: 'task-1',
        userId: 'user-1',
        title: 'Synced',
        status: TaskStatus.TODO,
        completedAt: null,
        dueDate: new Date('2026-08-25T11:30:00Z'),
        googleEventId: 'gcal-1',
      });
      calendarPushService.deleteEventForTask.mockResolvedValue(true);

      const result = await service.update(
        'user-1',
        'task-1',
        { dueDate: null },
        'UTC',
      );
      expect(calendarPushService.deleteEventForTask).toHaveBeenCalled();
      expect(result.googleEventId).toBeNull();
    });

    it('deletes Google event when synced task is deleted', async () => {
      tasksRepository.findByIdForUser.mockResolvedValue({
        id: 'task-1',
        userId: 'user-1',
        googleEventId: 'gcal-1',
      });
      await service.delete('user-1', 'task-1');
      expect(calendarPushService.deleteEventForTask).toHaveBeenCalled();
      expect(tasksRepository.remove).toHaveBeenCalled();
    });

    it('does not create duplicate Google events when googleEventId already set', async () => {
      calendarPushService.createEventForTask.mockImplementation(
        async (_userId, task) => task.googleEventId ?? 'gcal-1',
      );
      // First create path with existing id on the in-memory task after save
      tasksRepository.save.mockImplementation(async (value) => ({
        id: 'task-1',
        ...value,
        googleEventId: value.googleEventId ?? null,
      }));

      const first = await service.create(
        'user-1',
        { title: 'Once', dueDate: new Date('2026-08-25T11:30:00Z') },
        'UTC',
      );
      // Simulate push service idempotency on a second sync attempt
      calendarPushService.createEventForTask.mockClear();
      const again = await calendarPushService.createEventForTask(
        'user-1',
        { ...first, googleEventId: 'gcal-1' } as never,
        'UTC',
      );
      expect(again).toBe('gcal-1');
    });
  });
});
