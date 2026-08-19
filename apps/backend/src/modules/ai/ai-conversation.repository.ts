import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiConversation } from './entities/ai-conversation.entity';
import { AiMessage } from './entities/ai-message.entity';
import { AiMessageRole } from '../../common/enums/ai-message-role.enum';

export interface CreateAiMessageInput {
  conversationId: string;
  userId: string;
  role: AiMessageRole;
  content: string;
  toolName?: string;
  toolCallId?: string;
  toolStatus?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AiConversationRepository {
  constructor(
    @InjectRepository(AiConversation)
    private readonly conversationRepo: Repository<AiConversation>,
    @InjectRepository(AiMessage)
    private readonly messageRepo: Repository<AiMessage>,
  ) {}

  createConversation(userId: string, title?: string): Promise<AiConversation> {
    const conversation = this.conversationRepo.create({
      userId,
      title: title ?? null,
    });
    return this.conversationRepo.save(conversation);
  }

  findConversationForUser(
    id: string,
    userId: string,
  ): Promise<AiConversation | null> {
    return this.conversationRepo.findOne({ where: { id, userId } });
  }

  listConversationsForUser(userId: string): Promise<AiConversation[]> {
    return this.conversationRepo.find({
      where: { userId },
      order: { updatedAt: 'DESC' },
    });
  }

  async touchConversation(id: string, userId: string): Promise<void> {
    await this.conversationRepo.update({ id, userId }, { updatedAt: new Date() });
  }

  async updateTitle(
    id: string,
    userId: string,
    title: string,
  ): Promise<AiConversation> {
    const conversation = await this.findConversationForUser(id, userId);
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }
    conversation.title = title;
    return this.conversationRepo.save(conversation);
  }

  async deleteConversation(id: string, userId: string): Promise<boolean> {
    const result = await this.conversationRepo.delete({ id, userId });
    return (result.affected ?? 0) > 0;
  }

  async clearConversationMessages(
    conversationId: string,
    userId: string,
  ): Promise<void> {
    await this.messageRepo.delete({ conversationId, userId });
  }

  createMessage(input: CreateAiMessageInput): Promise<AiMessage> {
    const message = this.messageRepo.create({
      conversationId: input.conversationId,
      userId: input.userId,
      role: input.role,
      content: input.content,
      toolName: input.toolName ?? null,
      toolCallId: input.toolCallId ?? null,
      toolStatus: input.toolStatus ?? null,
      metadata: input.metadata ?? null,
    });
    return this.messageRepo.save(message);
  }

  findMessagesForConversation(
    conversationId: string,
    userId: string,
    limit = 50,
  ): Promise<AiMessage[]> {
    return this.messageRepo.find({
      where: { conversationId, userId },
      order: { createdAt: 'ASC' },
      take: limit,
    });
  }

  findRecentMessagesForContext(
    conversationId: string,
    userId: string,
    limit = 30,
  ): Promise<AiMessage[]> {
    return this.messageRepo
      .createQueryBuilder('message')
      .where('message.conversation_id = :conversationId', { conversationId })
      .andWhere('message.user_id = :userId', { userId })
      .orderBy('message.created_at', 'DESC')
      .take(limit)
      .getMany()
      .then((messages) => messages.reverse());
  }
}
