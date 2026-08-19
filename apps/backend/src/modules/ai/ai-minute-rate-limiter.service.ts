import { Injectable } from '@nestjs/common';

interface MinuteBucket {
  count: number;
  windowStartMs: number;
}

@Injectable()
export class AiMinuteRateLimiter {
  private readonly buckets = new Map<string, MinuteBucket>();

  /**
   * Returns true when the request is allowed within the current minute window.
   */
  tryConsume(
    userId: string,
    limit: number,
    nowMs = Date.now(),
    windowMs = 60_000,
  ): boolean {
    const bucket = this.buckets.get(userId);

    if (!bucket || nowMs - bucket.windowStartMs >= windowMs) {
      this.buckets.set(userId, { count: 1, windowStartMs: nowMs });
      return true;
    }

    if (bucket.count >= limit) {
      return false;
    }

    bucket.count += 1;
    return true;
  }

  /** Test helper — clears in-memory state between specs. */
  reset(): void {
    this.buckets.clear();
  }
}
