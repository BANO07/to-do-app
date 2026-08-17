import { registerEnumType } from '@nestjs/graphql';

export enum TaskSortField {
  CREATED_AT = 'CREATED_AT',
  UPDATED_AT = 'UPDATED_AT',
  DUE_DATE = 'DUE_DATE',
  PRIORITY = 'PRIORITY',
}

registerEnumType(TaskSortField, { name: 'TaskSortField' });
