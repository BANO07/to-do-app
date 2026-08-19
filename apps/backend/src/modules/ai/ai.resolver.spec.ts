import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { AiResolver } from './ai.resolver';
import { AIService } from './ai.service';
import { AIConversationService } from './ai-conversation.service';
import { AiChatService } from './ai-chat.service';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';

describe('AiResolver', () => {
  let resolver: AiResolver;

  const aiService = {
    getUsage: jest.fn(),
    isProviderConfigured: jest.fn(),
  };

  const conversationService = {
    listConversations: jest.fn(),
    getConversationForUser: jest.fn(),
    createConversation: jest.fn(),
    deleteConversation: jest.fn(),
    clearConversation: jest.fn(),
    getMessagesForConversation: jest.fn(),
  };

  const chatService = {
    chat: jest.fn(),
    confirmAction: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiResolver,
        { provide: AIService, useValue: aiService },
        { provide: AIConversationService, useValue: conversationService },
        { provide: AiChatService, useValue: chatService },
      ],
    }).compile();

    resolver = module.get(AiResolver);
  });

  it('returns usage for the authenticated user only', async () => {
    aiService.getUsage.mockResolvedValue({
      dailyLimit: 20,
      used: 4,
      remaining: 16,
      resetAt: new Date('2026-08-20T00:00:00.000Z'),
    });
    aiService.isProviderConfigured.mockReturnValue(false);

    const result = await resolver.aiUsage({
      id: 'user-1',
    } as any);

    expect(aiService.getUsage).toHaveBeenCalledWith('user-1');
    expect(result).toEqual({
      dailyLimit: 20,
      used: 4,
      remaining: 16,
      resetAt: new Date('2026-08-20T00:00:00.000Z'),
      providerConfigured: false,
    });
  });
});

describe('AiResolver auth guard', () => {
  it('rejects unauthenticated access through GqlAuthGuard', () => {
    const guard = new GqlAuthGuard();
    expect(() => guard.handleRequest(null, undefined)).toThrow(
      UnauthorizedException,
    );
  });
});
