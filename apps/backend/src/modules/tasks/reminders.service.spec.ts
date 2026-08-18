import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { RemindersService } from './reminders.service';
import { RemindersRepository } from './reminders.repository';
import { TasksRepository } from './tasks.repository';
import { ReminderChannel } from '../../common/enums/reminder-channel.enum';

describe('RemindersService', () => {
  let service: RemindersService;

  const remindersRepository = {
    findByTaskForUser: jest.fn(),
    findByIdForUser: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  };

  const tasksRepository = {
    findByIdForUser: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RemindersService,
        { provide: RemindersRepository, useValue: remindersRepository },
        { provide: TasksRepository, useValue: tasksRepository },
      ],
    }).compile();

    service = module.get(RemindersService);
    jest.clearAllMocks();
  });

  it('creates an offset reminder from the task due date', async () => {
    const dueDate = new Date('2026-08-18T04:00:00.000Z');
    tasksRepository.findByIdForUser.mockResolvedValue({
      id: 'task-1',
      dueDate,
    });
    remindersRepository.create.mockImplementation((value) => value);
    remindersRepository.save.mockImplementation(async (value) => ({
      id: 'rem-1',
      ...value,
    }));

    const result = await service.create(
      'user-a',
      { taskId: 'task-1', offsetMinutes: 15 },
      'Asia/Kolkata',
    );

    expect(result.fireAt.toISOString()).toBe('2026-08-18T03:45:00.000Z');
    expect(result.offsetMinutes).toBe(15);
    expect(result.channel).toBe(ReminderChannel.IN_APP);
  });

  it('creates a custom reminder using the user timezone', async () => {
    tasksRepository.findByIdForUser.mockResolvedValue({
      id: 'task-1',
      dueDate: new Date('2026-08-18T04:00:00.000Z'),
    });
    remindersRepository.create.mockImplementation((value) => value);
    remindersRepository.save.mockImplementation(async (value) => value);

    const result = await service.create(
      'user-a',
      { taskId: 'task-1', localDateTime: '2026-08-18T09:00' },
      'Asia/Kolkata',
    );

    expect(result.fireAt.toISOString()).toBe('2026-08-18T03:30:00.000Z');
    expect(result.offsetMinutes).toBeNull();
  });

  it('updates and deletes only owned reminders', async () => {
    const reminder = {
      id: 'rem-1',
      userId: 'user-a',
      taskId: 'task-1',
      fireAt: new Date('2026-08-18T03:45:00.000Z'),
      offsetMinutes: 15,
    };
    remindersRepository.findByIdForUser.mockResolvedValue(reminder);
    tasksRepository.findByIdForUser.mockResolvedValue({
      id: 'task-1',
      dueDate: new Date('2026-08-18T04:00:00.000Z'),
    });
    remindersRepository.save.mockImplementation(async (value) => value);

    const updated = await service.update(
      'user-a',
      'rem-1',
      { offsetMinutes: 60 },
      'Asia/Kolkata',
    );
    expect(updated.fireAt.toISOString()).toBe('2026-08-18T03:00:00.000Z');

    await expect(service.delete('user-a', 'rem-1')).resolves.toBe(true);
    expect(remindersRepository.remove).toHaveBeenCalledWith(reminder);
  });

  it('does not let user A access user B reminders', async () => {
    remindersRepository.findByIdForUser.mockResolvedValue(null);
    tasksRepository.findByIdForUser.mockResolvedValue(null);

    await expect(
      service.create(
        'user-a',
        { taskId: 'task-b', offsetMinutes: 15 },
        'UTC',
      ),
    ).rejects.toThrow(NotFoundException);
    await expect(
      service.update('user-a', 'rem-b', { offsetMinutes: 5 }, 'UTC'),
    ).rejects.toThrow(NotFoundException);
    await expect(service.delete('user-a', 'rem-b')).rejects.toThrow(
      NotFoundException,
    );
    await expect(service.findByTask('user-a', 'task-b')).rejects.toThrow(
      NotFoundException,
    );
  });
});
