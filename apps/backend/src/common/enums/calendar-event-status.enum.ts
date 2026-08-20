import { registerEnumType } from '@nestjs/graphql';

export enum CalendarEventStatus {
  CONFIRMED = 'CONFIRMED',
  TENTATIVE = 'TENTATIVE',
  CANCELLED = 'CANCELLED',
}

registerEnumType(CalendarEventStatus, {
  name: 'CalendarEventStatus',
  description: 'Status of a calendar event',
});
