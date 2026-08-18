import { registerEnumType } from '@nestjs/graphql';

export enum RecurrenceFrequency {
  DAILY = 'DAILY',
  WEEKDAYS = 'WEEKDAYS',
  WEEKLY = 'WEEKLY',
  BIWEEKLY = 'BIWEEKLY',
  MONTHLY = 'MONTHLY',
  YEARLY = 'YEARLY',
  CUSTOM = 'CUSTOM',
}

registerEnumType(RecurrenceFrequency, { name: 'RecurrenceFrequency' });
