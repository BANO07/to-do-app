import { registerEnumType } from '@nestjs/graphql';

export enum SubtaskStatus {
  TODO = 'TODO',
  COMPLETED = 'COMPLETED',
}

registerEnumType(SubtaskStatus, { name: 'SubtaskStatus' });
