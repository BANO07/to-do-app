import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { QueryFailedError } from 'typeorm';
import { TasksRepository } from './tasks.repository';
import { CategoriesService } from '../categories/categories.service';
import { SubtasksRepository } from './subtasks.repository';
import { RecurrenceRulesRepository } from './recurrence-rules.repository';
import { RemindersService } from './reminders.service';
import { CalendarPushService } from '../calendar/calendar-push.service';
import { CalendarSyncService } from '../calendar/calendar-sync.service';
import { Task } from './entities/task.entity';
import { RecurrenceRule } from './entities/recurrence-rule.entity';
import {
  CreateTaskInput,
  UpdateTaskInput,
  TaskFilterInput,
} from './dto/task.inputs';
import { RecurrenceInput } from './dto/recurrence.inputs';
import { TaskProgress } from './dto/task-progress.dto';
import { TaskStatus } from '../../common/enums/task-status.enum';
import { SubtaskStatus } from '../../common/enums/subtask-status.enum';
import { TaskConnection } from '../../common/dto/task-connection.dto';
import { PageInfo } from '../../common/dto/page-info.dto';
import {
  copyTimeToYmd,
  formatYmd,
  getZonedDayBounds,
  normalizeTimeZone,
} from '../../common/utils/date-time.util';
import { nextOccurrenceDate } from '../../common/utils/recurrence.util';

