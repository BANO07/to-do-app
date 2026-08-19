import { Test, TestingModule } from '@nestjs/testing';
import { AiToolsService } from './ai-tools.service';
import { TasksService } from '../../tasks/tasks.service';
import { CategoriesService } from '../../categories/categories.service';
import { DashboardService } from '../../dashboard/dashboard.service';
import { RemindersService } from '../../tasks/reminders.service';
import { SubtasksService } from '../../tasks/subtasks.service';

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
      ],
    }).compile();

    service = module.get(AiToolsService);
  });

  it('exposes all required tools', () => {
    const names = service.getToolDefinitions().map((tool) => tool.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'getTasks',
        'getTask',
        'getCategories',
        'getDashboardStats',
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
    expect(names).toHaveLength(14);
  });

  it('uses authenticated user for getTasks', async () => {
    tasksService.findAll.mockResolvedValue({
      items: [{ id: 't1', title: 'A', status: 'TODO', priority: 'LOW', dueDate: null }],
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

  it('creates tasks with ownership from context', async () => {
    tasksService.create.mockResolvedValue({
      id: 'task-1',
      title: 'New task',
      status: 'TODO',
      priority: 'MEDIUM',
      dueDate: null,
    });

    const result = await service.executeTool(
      { userId: 'user-1', timeZone: 'UTC', conversationId: 'conv-1' },
      'call-1',
      'createTask',
      { title: 'New task', userId: 'someone-else' },
    );

    expect(tasksService.create).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ title: 'New task' }),
    );
    expect(result.success).toBe(true);
  });
});
