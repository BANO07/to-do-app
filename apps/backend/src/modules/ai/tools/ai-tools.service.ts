import { Injectable } from '@nestjs/common';
import { TasksService } from '../../tasks/tasks.service';
import { CategoriesService } from '../../categories/categories.service';
import { DashboardService } from '../../dashboard/dashboard.service';
import { RemindersService } from '../../tasks/reminders.service';
import { SubtasksService } from '../../tasks/subtasks.service';
import { CalendarEventService } from '../../calendar/calendar-event.service';
import { TaskListView } from '../../../common/enums/task-list-view.enum';
import { TaskStatus } from '../../../common/enums/task-status.enum';
import { TaskPriority } from '../../../common/enums/task-priority.enum';
import { ReminderChannel } from '../../../common/enums/reminder-channel.enum';
import {
  AiToolContext,
  AiToolDefinition,
  AiToolExecutionResult,
} from './ai-tool.types';
import { AiProductivityService } from '../productivity/ai-productivity.service';
import { RecurrenceFrequency } from '../../../common/enums/recurrence-frequency.enum';
import { formatYmd } from '../../../common/utils/date-time.util';
import {
  optionalEnum,
  optionalNumber,
  optionalString,
  optionalStringArray,
  requireString,
  sanitizeToolArguments,
} from './ai-tool-args.util';

function taskSummary(task: {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate?: Date | null;
}): Record<string, unknown> {
  return {
    id: task.id,
    title: task.title,
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate?.toISOString() ?? null,
  };
}

@Injectable()
export class AiToolsService {
  constructor(
    private readonly tasksService: TasksService,
    private readonly categoriesService: CategoriesService,
    private readonly dashboardService: DashboardService,
    private readonly remindersService: RemindersService,
    private readonly subtasksService: SubtasksService,
    private readonly productivityService: AiProductivityService,
    private readonly calendarEventService: CalendarEventService,
  ) {}

  getToolDefinitions(): AiToolDefinition[] {
    return [
      this.getTasksTool(),
      this.getTaskTool(),
      this.getCategoriesTool(),
      this.getDashboardStatsTool(),
      this.getCalendarEventsTool(),
      this.getTodayCalendarTool(),
      this.getUpcomingCalendarTool(),
      this.getWeeklyReviewTool(),
      this.getProductivityInsightsTool(),
      this.getRemindersTool(),
      this.planMyDayTool(),
      this.createTaskTool(),
      this.updateTaskTool(),
      this.deleteTaskTool(),
      this.completeTaskTool(),
      this.reopenTaskTool(),
      this.createSubtaskTool(),
      this.createReminderTool(),
      this.updateReminderTool(),
      this.deleteReminderTool(),
    ];
  }

  getTool(name: string): AiToolDefinition | undefined {
    return this.getToolDefinitions().find((tool) => tool.name === name);
  }

