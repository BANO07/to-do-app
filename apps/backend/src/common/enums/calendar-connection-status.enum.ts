import { registerEnumType } from '@nestjs/graphql';

export enum CalendarConnectionStatus {
  ACTIVE = 'ACTIVE',
  REVOKED = 'REVOKED',
  EXPIRED = 'EXPIRED',
}

registerEnumType(CalendarConnectionStatus, {
  name: 'CalendarConnectionStatus',
  description: 'Status of a Google Calendar OAuth connection',
});
