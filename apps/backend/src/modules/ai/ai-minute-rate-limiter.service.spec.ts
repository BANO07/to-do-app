import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AiMinuteRateLimiter } from './ai-minute-rate-limiter.service';

describe('AiMinuteRateLimiter', () => {
  let limiter: AiMinuteRateLimiter;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AiMinuteRateLimiter],
    }).compile();

    limiter = module.get(AiMinuteRateLimiter);
    limiter.reset();
  });

  it('allows requests within the minute limit', () => {
    for (let i = 0; i < 10; i += 1) {
      expect(limiter.tryConsume('user-1', 10, 1_000)).toBe(true);
    }
  });

  it('rejects the 11th request in the same minute window', () => {
    for (let i = 0; i < 10; i += 1) {
      expect(limiter.tryConsume('user-1', 10, 1_000)).toBe(true);
    }

    expect(limiter.tryConsume('user-1', 10, 1_000)).toBe(false);
  });

  it('tracks users independently', () => {
    expect(limiter.tryConsume('user-a', 1, 1_000)).toBe(true);
    expect(limiter.tryConsume('user-b', 1, 1_000)).toBe(true);
    expect(limiter.tryConsume('user-a', 1, 1_000)).toBe(false);
  });

  it('resets the window after one minute', () => {
    for (let i = 0; i < 10; i += 1) {
      expect(limiter.tryConsume('user-1', 10, 1_000)).toBe(true);
    }

    expect(limiter.tryConsume('user-1', 10, 61_000)).toBe(true);
  });
});
