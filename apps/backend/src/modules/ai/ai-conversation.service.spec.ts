import { NotFoundException } from '@nestjs/common';
import { AIConversationService, deriveConversationTitle } from './ai-conversation.service';
import { AiConversationRepository } from './ai-conversation.repository';
import { AiMessageRole } from '../../common/enums/ai-message-role.enum';

describe('deriveConversationTitle', () => {
  it('capitalizes and truncates long first messages', () => {
    const long = 'a'.repeat(60);
    expect(deriveConversationTitle(long).length).toBeLessThanOrEqual(50);
    expect(deriveConversationTitle("what's overdue?")).toBe("What's overdue?");
  });
});

describe('AIConversationService', () => {
  const repository = {
    createConversation: jest.fn(),
    listConversationsForUser: jest.fn(),
    findConversationForUser: jest.fn(),
    createMessage: jest.fn(),
    touchConversation: jest.fn(),
    updateTitle: jest.fn(),
    deleteConversation: jest.fn(),
    clearConversationMessages: jest.fn(),
    findMessagesForConversation: jest.fn(),
    findRecentMessagesForContext: jest.fn(),
  };

  let service: AIConversationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AIConversationService(
      repository as unknown as AiConversationRepository,
    );
  });

  it('creates a conversation for the current user', async () => {
    repository.createConversation.mockResolvedValue({ id: 'conv-1', userId: 'user-1' });
    const conversation = await service.createConversation('user-1');
    expect(repository.createConversation).toHaveBeenCalledWith('user-1', undefined);
    expect(conversation.id).toBe('conv-1');
  });

  it('denies cross-user conversation access', async () => {
    repository.findConversationForUser.mockResolvedValue(null);
    await expect(
      service.getConversationForUser('conv-1', 'user-2'),
    ).rejects.toThrow(NotFoundException);
  });

  it('adds messages only for owned conversations', async () => {
    repository.findConversationForUser.mockResolvedValue({
      id: 'conv-1',
      userId: 'user-1',
    });
    repository.createMessage.mockResolvedValue({
      id: 'msg-1',
      role: AiMessageRole.USER,
      content: 'hello',
    });

    const message = await service.addMessage({
      conversationId: 'conv-1',
      userId: 'user-1',
      role: AiMessageRole.USER,
      content: 'hello',
    });

    expect(message.id).toBe('msg-1');
    expect(repository.touchConversation).toHaveBeenCalledWith('conv-1', 'user-1');
  });

  it('clears and deletes with ownership checks', async () => {
    repository.findConversationForUser.mockResolvedValue({
      id: 'conv-1',
      userId: 'user-1',
    });
    repository.deleteConversation.mockResolvedValue(true);

    await expect(service.deleteConversation('conv-1', 'user-1')).resolves.toBe(
      true,
    );
    await service.clearConversation('conv-1', 'user-1');
    expect(repository.clearConversationMessages).toHaveBeenCalledWith(
      'conv-1',
      'user-1',
    );
  });
});
