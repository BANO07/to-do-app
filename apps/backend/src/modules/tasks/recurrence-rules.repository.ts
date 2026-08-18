import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { RecurrenceRule } from './entities/recurrence-rule.entity';

@Injectable()
export class RecurrenceRulesRepository {
  constructor(
    @InjectRepository(RecurrenceRule)
    private readonly repository: Repository<RecurrenceRule>,
  ) {}

  findBySeriesForUser(
    seriesId: string,
    userId: string,
  ): Promise<RecurrenceRule | null> {
    return this.repository.findOne({ where: { seriesId, userId } });
  }

  findBySeriesIdsForUser(
    seriesIds: string[],
    userId: string,
  ): Promise<RecurrenceRule[]> {
    if (seriesIds.length === 0) {
      return Promise.resolve([]);
    }
    return this.repository.find({
      where: { seriesId: In(seriesIds), userId },
    });
  }

  create(data: Partial<RecurrenceRule>): RecurrenceRule {
    return this.repository.create(data);
  }

  save(rule: RecurrenceRule): Promise<RecurrenceRule> {
    return this.repository.save(rule);
  }
}
