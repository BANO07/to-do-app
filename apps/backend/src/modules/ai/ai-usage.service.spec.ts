import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AIUsageService } from './ai-usage.service';
import { AiUsageRepository } from './ai-usage.repository';
import { AiMinuteRateLimiter } from './ai-minute-rate-limiter.service';
import {
  AI_LIMIT_REACHED_CODE,
  AiLimitReachedException,
} from './exceptions/ai.exceptions';

describe('AIUsageService', () => {
  let service: AIUsageService;
  let minuteRateLimiter: AiMinuteRateLimiter;

  const aiUsageRepository = {
    findByUserAndDate: jest.fn(),
    consumeDailyRequest: jest.fn(),
  };

  const configService = {
    get: jest.fn((key: string) => {
      if (key === 'AI_FREE_DAILY_LIMIT') {
        return 20;
      }
      if (key === 'AI_RATE_LIMIT_PER_MINUTE') {
        return 10;
      }
      return undefined;
    }),
  };

  const fixedNow = new Date('2026-08-19T15:30:00.000Z');

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AIUsageService,
        AiMinuteRateLimiter,
        { provide: AiUsageRepository, useValue: aiUsageRepository },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get(AIUsageService);
    minuteRateLimiter = module.get(AiMinuteRateLimiter);
    minuteRateLimiter.reset();
    jest.clearAllMocks();
  });

  it('returns zero usage for a new user', async () => {
    aiUsageRepository.findByUserAndDate.mockResolvedValue(null);

    const usage = await service.getUsage('user-1', fixedNow);

    expect(usage).toEqual({
      dailyLimit: 20,
      used: 0,
      remaining: 20,
      resetAt: new Date('2026-08-20T00:00:00.000Z'),
    });
  });

  it('creates the first daily usage row through the repository', async () => {
    aiUsageRepository.consumeDailyRequest.mockResolvedValue(1);

    const count = await service.consumeDailyRequest('user-1', fixedNow);

    expect(count).toBe(1);
    expect(aiUsageRepository.consumeDailyRequest).toHaveBeenCalledWith(
      'user-1',
      '2026-08-19',
      20,
    );
  });

  it('accepts the 20th daily request', async () => {
    aiUsageRepository.consumeDailyRequest.mockResolvedValue(20);

    const count = await service.consumeDailyRequest('user-1', fixedNow);

    expect(count).toBe(20);
  });

  it('rejects the 21st daily request without incrementing', async () => {
    aiUsageRepository.consumeDailyRequest.mockResolvedValue(null);

    await expect(
      service.consumeDailyRequest('user-1', fixedNow),
    ).rejects.toMatchObject({
      response: {
        code: AI_LIMIT_REACHED_CODE,
        message: expect.stringContaining('daily AI limit of 20'),
      },
    });
  });

  it('rejects per-minute limit requests before consuming daily usage', async () => {
    for (let i = 0; i < 10; i += 1) {
      aiUsageRepository.consumeDailyRequest.mockResolvedValueOnce(i + 1);
      await service.consumeDailyRequest('user-1', fixedNow);
    }

    aiUsageRepository.consumeDailyRequest.mockClear();

    await expect(
      service.consumeDailyRequest('user-1', fixedNow),
    ).rejects.toThrow(AiLimitReachedException);
    expect(aiUsageRepository.consumeDailyRequest).not.toHaveBeenCalled();
  });

  it('uses independent usage for different users', async () => {
    aiUsageRepository.findByUserAndDate.mockImplementation(
      async (userId: string) =>
        userId === 'user-1'
          ? { requestCount: 5 }
          : userId === 'user-2'
            ? { requestCount: 12 }
            : null,
    );

    const userOne = await service.getUsage('user-1', fixedNow);
    const userTwo = await service.getUsage('user-2', fixedNow);

    expect(userOne.used).toBe(5);
    expect(userTwo.used).toBe(12);
  });
});
