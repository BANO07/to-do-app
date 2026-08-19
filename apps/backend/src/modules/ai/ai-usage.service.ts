import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiUsageRepository } from './ai-usage.repository';
import { AiMinuteRateLimiter } from './ai-minute-rate-limiter.service';
import { AiLimitReachedException } from './exceptions/ai.exceptions';
import { getNextUtcMidnight, getUtcUsageDate } from './utils/ai-date.util';

export interface AiUsageSnapshot {
  dailyLimit: number;
  used: number;
  remaining: number;
  resetAt: Date;
}

@Injectable()
export class AIUsageService {
  constructor(
    private readonly configService: ConfigService,
    private readonly aiUsageRepository: AiUsageRepository,
    private readonly minuteRateLimiter: AiMinuteRateLimiter,
  ) {}

  getDailyLimit(): number {
    return this.configService.get<number>('AI_FREE_DAILY_LIMIT') ?? 20;
  }

  getMinuteLimit(): number {
    return this.configService.get<number>('AI_RATE_LIMIT_PER_MINUTE') ?? 10;
  }

  async getUsage(userId: string, now = new Date()): Promise<AiUsageSnapshot> {
    const usageDate = getUtcUsageDate(now);
    const dailyLimit = this.getDailyLimit();
    const row = await this.aiUsageRepository.findByUserAndDate(
      userId,
      usageDate,
    );
    const used = row?.requestCount ?? 0;

    return {
      dailyLimit,
      used,
      remaining: Math.max(0, dailyLimit - used),
      resetAt: getNextUtcMidnight(now),
    };
  }

  /**
   * Enforces per-minute limit, then atomically consumes one daily slot.
   * Rejected requests do not increment ai_usage.
   */
  async consumeDailyRequest(userId: string, now = new Date()): Promise<number> {
    const minuteLimit = this.getMinuteLimit();
    if (!this.minuteRateLimiter.tryConsume(userId, minuteLimit, now.getTime())) {
      throw new AiLimitReachedException(
        `Your AI rate limit of ${minuteLimit} requests per minute has been reached. Please try again shortly.`,
      );
    }

    const dailyLimit = this.getDailyLimit();
    const usageDate = getUtcUsageDate(now);
    const requestCount = await this.aiUsageRepository.consumeDailyRequest(
      userId,
      usageDate,
      dailyLimit,
    );

    if (requestCount === null) {
      throw new AiLimitReachedException(
        `Your daily AI limit of ${dailyLimit} has been reached. Try again tomorrow.`,
      );
    }

    return requestCount;
  }
}
