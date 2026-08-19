import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AIUsageService } from './ai-usage.service';
import { AiUsageRepository } from './ai-usage.repository';
import { AiMinuteRateLimiter } from './ai-minute-rate-limiter.service';
import { AIService } from './ai.service';
import { AI_PROVIDER } from './ai.tokens';
import {
  AIProvider,
  AIProviderResult,
} from './providers/ai-provider.interface';

describe('AIService', () => {
  let service: AIService;

  const aiProvider: AIProvider = {
    isAvailable: jest.fn().mockReturnValue(true),
    generateText: jest.fn(),
    generateChat: jest.fn(),
  };

  const aiUsageService = {
    getUsage: jest.fn(),
    consumeDailyRequest: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AIService,
        { provide: AI_PROVIDER, useValue: aiProvider },
        { provide: AIUsageService, useValue: aiUsageService },
      ],
    }).compile();

    service = module.get(AIService);
  });

  it('consumes usage before calling the provider', async () => {
    aiUsageService.consumeDailyRequest.mockResolvedValue(1);
    (aiProvider.generateText as jest.Mock).mockResolvedValue({
      text: 'hello',
    } satisfies AIProviderResult);

    const result = await service.generateText('user-1', { prompt: 'hello' });

    expect(aiUsageService.consumeDailyRequest).toHaveBeenCalledWith('user-1');
    expect(aiProvider.generateText).toHaveBeenCalledWith({ prompt: 'hello' });
    expect(result).toEqual({ text: 'hello' });
  });

  it('does not call the provider when daily usage is rejected', async () => {
    aiUsageService.consumeDailyRequest.mockRejectedValue(
      new Error('limit reached'),
    );

    await expect(
      service.generateText('user-1', { prompt: 'hello' }),
    ).rejects.toThrow('limit reached');
    expect(aiProvider.generateText).not.toHaveBeenCalled();
  });

  it('leaves the consumed daily slot in place when provider execution fails', async () => {
    aiUsageService.consumeDailyRequest.mockResolvedValue(3);
    (aiProvider.generateText as jest.Mock).mockRejectedValue(
      new Error('provider failed'),
    );

    await expect(
      service.generateText('user-1', { prompt: 'hello' }),
    ).rejects.toThrow('provider failed');
    expect(aiUsageService.consumeDailyRequest).toHaveBeenCalledTimes(1);
  });
});
