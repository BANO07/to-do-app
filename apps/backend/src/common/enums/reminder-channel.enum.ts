import { registerEnumType } from '@nestjs/graphql';

export enum ReminderChannel {
  IN_APP = 'IN_APP',
  PUSH = 'PUSH',
  EMAIL = 'EMAIL',
}

registerEnumType(ReminderChannel, { name: 'ReminderChannel' });
