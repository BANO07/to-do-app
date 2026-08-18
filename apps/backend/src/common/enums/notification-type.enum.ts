import { registerEnumType } from '@nestjs/graphql';

export enum NotificationType {
  REMINDER = 'REMINDER',
}

registerEnumType(NotificationType, { name: 'NotificationType' });
