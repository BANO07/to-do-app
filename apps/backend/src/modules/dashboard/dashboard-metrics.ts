import { TaskStatus } from '../../common/enums/task-status.enum';

/** OPEN in the UI. Counted in the completion-rate denominator only. */
export const DUE_TODAY_OPEN_STATUSES: TaskStatus[] = [TaskStatus.TODO];

/** Counted in the completion-rate denominator only. Never treated as completed. */
export const DUE_TODAY_IN_PROGRESS_STATUSES: TaskStatus[] = [
  TaskStatus.IN_PROGRESS,
];

/** Counted in both the completion-rate numerator and denominator. */
export const DUE_TODAY_COMPLETED_STATUSES: TaskStatus[] = [
  TaskStatus.COMPLETED,
];

export const COMPLETION_RATE_DENOMINATOR_STATUSES: TaskStatus[] = [
  TaskStatus.TODO,
  TaskStatus.IN_PROGRESS,
  TaskStatus.COMPLETED,
];

/**
 * Completion rate = completedDueToday / totalActiveDueToday × 100.
 * totalActiveDueToday = OPEN + IN_PROGRESS + COMPLETED due today.
 * ARCHIVED is excluded by omitting it from the status lists.
 * Returns 0 when the denominator is 0 (API placeholder; UI shows "—").
 */
export function computeCompletionPercentage(
  completedDueToday: number,
  totalActiveDueToday: number,
): number {
  if (totalActiveDueToday <= 0) {
    return 0;
  }
  return Math.round((completedDueToday / totalActiveDueToday) * 100);
}
