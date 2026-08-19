import {
  Args,
  ID,
  Int,
  Mutation,
  Query,
  Resolver,
} from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { AIService } from './ai.service';
import { AiUsageStatus } from './dto/ai-usage.dto';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { AIConversationService } from './ai-conversation.service';
import { AiChatService } from './ai-chat.service';
import { AiConversation } from './entities/ai-conversation.entity';
import { AiMessage } from './entities/ai-message.entity';
import {
  AiChatInput,
  AiChatResponse,
  AiConfirmActionResponse,
  AiMessagesPage,
  ConfirmAiActionInput,
} from './dto/ai-chat.dto';

@Resolver()
@UseGuards(GqlAuthGuard)
export class AiResolver {
  constructor(
    private readonly aiService: AIService,
    private readonly conversationService: AIConversationService,
    private readonly chatService: AiChatService,
  ) {}

  @Query(() => AiUsageStatus, { name: 'aiUsage' })
  async aiUsage(@CurrentUser() user: User): Promise<AiUsageStatus> {
    const usage = await this.aiService.getUsage(user.id);

    return {
      ...usage,
      providerConfigured: this.aiService.isProviderConfigured(),
    };
  }

  @Query(() => [AiConversation], { name: 'aiConversations' })
  aiConversations(@CurrentUser() user: User): Promise<AiConversation[]> {
    return this.conversationService.listConversations(user.id);
  }

  @Query(() => AiConversation, { name: 'aiConversation' })
  aiConversation(
    @CurrentUser() user: User,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<AiConversation> {
    return this.conversationService.getConversationForUser(id, user.id);
  }

  @Query(() => AiMessagesPage, { name: 'aiMessages' })
  async aiMessages(
    @CurrentUser() user: User,
    @Args('conversationId', { type: () => ID }) conversationId: string,
    @Args('limit', { type: () => Int, nullable: true, defaultValue: 50 })
    limit?: number,
  ): Promise<AiMessagesPage> {
    const boundedLimit = Math.min(Math.max(limit ?? 50, 1), 100);
    const items = await this.conversationService.getMessagesForConversation(
      conversationId,
      user.id,
      boundedLimit,
    );
    return { items, limit: boundedLimit };
  }

  @Mutation(() => AiConversation, { name: 'createAiConversation' })
  createAiConversation(@CurrentUser() user: User): Promise<AiConversation> {
    return this.conversationService.createConversation(user.id);
  }

  @Mutation(() => AiChatResponse, { name: 'aiChat' })
  aiChat(
    @CurrentUser() user: User,
    @Args('input') input: AiChatInput,
  ): Promise<AiChatResponse> {
    return this.chatService.chat(
      user.id,
      input.conversationId,
      input.message,
      user.ianaTimezone ?? 'UTC',
    );
  }

  @Mutation(() => AiConfirmActionResponse, { name: 'confirmAiAction' })
  confirmAiAction(
    @CurrentUser() user: User,
    @Args('input') input: ConfirmAiActionInput,
  ): Promise<AiConfirmActionResponse> {
    return this.chatService.confirmAction(
      user.id,
      input.confirmationId,
      user.ianaTimezone ?? 'UTC',
    );
  }

  @Mutation(() => Boolean, { name: 'deleteAiConversation' })
  async deleteAiConversation(
    @CurrentUser() user: User,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    return this.conversationService.deleteConversation(id, user.id);
  }

  @Mutation(() => AiConversation, { name: 'clearAiConversation' })
  clearAiConversation(
    @CurrentUser() user: User,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<AiConversation> {
    return this.conversationService.clearConversation(id, user.id);
  }
}
