import { registerEnumType } from '@nestjs/graphql';

export enum TaskPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

registerEnumType(TaskPriority, { name: 'TaskPriority' });
