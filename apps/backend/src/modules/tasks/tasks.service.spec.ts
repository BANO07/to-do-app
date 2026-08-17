import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { TasksRepository } from './tasks.repository';
import { CategoriesService } from '../categories/categories.service';
import { TaskStatus } from '../../common/enums/task-status.enum';

describe('TasksService', () => {
  let service: TasksService;

  const tasksRepository = {
    findWithFilters: jest.fn(),
    findByIdForUser: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  };

  const categoriesService = {
    findById: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        { provide: TasksRepository, useValue: tasksRepository },
        { provide: CategoriesService, useValue: categoriesService },
      ],
    }).compile();

    service = module.get(TasksService);
    jest.clearAllMocks();
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
    };
    tasksRepository.findByIdForUser.mockResolvedValue(task);
    tasksRepository.save.mockImplementation(async (value) => value);

    const result = await service.complete('user-1', 'task-1');

    expect(result.status).toBe(TaskStatus.COMPLETED);
    expect(result.completedAt).toBeInstanceOf(Date);
  });

  it('should delete only owned task', async () => {
    const task = { id: 'task-1', userId: 'user-1' };
    tasksRepository.findByIdForUser.mockResolvedValue(task);

    await expect(service.delete('user-1', 'task-1')).resolves.toBe(true);
    expect(tasksRepository.remove).toHaveBeenCalledWith(task);
  });
});
