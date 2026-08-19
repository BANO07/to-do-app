import { registerEnumType } from '@nestjs/graphql';

export enum AiMessageRole {
  USER = 'USER',
  ASSISTANT = 'ASSISTANT',
  TOOL = 'TOOL',
}

registerEnumType(AiMessageRole, { name: 'AiMessageRole' });