  async executeTool(
    context: AiToolContext,
    toolCallId: string | undefined,
    name: string,
    rawArgs: Record<string, unknown>,
  ): Promise<AiToolExecutionResult> {
    const tool = this.getTool(name);
    if (!tool) {
      return {
        toolCallId,
        toolName: name,
        success: false,
        summary: `Unknown tool "${name}".`,
        error: 'UNKNOWN_TOOL',
      };
    }

    const args = sanitizeToolArguments(rawArgs);

    try {
      const data = await tool.execute(context, args);
      return {
        toolCallId,
        toolName: name,
        success: true,
        summary: this.formatSuccessSummary(name, data),
        data,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Tool execution failed';
      return {
        toolCallId,
        toolName: name,
        success: false,
        summary: `Could not complete ${name}: ${message}`,
        error: message,
      };
    }
  }

  buildConfirmation(
    toolName: string,
    args: Record<string, unknown>,
    preview?: unknown,
  ): { title: string; description: string } {
    switch (toolName) {
      case 'deleteTask': {
        const title =
          typeof preview === 'object' &&
          preview &&
          'title' in preview &&
          typeof (preview as { title: unknown }).title === 'string'
            ? (preview as { title: string }).title
            : optionalString(args, 'taskId') ?? 'this task';
        return {
          title: 'Delete task',
          description: `Delete "${title}" permanently? This action cannot be undone.`,
        };
      }
      case 'deleteReminder':
        return {
          title: 'Delete reminder',
          description:
            'Delete this reminder permanently? This action cannot be undone.',
        };
      default:
        return {
          title: 'Confirm action',
          description: `Proceed with ${toolName}?`,
        };
    }
  }

  formatSuccessSummary(toolName: string, data: unknown): string {
    if (data == null) {
      return `Completed ${toolName}.`;
    }

    if (typeof data === 'object' && data && 'summary' in data) {
      return String((data as { summary: unknown }).summary);
    }

    switch (toolName) {
      case 'getTasks': {
        const items =
          typeof data === 'object' &&
          data &&
          'items' in data &&
          Array.isArray((data as { items: unknown[] }).items)
            ? (data as { items: Array<{ title: string }> }).items
            : [];
        if (items.length === 0) {
          return 'No matching tasks found.';
        }
        return `Found ${items.length} task(s): ${items
          .slice(0, 5)
          .map((item) => item.title)
          .join(', ')}${items.length > 5 ? '…' : ''}`;
      }
      case 'getTask':
        return typeof data === 'object' &&
          data &&
          'title' in data &&
          typeof (data as { title: unknown }).title === 'string'
          ? `Task: ${(data as { title: string }).title}`
          : 'Task loaded.';
      case 'getCategories': {
        const categories = Array.isArray(data) ? data : [];
        return categories.length
          ? `Categories: ${categories
              .slice(0, 8)
              .map((item) =>
                typeof item === 'object' && item && 'name' in item
                  ? String((item as { name: unknown }).name)
                  : 'Unknown',
              )
              .join(', ')}`
          : 'No categories found.';
      }
      case 'getDashboardStats':
        return 'Loaded your productivity summary.';
      case 'planMyDay': {
        if (
          typeof data === 'object' &&
          data &&
          'summary' in data &&
          typeof (data as { summary: unknown }).summary === 'string'
        ) {
          return (data as { summary: string }).summary;
        }
        return 'Built your day plan.';
      }
      case 'getProductivityInsights': {
        if (
          typeof data === 'object' &&
          data &&
          'summary' in data &&
          typeof (data as { summary: unknown }).summary === 'string'
        ) {
          return (data as { summary: string }).summary;
        }
        return 'Loaded productivity insights.';
      }
      case 'getReminders': {
        const reminders = Array.isArray(data) ? data : [];
        return reminders.length
          ? `Found ${reminders.length} reminder(s).`
          : 'No reminders found.';
      }
      case 'createTask':
        return typeof data === 'object' &&
          data &&
          'title' in data &&
          typeof (data as { title: unknown }).title === 'string'
          ? `Created task "${(data as { title: string }).title}".`
          : 'Task created.';
      case 'updateTask':
        return typeof data === 'object' &&
          data &&
          'title' in data &&
          typeof (data as { title: unknown }).title === 'string'
          ? `Updated task "${(data as { title: string }).title}".`
          : 'Task updated.';
      case 'deleteTask':
        return 'Task deleted.';
      case 'completeTask':
        return typeof data === 'object' &&
          data &&
          'title' in data &&
          typeof (data as { title: unknown }).title === 'string'
          ? `Marked "${(data as { title: string }).title}" as completed.`
          : 'Task completed.';
      case 'reopenTask':
        return typeof data === 'object' &&
          data &&
          'title' in data &&
          typeof (data as { title: unknown }).title === 'string'
          ? `Reopened "${(data as { title: string }).title}".`
          : 'Task reopened.';
      case 'createSubtask':
        return typeof data === 'object' &&
          data &&
          'title' in data &&
          typeof (data as { title: unknown }).title === 'string'
          ? `Added subtask "${(data as { title: string }).title}".`
          : 'Subtask created.';
      case 'createReminder':
        return 'Reminder created.';
      case 'updateReminder':
        return 'Reminder updated.';
      case 'deleteReminder':
        return 'Reminder deleted.';
      default:
        return `Completed ${toolName}.`;
    }
  }

  private snapshotTask(
    task: Parameters<AiProductivityService['toTaskSnapshot']>[0],
    timeZone: string,
  ) {
    return this.productivityService.toTaskSnapshot(
      task,
      timeZone,
      formatYmd(new Date(), timeZone),
    );
  }

  private getTasksTool(): AiToolDefinition {
    return {
      name: 'getTasks',
      description:
        'List the current user tasks with optional filters such as view (TODAY, OVERDUE, UPCOMING), search, status, or priority. Returns structured task details including progress and category.',
      readOnly: true,
      destructive: false,
      requiresConfirmation: false,
      parametersJsonSchema: {
        type: 'object',
        properties: {
          view: {
            type: 'string',
            enum: ['ALL', 'TODAY', 'UPCOMING', 'OVERDUE', 'COMPLETED', 'ARCHIVED'],
          },
          search: { type: 'string' },
          status: {
            type: 'string',
            enum: ['TODO', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED'],
          },
          priority: {
            type: 'string',
            enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
          },
          categoryId: { type: 'string' },
          limit: { type: 'number' },
        },
      },
      execute: async (context, args) => {
        const connection = await this.tasksService.findAll(
          context.userId,
          {
            view: optionalEnum(args, 'view', Object.values(TaskListView)),
            search: optionalString(args, 'search'),
            status: optionalEnum(args, 'status', Object.values(TaskStatus)),
            priority: optionalEnum(args, 'priority', Object.values(TaskPriority)),
            categoryId: optionalString(args, 'categoryId'),
            page: 1,
            limit: Math.min(optionalNumber(args, 'limit') ?? 20, 50),
          },
          context.timeZone,
        );
        return {
          total: connection.pageInfo.total,
          items: connection.items.map((task) =>
            this.snapshotTask(task, context.timeZone),
          ),
        };
      },
    };
  }

  private getTaskTool(): AiToolDefinition {
    return {
      name: 'getTask',
      description:
        'Get one task by id for the current user, including progress, category, and recurrence.',
      readOnly: true,
      destructive: false,
      requiresConfirmation: false,
      parametersJsonSchema: {
        type: 'object',
        properties: { taskId: { type: 'string' } },
        required: ['taskId'],
      },
      execute: async (context, args) => {
        const task = await this.tasksService.findById(
          context.userId,
          requireString(args, 'taskId'),
        );
        return this.snapshotTask(task, context.timeZone);
      },
    };
  }

  private getCategoriesTool(): AiToolDefinition {
    return {
      name: 'getCategories',
      description: 'List all categories for the current user.',
      readOnly: true,
      destructive: false,
      requiresConfirmation: false,
      parametersJsonSchema: { type: 'object', properties: {} },
      execute: async (context) => {
        const categories = await this.categoriesService.findAll(context.userId);
        return categories.map((category) => ({
          id: category.id,
          name: category.name,
          icon: category.icon,
        }));
      },
    };
  }

  private getDashboardStatsTool(): AiToolDefinition {
    return {
      name: 'getDashboardStats',
      description:
        'Get today productivity stats: completion rate for tasks due today, open/in-progress/completed due today, overdue count, and tasks completed today by completion time. Use getProductivityInsights for weekly or category-level analysis.',
      readOnly: true,
      destructive: false,
      requiresConfirmation: false,
      parametersJsonSchema: { type: 'object', properties: {} },
      execute: async (context) =>
        this.dashboardService.getSummary(context.userId, context.timeZone),
    };
  }

  private getProductivityInsightsTool(): AiToolDefinition {
    return {
      name: 'getProductivityInsights',
      description:
        'Get productivity intelligence for today or this week, including dashboard metrics, category workload, carried-forward overdue tasks, and blocking work.',
      readOnly: true,
      destructive: false,
      requiresConfirmation: false,
      parametersJsonSchema: {
        type: 'object',
        properties: {
          period: { type: 'string', enum: ['today', 'week'] },
        },
      },
      execute: async (context, args) =>
        this.productivityService.getInsights(
          context.userId,
          context.timeZone,
          optionalEnum(args, 'period', ['today', 'week'] as const) ?? 'today',
        ),
    };
  }

  private planMyDayTool(): AiToolDefinition {
    return {
      name: 'planMyDay',
      description:
        'Build a deterministic prioritized plan for today using overdue work, high-priority due-today tasks, in-progress tasks, and upcoming high-priority items.',
      readOnly: true,
      destructive: false,
      requiresConfirmation: false,
      parametersJsonSchema: { type: 'object', properties: {} },
      execute: async (context) =>
        this.productivityService.planDay(context.userId, context.timeZone),
    };
  }

  private getRemindersTool(): AiToolDefinition {
    return {
      name: 'getReminders',
      description:
        'List reminders for a task. Provide taskId when known; otherwise returns reminders for upcoming tasks.',
      readOnly: true,
      destructive: false,
      requiresConfirmation: false,
      parametersJsonSchema: {
        type: 'object',
        properties: { taskId: { type: 'string' } },
      },
      execute: async (context, args) => {
        const taskId = optionalString(args, 'taskId');
        if (taskId) {
          const reminders = await this.remindersService.findByTask(
            context.userId,
            taskId,
          );
          return reminders.map((reminder) => ({
            id: reminder.id,
            taskId: reminder.taskId,
            fireAt: reminder.fireAt.toISOString(),
            channel: reminder.channel,
          }));
        }

        const tasks = await this.tasksService.findAll(
          context.userId,
          { view: TaskListView.UPCOMING, page: 1, limit: 10 },
          context.timeZone,
        );
        const reminders = await Promise.all(
          tasks.items.map(async (task) => {
            const taskReminders = await this.remindersService.findByTask(
              context.userId,
              task.id,
            );
            return taskReminders.map((reminder) => ({
              id: reminder.id,
              taskId: reminder.taskId,
              taskTitle: task.title,
              fireAt: reminder.fireAt.toISOString(),
              channel: reminder.channel,
            }));
          }),
        );
        return reminders.flat();
      },
    };
  }

  private createTaskTool(): AiToolDefinition {
    return {
      name: 'createTask',
      description:
        'Create one parent task for the current user. Supports priority, due date/time, category, recurrence, and initial subtasks. Use one call per explicit create request.',
      readOnly: false,
      destructive: false,
      requiresConfirmation: false,
      parametersJsonSchema: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          priority: {
            type: 'string',
            enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
          },
          dueDate: {
            type: 'string',
            description:
              'ISO datetime or YYYY-MM-DDTHH:mm in the user local timezone',
          },
          categoryId: { type: 'string' },
          recurrenceFrequency: {
            type: 'string',
            enum: [
              'DAILY',
              'WEEKDAYS',
              'WEEKLY',
              'BIWEEKLY',
              'MONTHLY',
              'YEARLY',
              'CUSTOM',
            ],
          },
          recurrenceInterval: { type: 'number' },
          subtaskTitles: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        required: ['title'],
      },
      execute: async (context, args) => {
        const dueDateRaw = optionalString(args, 'dueDate');
        const recurrenceFrequency = optionalEnum(
          args,
          'recurrenceFrequency',
          Object.values(RecurrenceFrequency),
        );
        const task = await this.tasksService.create(
          context.userId,
          {
            title: requireString(args, 'title'),
            description: optionalString(args, 'description'),
            priority: optionalEnum(args, 'priority', Object.values(TaskPriority)),
            dueDate: dueDateRaw ? new Date(dueDateRaw) : undefined,
            categoryId: optionalString(args, 'categoryId'),
            recurrence: recurrenceFrequency
              ? {
                  frequency: recurrenceFrequency,
                  interval: optionalNumber(args, 'recurrenceInterval') ?? 1,
                }
              : undefined,
            subtaskTitles: optionalStringArray(args, 'subtaskTitles'),
          },
          context.timeZone,
        );
        return this.snapshotTask(task, context.timeZone);
      },
    };
  }

  private updateTaskTool(): AiToolDefinition {
    return {
      name: 'updateTask',
      description: 'Update an existing task owned by the current user.',
      readOnly: false,
      destructive: false,
      requiresConfirmation: false,
      parametersJsonSchema: {
        type: 'object',
        properties: {
          taskId: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string' },
          status: {
            type: 'string',
            enum: ['TODO', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED'],
          },
          priority: {
            type: 'string',
            enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
          },
          dueDate: { type: 'string' },
          categoryId: { type: 'string' },
        },
        required: ['taskId'],
      },
      execute: async (context, args) => {
        const dueDateRaw = optionalString(args, 'dueDate');
        const task = await this.tasksService.update(
          context.userId,
          requireString(args, 'taskId'),
          {
            title: optionalString(args, 'title'),
            description: optionalString(args, 'description'),
            status: optionalEnum(args, 'status', Object.values(TaskStatus)),
            priority: optionalEnum(args, 'priority', Object.values(TaskPriority)),
            dueDate: dueDateRaw ? new Date(dueDateRaw) : undefined,
            categoryId: optionalString(args, 'categoryId'),
          },
        );
        return taskSummary(task);
      },
    };
  }

  private deleteTaskTool(): AiToolDefinition {
    return {
      name: 'deleteTask',
      description: 'Permanently delete a task owned by the current user.',
      readOnly: false,
      destructive: true,
      requiresConfirmation: true,
      parametersJsonSchema: {
        type: 'object',
        properties: { taskId: { type: 'string' } },
        required: ['taskId'],
      },
      execute: async (context, args) => {
        const taskId = requireString(args, 'taskId');
        const task = await this.tasksService.findById(context.userId, taskId);
        await this.tasksService.delete(context.userId, taskId);
        return { summary: `Deleted task "${task.title}".` };
      },
    };
  }

  private completeTaskTool(): AiToolDefinition {
    return {
      name: 'completeTask',
      description: 'Mark a task as completed.',
      readOnly: false,
      destructive: false,
      requiresConfirmation: false,
      parametersJsonSchema: {
        type: 'object',
        properties: { taskId: { type: 'string' } },
        required: ['taskId'],
      },
      execute: async (context, args) => {
        const task = await this.tasksService.complete(
          context.userId,
          requireString(args, 'taskId'),
          context.timeZone,
        );
        return this.snapshotTask(task, context.timeZone);
      },
    };
  }

  private reopenTaskTool(): AiToolDefinition {
    return {
      name: 'reopenTask',
      description: 'Reopen a completed task.',
      readOnly: false,
      destructive: false,
      requiresConfirmation: false,
      parametersJsonSchema: {
        type: 'object',
        properties: { taskId: { type: 'string' } },
        required: ['taskId'],
      },
      execute: async (context, args) => {
        const task = await this.tasksService.reopen(
          context.userId,
          requireString(args, 'taskId'),
        );
        return taskSummary(task);
      },
    };
  }

  private createSubtaskTool(): AiToolDefinition {
    return {
      name: 'createSubtask',
      description: 'Create a subtask on an owned task.',
      readOnly: false,
      destructive: false,
      requiresConfirmation: false,
      parametersJsonSchema: {
        type: 'object',
        properties: {
          taskId: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string' },
        },
        required: ['taskId', 'title'],
      },
      execute: async (context, args) => {
        const subtask = await this.subtasksService.create(context.userId, {
          taskId: requireString(args, 'taskId'),
          title: requireString(args, 'title'),
          description: optionalString(args, 'description'),
        });
        return {
          id: subtask.id,
          taskId: subtask.taskId,
          title: subtask.title,
          status: subtask.status,
        };
      },
    };
  }

  private createReminderTool(): AiToolDefinition {
    return {
      name: 'createReminder',
      description:
        'Create a reminder on an owned task. Use offsetMinutes for relative reminders before due time, or localDateTime (YYYY-MM-DDTHH:mm) for absolute reminders such as "tomorrow at 9 AM". Channel defaults to IN_APP.',
      readOnly: false,
      destructive: false,
      requiresConfirmation: false,
      parametersJsonSchema: {
        type: 'object',
        properties: {
          taskId: { type: 'string' },
          offsetMinutes: { type: 'number' },
          localDateTime: { type: 'string' },
          channel: { type: 'string', enum: ['IN_APP', 'PUSH', 'EMAIL'] },
        },
        required: ['taskId'],
      },
      execute: async (context, args) => {
        const reminder = await this.remindersService.create(
          context.userId,
          {
            taskId: requireString(args, 'taskId'),
            offsetMinutes: optionalNumber(args, 'offsetMinutes'),
            localDateTime: optionalString(args, 'localDateTime'),
            channel: optionalEnum(
              args,
              'channel',
              Object.values(ReminderChannel),
            ),
          },
          context.timeZone,
        );
        return {
          id: reminder.id,
          taskId: reminder.taskId,
          fireAt: reminder.fireAt.toISOString(),
          channel: reminder.channel,
        };
      },
    };
  }

  private updateReminderTool(): AiToolDefinition {
    return {
      name: 'updateReminder',
      description: 'Update an owned reminder.',
      readOnly: false,
      destructive: false,
      requiresConfirmation: false,
      parametersJsonSchema: {
        type: 'object',
        properties: {
          reminderId: { type: 'string' },
          offsetMinutes: { type: 'number' },
          localDateTime: { type: 'string' },
          channel: { type: 'string', enum: ['IN_APP', 'PUSH', 'EMAIL'] },
        },
        required: ['reminderId'],
      },
      execute: async (context, args) => {
        const reminder = await this.remindersService.update(
          context.userId,
          requireString(args, 'reminderId'),
          {
            offsetMinutes: optionalNumber(args, 'offsetMinutes'),
            localDateTime: optionalString(args, 'localDateTime'),
            channel: optionalEnum(
              args,
              'channel',
              Object.values(ReminderChannel),
            ),
          },
          context.timeZone,
        );
        return {
          id: reminder.id,
          taskId: reminder.taskId,
          fireAt: reminder.fireAt.toISOString(),
          channel: reminder.channel,
        };
      },
    };
  }

  private deleteReminderTool(): AiToolDefinition {
    return {
      name: 'deleteReminder',
      description: 'Permanently delete an owned reminder.',
      readOnly: false,
      destructive: true,
      requiresConfirmation: true,
      parametersJsonSchema: {
        type: 'object',
        properties: { reminderId: { type: 'string' } },
        required: ['reminderId'],
      },
      execute: async (context, args) => {
        await this.remindersService.delete(
          context.userId,
          requireString(args, 'reminderId'),
        );
        return { summary: 'Reminder deleted.' };
      },
    };
  }

  private getCalendarEventsTool(): AiToolDefinition {
    return {
      name: 'getCalendarEvents',
      description:
        'Fetch Google Calendar events for a date range. Requires from and to as ISO date strings (YYYY-MM-DD). Returns empty list if calendar not connected.',
      readOnly: true,
      destructive: false,
      requiresConfirmation: false,
      parametersJsonSchema: {
        type: 'object',
        properties: {
          from: { type: 'string', description: 'Start date ISO string' },
          to: { type: 'string', description: 'End date ISO string' },
        },
        required: ['from', 'to'],
      },
      execute: async (context, args) => {
        const from = requireString(args, 'from');
        const to = requireString(args, 'to');
        const events = await this.calendarEventService.getEvents(
          context.userId,
          from,
          to,
        );
        return {
          count: events.length,
          events: events.map((e) => ({
            id: e.id,
            title: e.title,
            startAt: e.startAt.toISOString(),
            endAt: e.endAt.toISOString(),
            isAllDay: e.isAllDay,
            status: e.status,
            location: e.location,
          })),
        };
      },
    };
  }

  private getTodayCalendarTool(): AiToolDefinition {
    return {
      name: 'getTodayCalendar',
      description:
        "Fetch today's Google Calendar events in the user's timezone. Returns empty list if calendar not connected.",
      readOnly: true,
      destructive: false,
      requiresConfirmation: false,
      parametersJsonSchema: {
        type: 'object',
        properties: {},
        required: [],
      },
      execute: async (context) => {
        const events = await this.calendarEventService.getTodayEvents(
          context.userId,
          context.timeZone,
        );
        return {
          count: events.length,
          events: events.map((e) => ({
            id: e.id,
            title: e.title,
            startAt: e.startAt.toISOString(),
            endAt: e.endAt.toISOString(),
            isAllDay: e.isAllDay,
            status: e.status,
          })),
        };
      },
    };
  }

  private getUpcomingCalendarTool(): AiToolDefinition {
    return {
      name: 'getUpcomingCalendar',
      description:
        'Fetch upcoming Google Calendar events in the next N hours (default 24, max 168). Returns empty list if calendar not connected.',
      readOnly: true,
      destructive: false,
      requiresConfirmation: false,
      parametersJsonSchema: {
        type: 'object',
        properties: {
          hours: {
            type: 'number',
            description: 'Number of hours ahead to look (1-168)',
          },
        },
        required: [],
      },
      execute: async (context, args) => {
        const hours = Math.min(
          168,
          Math.max(1, optionalNumber(args, 'hours') ?? 24),
        );
        const events = await this.calendarEventService.getUpcomingEvents(
          context.userId,
          hours,
        );
        return {
          count: events.length,
          hours,
          events: events.map((e) => ({
            id: e.id,
            title: e.title,
            startAt: e.startAt.toISOString(),
            endAt: e.endAt.toISOString(),
            isAllDay: e.isAllDay,
            status: e.status,
          })),
        };
      },
    };
  }

  private getWeeklyReviewTool(): AiToolDefinition {
    return {
      name: 'getWeeklyReview',
      description:
        "Get a weekly productivity review for the current week (Monday to Sunday in the user's timezone). Returns task completion stats, carry-forward count, high-priority breakdown, and calendar events count.",
      readOnly: true,
      destructive: false,
      requiresConfirmation: false,
      parametersJsonSchema: {
        type: 'object',
        properties: {},
        required: [],
      },
      execute: async (context) => {
        const review = await this.productivityService.getWeeklyReview(
          context.userId,
          context.timeZone,
        );
        return review;
      },
    };
  }
}
