import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiUsage } from './entities/ai-usage.entity';

@Injectable()
export class AiUsageRepository {
  constructor(
    @InjectRepository(AiUsage)
    private readonly repository: Repository<AiUsage>,
  ) {}

  findByUserAndDate(
    userId: string,
    usageDate: string,
  ): Promise<AiUsage | null> {
    return this.repository.findOne({
      where: { userId, usageDate },
    });
  }

  /**
   * Atomically reserves one daily AI slot when under the limit.
   * Returns null when the daily limit is already reached.
   */
  async consumeDailyRequest(
    userId: string,
    usageDate: string,
    dailyLimit: number,
  ): Promise<number | null> {
    const rows: Array<{ request_count: number }> = await this.repository.query(
      `
        INSERT INTO ai_usage (user_id, usage_date, request_count)
        VALUES ($1, $2, 1)
        ON CONFLICT (user_id, usage_date)
        DO UPDATE SET
          request_count = ai_usage.request_count + 1,
          updated_at = now()
        WHERE ai_usage.request_count < $3
        RETURNING request_count
      `,
      [userId, usageDate, dailyLimit],
    );

    if (!rows.length) {
      return null;
    }

    return Number(rows[0].request_count);
  }
}