const EMPTY_PROGRESS: TaskProgress = {
  completed: 0,
  total: 0,
  percentage: 0,
};

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    typeof error.driverError === 'object' &&
    error.driverError !== null &&
    'code' in error.driverError &&
    (error.driverError as { code: string }).code === '23505'
  );
}

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private readonly tasksRepository: TasksRepository,
    private readonly categoriesService: CategoriesService,
    private readonly subtasksRepository: SubtasksRepository,
    private readonly recurrenceRulesRepository: RecurrenceRulesRepository,
    private readonly remindersService: RemindersService,
    private readonly calendarPushService: CalendarPushService,
    private readonly calendarSyncService: CalendarSyncService,
  ) {}

  async findAll(
    userId: string,
    filter: TaskFilterInput,
    timeZone?: string,
  ): Promise<TaskConnection> {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 20;
    const { items, total } = await this.tasksRepository.findWithFilters(
      userId,
      filter,
      timeZone,
    );

    const totalPages = Math.max(1, Math.ceil(total / limit));

    const pageInfo: PageInfo = {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    };

    return { items: await this.withExtras(userId, items), pageInfo };
  }

  async findById(userId: string, id: string): Promise<Task> {
    const task = await this.tasksRepository.findByIdForUser(id, userId);
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    const [enriched] = await this.withExtras(userId, [task]);
    return enriched;
  }

  async create(
    userId: string,
    input: CreateTaskInput,
    timeZone?: string,
  ): Promise<Task> {
    if (input.categoryId) {
      await this.categoriesService.findById(userId, input.categoryId);
    }

    const tz = normalizeTimeZone(timeZone);
    const { recurrence, subtaskTitles, ...taskFields } = input;

    let seriesId: string | undefined;
    let occurrenceDate: string | undefined;
    let rule: RecurrenceRule | undefined;

    if (recurrence) {
      seriesId = randomUUID();
      occurrenceDate = this.occurrenceDateFor(taskFields.dueDate, tz);
      rule = this.buildRule(userId, seriesId, recurrence, occurrenceDate, tz);
      await this.recurrenceRulesRepository.save(rule);
    }

    const task = this.tasksRepository.create({
      ...taskFields,
      userId,
      status: TaskStatus.TODO,
      seriesId: seriesId ?? null,
      occurrenceDate: occurrenceDate ?? null,
    });

    const saved = await this.tasksRepository.save(task);
    await this.createLinkedSubtasks(userId, saved.id, subtaskTitles);
    const synced = await this.syncGoogleCalendarAfterCreate(userId, saved, tz);
    const [enriched] = await this.withExtras(userId, [synced]);
    return enriched;
  }

  async update(
    userId: string,
    id: string,
    input: UpdateTaskInput,
    timeZone?: string,
  ): Promise<Task> {
    const task = await this.tasksRepository.findByIdForUser(id, userId);
    if (!task) {
      throw new NotFoundException('Task not found');
    }

    if (input.categoryId) {
      await this.categoriesService.findById(userId, input.categoryId);
    }

    const tz = normalizeTimeZone(timeZone);
    const { recurrence, stopRecurrence, ...taskFields } = input;
    const previousDueDate = task.dueDate;

    if (input.status === TaskStatus.COMPLETED && !task.completedAt) {
      task.completedAt = new Date();
    }

    if (
      input.status &&
      input.status !== TaskStatus.COMPLETED &&
      task.status === TaskStatus.COMPLETED
    ) {
      task.completedAt = null;
    }

    Object.assign(task, taskFields);

    if (stopRecurrence) {
      await this.deactivateRule(userId, task);
    } else if (recurrence) {
      await this.upsertRule(userId, task, recurrence, tz);
    }

    const saved = await this.tasksRepository.save(task);

    if (taskFields.dueDate !== undefined && saved.dueDate !== previousDueDate) {
      await this.remindersService.rescheduleOffsetReminders(userId, saved);
    }

    if (saved.status === TaskStatus.COMPLETED && saved.seriesId) {
      await this.generateNextOccurrence(userId, saved, tz);
    }

    const synced = await this.syncGoogleCalendarAfterUpdate(userId, saved, tz);
    const [enriched] = await this.withExtras(userId, [synced]);
    return enriched;
  }

  async complete(
    userId: string,
    id: string,
    timeZone?: string,
  ): Promise<Task> {
    const task = await this.tasksRepository.findByIdForUser(id, userId);
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    if (task.status === TaskStatus.COMPLETED) {
      const [enriched] = await this.withExtras(userId, [task]);
      return enriched;
    }
    task.status = TaskStatus.COMPLETED;
    task.completedAt = new Date();
    const saved = await this.tasksRepository.save(task);
    await this.generateNextOccurrence(
      userId,
      saved,
      normalizeTimeZone(timeZone),
    );
    const [enriched] = await this.withExtras(userId, [saved]);
    return enriched;
  }

  async reopen(userId: string, id: string): Promise<Task> {
    const task = await this.tasksRepository.findByIdForUser(id, userId);
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    if (task.status !== TaskStatus.COMPLETED) {
      throw new BadRequestException('Only completed tasks can be reopened');
    }
    task.status = TaskStatus.TODO;
    task.completedAt = null;
    const saved = await this.tasksRepository.save(task);
    const [enriched] = await this.withExtras(userId, [saved]);
    return enriched;
  }

  async archive(userId: string, id: string): Promise<Task> {
    const task = await this.tasksRepository.findByIdForUser(id, userId);
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    task.status = TaskStatus.ARCHIVED;
    const saved = await this.tasksRepository.save(task);
    const [enriched] = await this.withExtras(userId, [saved]);
    return enriched;
  }

  async restore(userId: string, id: string): Promise<Task> {
    const task = await this.tasksRepository.findByIdForUser(id, userId);
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    if (task.status !== TaskStatus.ARCHIVED) {
      throw new BadRequestException('Only archived tasks can be restored');
    }
    task.status = TaskStatus.TODO;
    task.completedAt = null;
    const saved = await this.tasksRepository.save(task);
    const [enriched] = await this.withExtras(userId, [saved]);
    return enriched;
  }

  async delete(userId: string, id: string): Promise<boolean> {
    const task = await this.tasksRepository.findByIdForUser(id, userId);
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    await this.syncGoogleCalendarBeforeDelete(userId, task);
    await this.tasksRepository.remove(task);
    return true;
  }

  async stopRecurrence(userId: string, taskId: string): Promise<Task> {
    const task = await this.tasksRepository.findByIdForUser(taskId, userId);
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    await this.deactivateRule(userId, task);
    const [enriched] = await this.withExtras(userId, [task]);
    return enriched;
  }

  /**
   * Completing an occurrence creates only the next instance.
   * Unique (series_id, occurrence_date) prevents duplicates.
   * Limitation: editing the rule does not rewrite already-created future tasks.
   */
  async generateNextOccurrence(
    userId: string,
    completedTask: Task,
    timeZone: string,
  ): Promise<Task | null> {
    if (!completedTask.seriesId) {
      return null;
    }

    const rule = await this.recurrenceRulesRepository.findBySeriesForUser(
      completedTask.seriesId,
      userId,
    );
    if (!rule?.isActive) {
      return null;
    }

    const tz = rule.timezone || timeZone;
    const fromYmd =
      completedTask.occurrenceDate ??
      formatYmd(completedTask.dueDate ?? new Date(), tz);
    const nextYmd = nextOccurrenceDate(fromYmd, {
      frequency: rule.frequency,
      interval: rule.interval,
      daysOfWeek: rule.daysOfWeek,
      dayOfMonth: rule.dayOfMonth,
      endDate: rule.endDate,
    });

    if (!nextYmd) {
      rule.isActive = false;
      await this.recurrenceRulesRepository.save(rule);
      return null;
    }

    const existing = await this.tasksRepository.findBySeriesOccurrence(
      userId,
      rule.seriesId,
      nextYmd,
    );
    if (existing) {
      rule.lastGeneratedOccurrence = nextYmd;
      await this.recurrenceRulesRepository.save(rule);
      return existing;
    }

    const dueDate = completedTask.dueDate
      ? copyTimeToYmd(completedTask.dueDate, nextYmd, tz)
      : null;

    const next = this.tasksRepository.create({
      userId,
      title: completedTask.title,
      description: completedTask.description,
      priority: completedTask.priority,
      categoryId: completedTask.categoryId,
      status: TaskStatus.TODO,
      seriesId: rule.seriesId,
      occurrenceDate: nextYmd,
      dueDate,
    });

    try {
      const saved = await this.tasksRepository.save(next);
      rule.lastGeneratedOccurrence = nextYmd;
      await this.recurrenceRulesRepository.save(rule);
      await this.remindersService.copyOffsetReminders(
        userId,
        completedTask.id,
        saved,
      );
      // V1: each occurrence Task with a due date may get its own Google event.
      return this.syncGoogleCalendarAfterCreate(userId, saved, tz);
    } catch (error) {
      if (isUniqueViolation(error)) {
        rule.lastGeneratedOccurrence = nextYmd;
        await this.recurrenceRulesRepository.save(rule);
        return this.tasksRepository.findBySeriesOccurrence(
          userId,
          rule.seriesId,
          nextYmd,
        );
      }
      throw error;
    }
  }

  /**
   * Best-effort Todo → Google Calendar push after create.
   * Never throws — Todo persistence already succeeded.
   */
  private async syncGoogleCalendarAfterCreate(
    userId: string,
    task: Task,
    timeZone: string,
  ): Promise<Task> {
    try {
      if (!task.dueDate || task.googleEventId) {
        return task;
      }
      const eventId = await this.calendarPushService.createEventForTask(
        userId,
        task,
        timeZone,
      );
      if (!eventId) {
        return task;
      }
      task.googleEventId = eventId;
      const saved = await this.tasksRepository.save(task);
      this.scheduleCalendarPull(userId);
      return saved;
    } catch (error) {
      this.logger.warn(
        `[Tasks] Google Calendar create sync failed taskId=${task.id}: ${error instanceof Error ? error.message : 'unknown'}`,
      );
      return task;
    }
  }

  /**
   * Best-effort Todo → Google Calendar push after update.
   * - due date added → create
   * - due date kept + linked → update
   * - due date removed + linked → delete + clear id
   */
  private async syncGoogleCalendarAfterUpdate(
    userId: string,
    task: Task,
    timeZone: string,
  ): Promise<Task> {
    try {
      if (task.dueDate && task.googleEventId) {
        await this.calendarPushService.updateEventForTask(userId, task, timeZone);
        this.scheduleCalendarPull(userId);
        return task;
      }

      if (task.dueDate && !task.googleEventId) {
        const eventId = await this.calendarPushService.createEventForTask(
          userId,
          task,
          timeZone,
        );
        if (eventId) {
          task.googleEventId = eventId;
          const saved = await this.tasksRepository.save(task);
          this.scheduleCalendarPull(userId);
          return saved;
        }
        return task;
      }

      if (!task.dueDate && task.googleEventId) {
        const deleted = await this.calendarPushService.deleteEventForTask(
          userId,
          task,
        );
        if (deleted) {
          task.googleEventId = null;
          return this.tasksRepository.save(task);
        }
      }

      return task;
    } catch (error) {
      this.logger.warn(
        `[Tasks] Google Calendar update sync failed taskId=${task.id}: ${error instanceof Error ? error.message : 'unknown'}`,
      );
      return task;
    }
  }

  private async syncGoogleCalendarBeforeDelete(
    userId: string,
    task: Task,
  ): Promise<void> {
    if (!task.googleEventId) {
      return;
    }
    try {
      await this.calendarPushService.deleteEventForTask(userId, task);
    } catch (error) {
      this.logger.warn(
        `[Tasks] Google Calendar delete sync failed taskId=${task.id}: ${error instanceof Error ? error.message : 'unknown'}`,
      );
    }
  }

  /** Refresh calendar_events so the Calendar UI can show newly pushed events. */
  private scheduleCalendarPull(userId: string): void {
    void this.calendarSyncService.syncForUser(userId).catch((error) => {
      this.logger.warn(
        `[Tasks] Calendar pull after push failed userId=${userId}: ${error instanceof Error ? error.message : 'unknown'}`,
      );
    });
  }

  private async upsertRule(
    userId: string,
    task: Task,
    input: RecurrenceInput,
    timeZone: string,
  ): Promise<void> {
    const tz = normalizeTimeZone(timeZone);
    if (task.seriesId) {
      const existing = await this.recurrenceRulesRepository.findBySeriesForUser(
        task.seriesId,
        userId,
      );
      if (!existing) {
        throw new NotFoundException('Recurrence rule not found');
      }
      existing.frequency = input.frequency;
      existing.interval = input.interval ?? 1;
      existing.daysOfWeek = input.daysOfWeek ?? null;
      existing.dayOfMonth = input.dayOfMonth ?? null;
      existing.endDate = input.endDate ?? null;
      existing.isActive = true;
      await this.recurrenceRulesRepository.save(existing);
      return;
    }

    const seriesId = randomUUID();
    const occurrenceDate = this.occurrenceDateFor(task.dueDate, tz);
    const rule = this.buildRule(
      userId,
      seriesId,
      input,
      occurrenceDate,
      tz,
    );
    await this.recurrenceRulesRepository.save(rule);
    task.seriesId = seriesId;
    task.occurrenceDate = occurrenceDate;
  }

  private async deactivateRule(userId: string, task: Task): Promise<void> {
    if (!task.seriesId) {
      return;
    }
    const rule = await this.recurrenceRulesRepository.findBySeriesForUser(
      task.seriesId,
      userId,
    );
    if (!rule) {
      return;
    }
    rule.isActive = false;
    await this.recurrenceRulesRepository.save(rule);
  }

  private buildRule(
    userId: string,
    seriesId: string,
    input: RecurrenceInput,
    startDate: string,
    timeZone: string,
  ): RecurrenceRule {
    return this.recurrenceRulesRepository.create({
      userId,
      seriesId,
      frequency: input.frequency,
      interval: input.interval ?? 1,
      daysOfWeek: input.daysOfWeek ?? null,
      dayOfMonth: input.dayOfMonth ?? null,
      startDate,
      endDate: input.endDate ?? null,
      timezone: timeZone,
      lastGeneratedOccurrence: startDate,
      isActive: true,
    });
  }

  private async createLinkedSubtasks(
    userId: string,
    taskId: string,
    titles?: string[],
  ): Promise<void> {
    if (!titles?.length) {
      return;
    }

    const cleaned = titles
      .map((title) => title.trim())
      .filter((title) => title.length > 0)
      .slice(0, 20);

    for (const [position, title] of cleaned.entries()) {
      const subtask = this.subtasksRepository.create({
        taskId,
        userId,
        title,
        status: SubtaskStatus.TODO,
        position,
      });
      await this.subtasksRepository.save(subtask);
    }
  }

  private occurrenceDateFor(dueDate: Date | undefined | null, timeZone: string): string {
    if (dueDate) {
      return formatYmd(dueDate, timeZone);
    }
    return getZonedDayBounds(new Date(), timeZone).ymd;
  }

  private async withExtras(userId: string, tasks: Task[]): Promise<Task[]> {
    if (tasks.length === 0) {
      return tasks;
    }

    const taskIds = tasks.map((task) => task.id);
    const progressByTask = await this.subtasksRepository.aggregateProgress(
      userId,
      taskIds,
    );

    const seriesIds = [
      ...new Set(
        tasks
          .map((task) => task.seriesId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const rules =
      await this.recurrenceRulesRepository.findBySeriesIdsForUser(
        seriesIds,
        userId,
      );
    const ruleBySeries = new Map(rules.map((rule) => [rule.seriesId, rule]));

    for (const task of tasks) {
      task.progress = progressByTask.get(task.id) ?? { ...EMPTY_PROGRESS };
      task.recurrence = task.seriesId
        ? (ruleBySeries.get(task.seriesId) ?? null)
        : null;
    }

    return tasks;
  }
}
