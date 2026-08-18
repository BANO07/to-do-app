import { TaskStatus } from '../models/app.models';

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: 'Open',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  ARCHIVED: 'Archived',
};

export const WORKFLOW_STATUSES: TaskStatus[] = [
  'TODO',
  'IN_PROGRESS',
  'COMPLETED',
];

export function statusLabel(status: TaskStatus): string {
  return TASK_STATUS_LABELS[status] ?? status;
}
