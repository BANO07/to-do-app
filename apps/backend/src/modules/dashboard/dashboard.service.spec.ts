import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { TasksRepository } from '../tasks/tasks.repository';
import { TasksService } from '../tasks/tasks.service';
import { TaskStatus } from '../../common/enums/task-status.enum';

describe('DashboardService', () => {
  let service: DashboardService;

  const tasksRepository = {
    countDueToday: jest.fn(),
    countHighPriorityDueToday: jest.fn(),
    countCompletedToday: jest.fn(),
    countActiveByUser: jest.fn(),
  };

  const tasksService = {
    findAll: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: TasksRepository, useValue: tasksRepository },
        { provide: TasksService, useValue: tasksService },
      ],
    }).compile();

    service = module.get(DashboardService);
    jest.clearAllMocks();
    tasksRepository.countHighPriorityDueToday.mockResolvedValue(0);
    tasksRepository.countCompletedToday.mockResolvedValue(0);
    tasksRepository.countActiveByUser.mockResolvedValue(0);
    tasksService.findAll.mockResolvedValue({ pageInfo: { total: 0 } });
  });

  function mockDueToday(counts: {
    open?: number;
    inProgress?: number;
    completed?: number;
  }): void {
    tasksRepository.countDueToday.mockImplementation(
      async (_userId: string, _tz: string, statuses: TaskStatus[]) => {
        if (statuses.length === 1 && statuses[0] === TaskStatus.TODO) {
          return counts.open ?? 0;
        }
        if (statuses.length === 1 && statuses[0] === TaskStatus.IN_PROGRESS) {
          return counts.inProgress ?? 0;
        }
        if (statuses.length === 1 && statuses[0] === TaskStatus.COMPLETED) {
          return counts.completed ?? 0;
        }
        throw new Error(`Unexpected statuses: ${statuses.join(',')}`);
      },
    );
  }

  it('counts todayCompleted independently of the TODAY list view', async () => {
    mockDueToday({ open: 1, inProgress: 1, completed: 3 });
    tasksRepository.countHighPriorityDueToday.mockResolvedValue(1);
    tasksRepository.countCompletedToday.mockResolvedValue(4);
    tasksRepository.countActiveByUser.mockResolvedValue(6);
    tasksService.findAll.mockResolvedValue({ pageInfo: { total: 1 } });

    const summary = await service.getSummary('user-1', 'Asia/Kolkata');

    expect(summary.todayOpen).toBe(1);
    expect(summary.todayInProgress).toBe(1);
    expect(summary.todayPending).toBe(2);
    expect(summary.todayCompleted).toBe(3);
    expect(summary.todayTotal).toBe(5);
    expect(summary.completionPercentage).toBe(60);
    expect(summary.completedTodayCount).toBe(4);
    expect(tasksRepository.countDueToday).toHaveBeenCalledWith(
      'user-1',
      'Asia/Kolkata',
      [TaskStatus.COMPLETED],
    );
    expect(tasksService.findAll).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ view: 'OVERDUE' }),
      'Asia/Kolkata',
    );
  });

  it('returns 0% for one OPEN task due today', async () => {
    mockDueToday({ open: 1 });
    const summary = await service.getSummary('user-1', 'UTC');
    expect(summary.todayCompleted).toBe(0);
    expect(summary.todayTotal).toBe(1);
    expect(summary.completionPercentage).toBe(0);
  });

  it('returns 0% for one IN_PROGRESS task due today', async () => {
    mockDueToday({ inProgress: 1 });
    const summary = await service.getSummary('user-1', 'UTC');
    expect(summary.todayInProgress).toBe(1);
    expect(summary.todayCompleted).toBe(0);
    expect(summary.todayTotal).toBe(1);
    expect(summary.completionPercentage).toBe(0);
  });

  it('returns 100% for one COMPLETED task due today', async () => {
    mockDueToday({ completed: 1 });
    const summary = await service.getSummary('user-1', 'UTC');
    expect(summary.todayCompleted).toBe(1);
    expect(summary.todayTotal).toBe(1);
    expect(summary.completionPercentage).toBe(100);
  });

  it('returns 33% for mixed OPEN + IN_PROGRESS + COMPLETED due today', async () => {
    mockDueToday({ open: 1, inProgress: 1, completed: 1 });
    const summary = await service.getSummary('user-1', 'UTC');
    expect(summary.todayCompleted).toBe(1);
    expect(summary.todayTotal).toBe(3);
    expect(summary.completionPercentage).toBe(33);
  });

  it('returns 50% for COMPLETED + IN_PROGRESS due today', async () => {
    mockDueToday({ inProgress: 1, completed: 1 });
    const summary = await service.getSummary('user-1', 'UTC');
    expect(summary.completionPercentage).toBe(50);
  });

  it('excludes ARCHIVED from due-today counts', async () => {
    mockDueToday({ completed: 1 });
    const summary = await service.getSummary('user-1', 'UTC');
    expect(summary.todayTotal).toBe(1);
    expect(summary.completionPercentage).toBe(100);
    const statusLists = tasksRepository.countDueToday.mock.calls.map(
      (call: [string, string, TaskStatus[]]) => call[2],
    );
    expect(statusLists.flat()).not.toContain(TaskStatus.ARCHIVED);
  });

  it('does not include future or previous-day tasks in due-today totals', async () => {
    mockDueToday({ open: 0, inProgress: 0, completed: 0 });
    const summary = await service.getSummary('user-1', 'UTC');
    expect(summary.todayTotal).toBe(0);
    expect(summary.completionPercentage).toBe(0);
    expect(tasksRepository.countDueToday).toHaveBeenCalledTimes(3);
  });

  it('returns 0 as an API placeholder when there are no eligible tasks', async () => {
    mockDueToday({});
    const summary = await service.getSummary('user-1', 'UTC');
    expect(summary.todayTotal).toBe(0);
    expect(summary.todayCompleted).toBe(0);
    expect(summary.completionPercentage).toBe(0);
  });

  it('reuses the same timezone for every due-today count', async () => {
    mockDueToday({ inProgress: 1 });
    await service.getSummary('user-1', 'Asia/Kolkata');
    for (const call of tasksRepository.countDueToday.mock.calls) {
      expect(call[1]).toBe('Asia/Kolkata');
    }
  });
});
