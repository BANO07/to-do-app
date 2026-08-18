import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { RemindersRepository } from './reminders.repository';
import { TasksRepository } from './tasks.repository';
import { Reminder } from './entities/reminder.entity';
import { Task } from './entities/task.entity';
import {
  CreateReminderInput,
  UpdateReminderInput,
} from './dto/reminder.inputs';
import { ReminderChannel } from '../../common/enums/reminder-channel.enum';
import {
  addMinutes,
  localDateTimeToUtc,
  parseLocalDateTime,
} from '../../common/utils/date-time.util';

@Injectable()
export class RemindersService {
  constructor(
    private readonly remindersRepository: RemindersRepository,
    private readonly tasksRepository: TasksRepository,
  ) {}

  async findByTask(userId: string, taskId: string): Promise<Reminder[]> {
    await this.requireOwnedTask(userId, taskId);
    return this.remindersRepository.findByTaskForUser(taskId, userId);
  }

  async create(
    userId: string,
    input: CreateReminderInput,
    timeZone: string,
  ): Promise<Reminder> {
    const task = await this.requireOwnedTask(userId, input.taskId);
    const { fireAt, offsetMinutes } = this.resolveFireAt(
      input,
      task,
      timeZone,
    );

    const reminder = this.remindersRepository.create({
      userId,
      taskId: task.id,
      fireAt,
      offsetMinutes,
      channel: input.channel ?? ReminderChannel.IN_APP,
    });

    return this.remindersRepository.save(reminder);
  }

  async update(
    userId: string,
    id: string,
    input: UpdateReminderInput,
    timeZone: string,
  ): Promise<Reminder> {
    const reminder = await this.requireOwnedReminder(userId, id);
    const task = await this.requireOwnedTask(userId, reminder.taskId);
    const { fireAt, offsetMinutes } = this.resolveFireAt(
      {
        ...input,
        offsetMinutes:
          input.offsetMinutes ??
          (input.localDateTime || input.fireAt
            ? undefined
            : reminder.offsetMinutes ?? undefined),
        fireAt: input.fireAt,
        localDateTime: input.localDateTime,
      },
      task,
      timeZone,
      reminder,
    );

    reminder.fireAt = fireAt;
    reminder.offsetMinutes = offsetMinutes;
    if (input.channel) {
      reminder.channel = input.channel;
    }

    return this.remindersRepository.save(reminder);
  }

  async delete(userId: string, id: string): Promise<boolean> {
    const reminder = await this.requireOwnedReminder(userId, id);
    await this.remindersRepository.remove(reminder);
    return true;
  }

  async rescheduleOffsetReminders(userId: string, task: Task): Promise<void> {
    if (!task.dueDate) {
      return;
    }

    const reminders = await this.remindersRepository.findByTaskForUser(
      task.id,
      userId,
    );

    await Promise.all(
      reminders
        .filter((reminder) => reminder.offsetMinutes != null)
        .map((reminder) => {
          reminder.fireAt = addMinutes(task.dueDate!, -reminder.offsetMinutes!);
          return this.remindersRepository.save(reminder);
        }),
    );
  }

  async copyOffsetReminders(
    userId: string,
    fromTaskId: string,
    toTask: Task,
  ): Promise<void> {
    if (!toTask.dueDate) {
      return;
    }

    const source = await this.remindersRepository.findByTaskForUser(
      fromTaskId,
      userId,
    );

    await Promise.all(
      source
        .filter((reminder) => reminder.offsetMinutes != null)
        .map((reminder) => {
          const copy = this.remindersRepository.create({
            userId,
            taskId: toTask.id,
            offsetMinutes: reminder.offsetMinutes,
            channel: reminder.channel,
            fireAt: addMinutes(toTask.dueDate!, -reminder.offsetMinutes!),
          });
          return this.remindersRepository.save(copy);
        }),
    );
  }

  private resolveFireAt(
    input: {
      offsetMinutes?: number;
      localDateTime?: string;
      fireAt?: Date;
    },
    task: Task,
    timeZone: string,
    existing?: Reminder,
  ): { fireAt: Date; offsetMinutes: number | null } {
    if (input.offsetMinutes != null) {
      if (!task.dueDate) {
        throw new BadRequestException(
          'Cannot create an offset reminder on a task without a due date',
        );
      }
      return {
        fireAt: addMinutes(task.dueDate, -input.offsetMinutes),
        offsetMinutes: input.offsetMinutes,
      };
    }

    if (input.localDateTime) {
      if (!parseLocalDateTime(input.localDateTime)) {
        throw new BadRequestException(
          'localDateTime must be YYYY-MM-DDTHH:mm',
        );
      }
      return {
        fireAt: localDateTimeToUtc(input.localDateTime, timeZone),
        offsetMinutes: null,
      };
    }

    if (input.fireAt) {
      return { fireAt: input.fireAt, offsetMinutes: null };
    }

    if (existing) {
      return {
        fireAt: existing.fireAt,
        offsetMinutes: existing.offsetMinutes ?? null,
      };
    }

    throw new BadRequestException(
      'Provide offsetMinutes, localDateTime, or fireAt',
    );
  }

  private async requireOwnedTask(userId: string, taskId: string): Promise<Task> {
    const task = await this.tasksRepository.findByIdForUser(taskId, userId);
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    return task;
  }

  private async requireOwnedReminder(
    userId: string,
    id: string,
  ): Promise<Reminder> {
    const reminder = await this.remindersRepository.findByIdForUser(id, userId);
    if (!reminder) {
      throw new NotFoundException('Reminder not found');
    }
    return reminder;
  }
}
