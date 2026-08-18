import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import {
  Category,
  RecurrenceFrequency,
  RecurrenceInput,
  RECURRENCE_LABELS,
  Reminder,
  ReminderChannel,
  ReminderDraft,
  Task,
  TaskFormSubmit,
  TaskPriority,
} from '../../../core/models/app.models';
import { AuthService } from '../../../core/services/auth.service';
import { ReminderService } from '../../../core/services/reminder.service';
import { ToastService } from '../../../core/services/toast.service';
import {
  toZonedDatetimeLocal,
  zonedDatetimeLocalToIso,
} from '../../../core/utils/date-time';

const OFFSET_OPTIONS = [
  { label: '5 min before', minutes: 5 },
  { label: '15 min before', minutes: 15 },
  { label: '30 min before', minutes: 30 },
  { label: '1 hour before', minutes: 60 },
  { label: '1 day before', minutes: 1440 },
];

const WEEKDAYS = [
  { label: 'Sun', value: 0 },
  { label: 'Mon', value: 1 },
  { label: 'Tue', value: 2 },
  { label: 'Wed', value: 3 },
  { label: 'Thu', value: 4 },
  { label: 'Fri', value: 5 },
  { label: 'Sat', value: 6 },
];

@Component({
  selector: 'app-task-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <form class="task-form" [formGroup]="form" (ngSubmit)="submit()">
      <div class="field">
        <label for="title">Title</label>
        <input id="title" type="text" formControlName="title" placeholder="What needs to be done?" autofocus />
      </div>

      <div class="field">
        <label for="description">Description</label>
        <textarea id="description" rows="3" formControlName="description" placeholder="Add details (optional)"></textarea>
      </div>

      <div class="grid">
        <div class="field">
          <label for="priority">Priority</label>
          <select id="priority" formControlName="priority">
            @for (option of priorities; track option) {
              <option [value]="option">{{ option }}</option>
            }
          </select>
        </div>

        <div class="field">
          <label for="categoryId">Category</label>
          <select id="categoryId" formControlName="categoryId">
            <option value="">No category</option>
            @for (category of categories; track category.id) {
              <option [value]="category.id">{{ category.icon }} {{ category.name }}</option>
            }
          </select>
        </div>

        <div class="field">
          <label for="dueDate">Due date</label>
          <input id="dueDate" type="datetime-local" formControlName="dueDate" />
        </div>
      </div>

      <div class="field">
        <label for="repeat">Repeat</label>
        <select id="repeat" formControlName="repeat">
          <option value="NEVER">Never</option>
          @for (option of frequencies; track option) {
            <option [value]="option">{{ labels[option] }}</option>
          }
        </select>
      </div>

      @if (form.value.repeat === 'CUSTOM') {
        <div class="field">
          <span class="label">Days of week</span>
          <div class="days">
            @for (day of weekdays; track day.value) {
              <label class="day">
                <input
                  type="checkbox"
                  [checked]="selectedDays.has(day.value)"
                  (change)="toggleDay(day.value)"
                />
                {{ day.label }}
              </label>
            }
          </div>
          <label for="interval">Every n weeks</label>
          <input id="interval" type="number" min="1" max="12" formControlName="interval" />
        </div>
      }

      @if (form.value.repeat && form.value.repeat !== 'NEVER') {
        <div class="field">
          <label for="endDate">Ends on (optional)</label>
          <input id="endDate" type="date" formControlName="endDate" />
        </div>
        @if (mode === 'edit' && task?.recurrence?.isActive) {
          <label class="stop">
            <input type="checkbox" formControlName="stopRecurrence" />
            Stop repeating
          </label>
        }
      }

      <div class="field">
        <span class="label">Reminders</span>
        <p class="hint">
          Reminders are delivered through the selected channel using your notification preferences.
        </p>
        <label class="sublabel" for="reminderChannel">Delivery channel</label>
        <select id="reminderChannel" formControlName="reminderChannel">
          <option value="IN_APP">In-app</option>
          <option value="EMAIL">Email</option>
          <option value="PUSH">Push</option>
        </select>
        <span class="sublabel">Preset options</span>
        <div class="chips">
          @for (option of offsetOptions; track option.minutes) {
            <button
              type="button"
              class="chip"
              [class.chip--active]="isOffsetActive(option.minutes)"
              [disabled]="!form.value.dueDate"
              (click)="toggleOffset(option.minutes)"
            >
              🔔 {{ option.label }}
            </button>
          }
        </div>
        <span class="sublabel">Custom</span>
        <div class="custom-reminder">
          <input type="date" formControlName="customReminderDate" aria-label="Custom reminder date" />
          <input type="time" formControlName="customReminderTime" aria-label="Custom reminder time" />
          <button
            type="button"
            class="btn btn--ghost"
            (click)="addCustomReminder()"
            [disabled]="!form.value.customReminderDate || !form.value.customReminderTime"
          >
            Add reminder
          </button>
        </div>
        @if (existingReminders.length > 0 || customDrafts.length > 0 || pendingOffsets.size > 0) {
          <ul class="reminder-list">
            @for (minutes of pendingOffsetList; track minutes) {
              <li>
                <span>🔔 {{ offsetLabel(minutes) }} · {{ channelLabel(selectedChannel) }}</span>
                <button type="button" class="btn-icon" (click)="toggleOffset(minutes)" aria-label="Remove reminder">
                  ✕
                </button>
              </li>
            }
            @for (reminder of existingReminders; track reminder.id) {
              <li>
                <span>{{ reminderLabel(reminder) }}</span>
                <button type="button" class="btn-icon" (click)="removeExistingReminder(reminder.id)" aria-label="Delete reminder">
                  ✕
                </button>
              </li>
            }
            @for (draft of customDrafts; track draft.localDateTime) {
              <li>
                <span>🔔 {{ draft.localDateTime?.replace('T', ' ') }} · {{ channelLabel(draft.channel) }}</span>
                <button type="button" class="btn-icon" (click)="removeCustomDraft(draft.localDateTime!)" aria-label="Remove custom reminder">
                  ✕
                </button>
              </li>
            }
          </ul>
        }
      </div>

      <div class="field">
        <span class="label">Subtasks</span>
        <p class="hint">Add checklist items to create with this task.</p>
        <ul class="subtask-drafts">
          @for (title of subtaskDrafts; track $index) {
            <li>
              <span>{{ title }}</span>
              <button type="button" class="btn-icon" (click)="removeSubtaskDraft($index)" aria-label="Remove subtask">
                ✕
              </button>
            </li>
          }
        </ul>
        <div class="subtask-add">
          <input
            type="text"
            formControlName="subtaskTitle"
            placeholder="Add a subtask"
            maxlength="255"
            (keydown.enter)="addSubtaskDraft($event)"
          />
          <button type="button" class="btn btn--ghost" (click)="addSubtaskDraft()">+ Add subtask</button>
        </div>
      </div>

      <div class="actions">
        @if (mode === 'edit') {
          <button type="button" class="btn btn--ghost" (click)="cancelled.emit()">Cancel</button>
        }
        <button type="submit" class="btn btn--primary" [disabled]="form.invalid || submitting">
          {{ mode === 'edit' ? 'Save changes' : 'Add task' }}
        </button>
      </div>
    </form>
  `,
  styles: [
    `
      .task-form {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }
      .field {
        display: flex;
        flex-direction: column;
        gap: 0.375rem;
      }
      label, .label {
        font-size: 0.875rem;
        font-weight: 600;
        color: var(--text-primary);
      }
      .hint {
        margin: 0;
        font-size: 0.75rem;
        color: var(--text-muted);
      }
      .sublabel {
        font-size: 0.75rem;
        font-weight: 600;
        color: var(--text-muted);
      }
      input, textarea, select {
        width: 100%;
        border: 1px solid var(--border);
        border-radius: 10px;
        padding: 0.75rem 0.875rem;
        font: inherit;
        background: var(--input-bg);
        color: var(--text-primary);
      }
      input:focus, textarea:focus, select:focus {
        outline: 2px solid var(--primary-soft);
        border-color: var(--primary);
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 0.75rem;
      }
      .days {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
      }
      .day {
        display: flex;
        gap: 0.25rem;
        align-items: center;
        font-weight: 500;
      }
      .stop {
        display: flex;
        gap: 0.5rem;
        align-items: center;
        font-weight: 500;
      }
      .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
      }
      .chip {
        border: 1px solid var(--border);
        background: var(--surface-muted);
        color: var(--text-muted);
        border-radius: 999px;
        padding: 0.35rem 0.7rem;
        cursor: pointer;
        font: inherit;
        font-size: 0.8125rem;
      }
      .chip--active {
        border-color: var(--primary);
        color: var(--primary);
        background: color-mix(in srgb, var(--primary) 12%, transparent);
      }
      .custom-reminder {
        display: grid;
        grid-template-columns: minmax(0, 1.2fr) minmax(0, 0.8fr) auto;
        gap: 0.5rem;
        align-items: center;
      }
      .reminder-list,
      .subtask-drafts {
        list-style: none;
        margin: 0.25rem 0 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
      }
      .reminder-list li,
      .subtask-drafts li {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.8125rem;
        color: var(--text-muted);
        background: var(--surface-muted);
        border-radius: 8px;
        padding: 0.35rem 0.6rem;
      }
      .subtask-add {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 0.5rem;
        align-items: center;
      }
      .btn-icon {
        border: none;
        background: transparent;
        cursor: pointer;
      }
      .actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.75rem;
      }
      @media (max-width: 768px) {
        .grid, .custom-reminder, .subtask-add {
          grid-template-columns: 1fr;
          flex-direction: column;
        }
      }
    `,
  ],
})
export class TaskFormComponent implements OnChanges {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly reminderService = inject(ReminderService);
  private readonly toastService = inject(ToastService);

  @Input() categories: Category[] = [];
  @Input() mode: 'create' | 'edit' = 'create';
  @Input() task: Task | null = null;
  @Input() submitting = false;
  @Output() saved = new EventEmitter<TaskFormSubmit>();
  @Output() cancelled = new EventEmitter<void>();

  readonly priorities: TaskPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
  readonly frequencies: RecurrenceFrequency[] = [
    'DAILY',
    'WEEKDAYS',
    'WEEKLY',
    'BIWEEKLY',
    'MONTHLY',
    'YEARLY',
    'CUSTOM',
  ];
  readonly labels = RECURRENCE_LABELS;
  readonly offsetOptions = OFFSET_OPTIONS;
  readonly weekdays = WEEKDAYS;

  pendingOffsets = new Set<number>();
  selectedDays = new Set<number>([1, 2, 3, 4, 5]);
  existingReminders: Reminder[] = [];
  deleteReminderIds: string[] = [];
  customDrafts: ReminderDraft[] = [];
  subtaskDrafts: string[] = [];

  readonly form = this.fb.group({
    title: ['', [Validators.required, Validators.maxLength(255)]],
    description: [''],
    priority: ['MEDIUM' as TaskPriority],
    categoryId: [''],
    dueDate: [''],
    repeat: ['NEVER'],
    interval: [1],
    endDate: [''],
    stopRecurrence: [false],
    reminderChannel: ['IN_APP' as ReminderChannel],
    customReminderDate: [''],
    customReminderTime: [''],
    subtaskTitle: [''],
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['task'] && this.task && this.mode === 'edit') {
      const timezone = this.timezone;
      this.form.patchValue({
        title: this.task.title,
        description: this.task.description ?? '',
        priority: this.task.priority,
        categoryId: this.task.category?.id ?? '',
        dueDate: this.task.dueDate
          ? toZonedDatetimeLocal(this.task.dueDate, timezone)
          : '',
        repeat: this.task.recurrence?.isActive
          ? this.task.recurrence.frequency
          : 'NEVER',
        interval: this.task.recurrence?.interval ?? 1,
        endDate: this.task.recurrence?.endDate ?? '',
        stopRecurrence: false,
        reminderChannel: 'IN_APP',
        customReminderDate: '',
        customReminderTime: '',
        subtaskTitle: '',
      });
      this.selectedDays = new Set(this.task.recurrence?.daysOfWeek ?? [1, 2, 3, 4, 5]);
      this.pendingOffsets = new Set();
      this.customDrafts = [];
      this.deleteReminderIds = [];
      this.subtaskDrafts = [];
      this.loadReminders();
    }
  }

  toggleOffset(minutes: number): void {
    const existing = this.existingReminders.find(
      (item) => item.offsetMinutes === minutes,
    );
    if (existing) {
      this.removeExistingReminder(existing.id);
      return;
    }
    if (this.pendingOffsets.has(minutes)) {
      this.pendingOffsets.delete(minutes);
    } else {
      this.pendingOffsets.add(minutes);
    }
    this.pendingOffsets = new Set(this.pendingOffsets);
  }

  isOffsetActive(minutes: number): boolean {
    return (
      this.pendingOffsets.has(minutes) ||
      this.existingReminders.some((item) => item.offsetMinutes === minutes)
    );
  }

  toggleDay(day: number): void {
    if (this.selectedDays.has(day)) {
      this.selectedDays.delete(day);
    } else {
      this.selectedDays.add(day);
    }
    this.selectedDays = new Set(this.selectedDays);
  }

  addCustomReminder(): void {
    const date = this.form.value.customReminderDate;
    const time = this.form.value.customReminderTime;
    if (!date || !time) {
      return;
    }
    const localDateTime = `${date}T${time}`;
    this.customDrafts = [
      ...this.customDrafts,
      { localDateTime, channel: this.selectedChannel },
    ];
    this.form.patchValue({ customReminderDate: '', customReminderTime: '' });
  }

  removeCustomDraft(localDateTime: string): void {
    this.customDrafts = this.customDrafts.filter(
      (draft) => draft.localDateTime !== localDateTime,
    );
  }

  removeExistingReminder(id: string): void {
    this.deleteReminderIds = [...this.deleteReminderIds, id];
    this.existingReminders = this.existingReminders.filter((item) => item.id !== id);
  }

  reminderLabel(reminder: Reminder): string {
    const channel = this.channelLabel(reminder.channel);
    if (reminder.offsetMinutes) {
      return `🔔 ${this.offsetLabel(reminder.offsetMinutes)} · ${channel}`;
    }
    return `🔔 ${toZonedDatetimeLocal(reminder.fireAt, this.timezone).replace('T', ' ')} · ${channel}`;
  }

  offsetLabel(minutes: number): string {
    const option = OFFSET_OPTIONS.find((item) => item.minutes === minutes);
    return option?.label ?? `${minutes} min before`;
  }

  channelLabel(channel?: ReminderChannel | null): string {
    switch (channel) {
      case 'EMAIL':
        return 'Email';
      case 'PUSH':
        return 'Push';
      default:
        return 'In-app';
    }
  }

  get selectedChannel(): ReminderChannel {
    return (this.form.value.reminderChannel as ReminderChannel) || 'IN_APP';
  }

  get pendingOffsetList(): number[] {
    return [...this.pendingOffsets];
  }

  addSubtaskDraft(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    const title = this.form.value.subtaskTitle?.trim();
    if (!title) {
      return;
    }
    this.subtaskDrafts = [...this.subtaskDrafts, title];
    this.form.patchValue({ subtaskTitle: '' });
  }

  removeSubtaskDraft(index: number): void {
    this.subtaskDrafts = this.subtaskDrafts.filter((_, i) => i !== index);
  }

  submit(): void {
    if (this.form.invalid || this.submitting) {
      return;
    }

    const value = this.form.getRawValue();
    const dueDate = value.dueDate
      ? zonedDatetimeLocalToIso(value.dueDate, this.timezone)
      : undefined;
    const recurrence = this.buildRecurrence();
    const stopRecurrence = Boolean(
      value.stopRecurrence ||
        (this.mode === 'edit' &&
          value.repeat === 'NEVER' &&
          this.task?.recurrence?.isActive),
    );
    const input = {
      title: value.title!.trim(),
      description: value.description?.trim() || undefined,
      priority: value.priority as TaskPriority,
      categoryId: value.categoryId || undefined,
      dueDate,
      ...(recurrence ? { recurrence } : {}),
      ...(stopRecurrence ? { stopRecurrence: true } : {}),
    };

    const reminderDrafts: ReminderDraft[] = [
      ...[...this.pendingOffsets].map((offsetMinutes) => ({
        offsetMinutes,
        channel: this.selectedChannel,
      })),
      ...this.customDrafts,
    ];

    this.saved.emit({
      input: {
        ...input,
        ...(this.mode === 'create' && this.subtaskDrafts.length > 0
          ? { subtaskTitles: this.subtaskDrafts }
          : {}),
      },
      reminderDrafts,
      deleteReminderIds: this.deleteReminderIds,
      subtaskTitles: this.subtaskDrafts,
    });
  }

  private buildRecurrence(): RecurrenceInput | undefined {
    const value = this.form.getRawValue();
    if (value.stopRecurrence || value.repeat === 'NEVER' || !value.repeat) {
      return undefined;
    }
    const frequency = value.repeat as RecurrenceFrequency;
    return {
      frequency,
      interval: Number(value.interval) || 1,
      daysOfWeek:
        frequency === 'CUSTOM' ? [...this.selectedDays].sort((a, b) => a - b) : undefined,
      endDate: value.endDate || undefined,
    };
  }

  private loadReminders(): void {
    if (!this.task) {
      return;
    }
    this.reminderService.getReminders(this.task.id).subscribe({
      next: (reminders) => {
        this.existingReminders = reminders;
      },
      error: () => this.toastService.error('Unable to load reminders.'),
    });
  }

  private get timezone(): string {
    return this.authService.currentUser?.ianaTimezone || 'UTC';
  }
}
