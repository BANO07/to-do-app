import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GqlAuthGuard } from '../../../common/guards/gql-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { User } from '../../users/entities/user.entity';
import { AiAttachment } from '../entities/ai-attachment.entity';
import { AiAttachmentService } from './ai-attachment.service';
import {
  DeleteAiAttachmentInput,
  UploadAiAttachmentInput,
} from './ai-attachment.dto';

@Resolver()
@UseGuards(GqlAuthGuard)
export class AiAttachmentResolver {
  constructor(private readonly attachmentService: AiAttachmentService) {}

  @Query(() => [AiAttachment], { name: 'aiConversationAttachments' })
  aiConversationAttachments(
    @CurrentUser() user: User,
    @Args('conversationId', { type: () => ID }) conversationId: string,
  ): Promise<AiAttachment[]> {
    return this.attachmentService.listAttachments(user.id, conversationId);
  }

  @Mutation(() => AiAttachment, { name: 'uploadAiAttachment' })
  uploadAiAttachment(
    @CurrentUser() user: User,
    @Args('input') input: UploadAiAttachmentInput,
  ): Promise<AiAttachment> {
    return this.attachmentService.uploadAttachment(
      user.id,
      input.conversationId,
      input.filename,
      input.mimeType,
      input.base64Data,
    );
  }

  @Mutation(() => Boolean, { name: 'deleteAiAttachment' })
  deleteAiAttachment(
    @CurrentUser() user: User,
    @Args('input') input: DeleteAiAttachmentInput,
  ): Promise<boolean> {
    return this.attachmentService.deleteAttachment(user.id, input.id);
  }
}
