import { Injectable, NotFoundException } from '@nestjs/common';
import { AiConversationRepository } from './ai-conversation.repository';
import { AiConversation } from './entities/ai-conversation.entity';
import { AiMessage } from './entities/ai-message.entity';
import { AiMessageRole } from '../../common/enums/ai-message-role.enum';
import { CreateAiMessageInput } from './ai-conversation.repository';

const TITLE_MAX_LENGTH = 50;

@Injectable()
export class AIConversationService {
  constructor(
    private readonly conversationRepository: AiConversationRepository,
  ) {}

  createConversation(userId: string, title?: string): Promise<AiConversation> {
    return this.conversationRepository.createConversation(userId, title);
  }

  listConversations(userId: string): Promise<AiConversation[]> {
    return this.conversationRepository.listConversationsForUser(userId);
  }

  async getConversationForUser(
    id: string,
    userId: string,
  ): Promise<AiConversation> {
    const conversation = await this.conversationRepository.findConversationForUser(
      id,
      userId,
    );
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }
    return conversation;
  }

  getMessagesForConversation(
    conversationId: string,
    userId: string,
    limit?: number,
  ): Promise<AiMessage[]> {
    return this.conversationRepository.findMessagesForConversation(
      conversationId,
      userId,
      limit,
    );
  }

  getRecentMessagesForContext(
    conversationId: string,
    userId: string,
  ): Promise<AiMessage[]> {
    return this.conversationRepository.findRecentMessagesForContext(
      conversationId,
      userId,
    );
  }

  async addMessage(input: CreateAiMessageInput): Promise<AiMessage> {
    await this.getConversationForUser(input.conversationId, input.userId);
    const message = await this.conversationRepository.createMessage(input);
    await this.conversationRepository.touchConversation(
      input.conversationId,
      input.userId,
    );
    return message;
  }

  async ensureConversationTitleFromFirstMessage(
    conversationId: string,
    userId: string,
    firstMessage: string,
  ): Promise<void> {
    const conversation = await this.getConversationForUser(
      conversationId,
      userId,
    );
    if (conversation.title) {
      return;
    }
    await this.conversationRepository.updateTitle(
      conversationId,
      userId,
      deriveConversationTitle(firstMessage),
    );
  }

  async deleteConversation(id: string, userId: string): Promise<boolean> {
    await this.getConversationForUser(id, userId);
    return this.conversationRepository.deleteConversation(id, userId);
  }

  async clearConversation(id: string, userId: string): Promise<AiConversation> {
    await this.getConversationForUser(id, userId);
    await this.conversationRepository.clearConversationMessages(id, userId);
    return this.getConversationForUser(id, userId);
  }
}

export function deriveConversationTitle(message: string): string {
  const cleaned = message.replace(/\s+/g, ' ').trim();
  if (!cleaned) {
    return 'New conversation';
  }
  const shortened =
    cleaned.length > TITLE_MAX_LENGTH
      ? `${cleaned.slice(0, TITLE_MAX_LENGTH - 3)}...`
      : cleaned;
  return shortened.charAt(0).toUpperCase() + shortened.slice(1);
}
