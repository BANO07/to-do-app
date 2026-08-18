import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { SubtasksService } from './subtasks.service';
import { SubtasksRepository } from './subtasks.repository';
import { TasksRepository } from './tasks.repository';
import { SubtaskStatus } from '../../common/enums/subtask-status.enum';

describe('SubtasksService', () => {
  let service: SubtasksService;

  const subtasksRepository = {
    findByTaskForUser: jest.fn(),
    findByIdForUser: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
    nextPosition: jest.fn(),
  };

  const tasksRepository = {
    findByIdForUser: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubtasksService,
        { provide: SubtasksRepository, useValue: subtasksRepository },
        { provide: TasksRepository, useValue: tasksRepository },
      ],
    }).compile();

    service = module.get(SubtasksService);
    jest.clearAllMocks();
  });

  it('creates a subtask on an owned task', async () => {
    tasksRepository.findByIdForUser.mockResolvedValue({ id: 'task-1' });
    subtasksRepository.nextPosition.mockResolvedValue(0);
    subtasksRepository.create.mockImplementation((value) => value);
    subtasksRepository.save.mockImplementation(async (value) => ({
      id: 'sub-1',
      ...value,
    }));

    const result = await service.create('user-a', {
      taskId: 'task-1',
      title: 'Write tests',
    });

    expect(result.title).toBe('Write tests');
    expect(subtasksRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-a', taskId: 'task-1' }),
    );
  });

  it('rejects creating a subtask on another user task', async () => {
    tasksRepository.findByIdForUser.mockResolvedValue(null);

    await expect(
      service.create('user-a', { taskId: 'task-b', title: 'Nope' }),
    ).rejects.toThrow(NotFoundException);
    expect(subtasksRepository.save).not.toHaveBeenCalled();
  });

  it('updates, completes, reopens, and deletes only owned subtasks', async () => {
    const owned = {
      id: 'sub-1',
      userId: 'user-a',
      title: 'Draft',
      status: SubtaskStatus.TODO,
      completedAt: null,
    };
    subtasksRepository.findByIdForUser.mockResolvedValue(owned);
    subtasksRepository.save.mockImplementation(async (value) => value);

    const updated = await service.update('user-a', 'sub-1', { title: 'Done-ish' });
    expect(updated.title).toBe('Done-ish');

    const completed = await service.complete('user-a', 'sub-1');
    expect(completed.status).toBe(SubtaskStatus.COMPLETED);
    expect(completed.completedAt).toBeInstanceOf(Date);

    owned.status = SubtaskStatus.COMPLETED;
    const reopened = await service.reopen('user-a', 'sub-1');
    expect(reopened.status).toBe(SubtaskStatus.TODO);
    expect(reopened.completedAt).toBeNull();

    await expect(service.delete('user-a', 'sub-1')).resolves.toBe(true);
    expect(subtasksRepository.remove).toHaveBeenCalledWith(owned);
  });

  it('does not let user A access user B subtasks', async () => {
    subtasksRepository.findByIdForUser.mockResolvedValue(null);
    tasksRepository.findByIdForUser.mockResolvedValue(null);

    await expect(service.update('user-a', 'sub-b', { title: 'x' })).rejects.toThrow(
      NotFoundException,
    );
    await expect(service.complete('user-a', 'sub-b')).rejects.toThrow(
      NotFoundException,
    );
    await expect(service.reopen('user-a', 'sub-b')).rejects.toThrow(
      NotFoundException,
    );
    await expect(service.delete('user-a', 'sub-b')).rejects.toThrow(
      NotFoundException,
    );
    await expect(service.findByTask('user-a', 'task-b')).rejects.toThrow(
      NotFoundException,
    );
  });
});
