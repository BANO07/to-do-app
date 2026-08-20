import { registerEnumType } from '@nestjs/graphql';

export enum AiAttachmentStatus {
  UPLOADING = 'UPLOADING',
  READY = 'READY',
  FAILED = 'FAILED',
  DELETED = 'DELETED',
}

registerEnumType(AiAttachmentStatus, {
  name: 'AiAttachmentStatus',
  description: 'Lifecycle status of an AI conversation attachment',
});
