import { registerEnumType } from '@nestjs/graphql';

export enum TaskListView {
  ALL = 'ALL',
  TODAY = 'TODAY',
  UPCOMING = 'UPCOMING',
  OVERDUE = 'OVERDUE',
  COMPLETED = 'COMPLETED',
  ARCHIVED = 'ARCHIVED',
}

registerEnumType(TaskListView, { name: 'TaskListView' });
