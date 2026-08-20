import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, LessThan, Repository } from 'typeorm';
import { CalendarEvent } from './entities/calendar-event.entity';
import { CalendarEventStatus } from '../../common/enums/calendar-event-status.enum';

@Injectable()
export class CalendarEventRepository {
  constructor(
    @InjectRepository(CalendarEvent)
    private readonly repo: Repository<CalendarEvent>,
  ) {}

  findByDateRange(userId: string, from: Date, to: Date): Promise<CalendarEvent[]> {
    return this.repo.find({
      where: {
        userId,
        startAt: Between(from, to),
      },
      order: { startAt: 'ASC' },
    });
  }

  findUpcoming(userId: string, from: Date, to: Date): Promise<CalendarEvent[]> {
    return this.repo.find({
      where: {
        userId,
        startAt: Between(from, to),
      },
      order: { startAt: 'ASC' },
    });
  }

  async upsertEvent(data: {
    userId: string;
    connectionId: string;
    providerEventId: string;
    calendarId: string;
    title: string;
    description: string | null;
    startAt: Date;
    endAt: Date;
    isAllDay: boolean;
    timezone: string | null;
    location: string | null;
    status: CalendarEventStatus;
    recurrenceId: string | null;
  }): Promise<void> {
    const existing = await this.repo.findOne({
      where: {
        connectionId: data.connectionId,
        providerEventId: data.providerEventId,
      },
    });

    const now = new Date();
    if (existing) {
      await this.repo.update({ id: existing.id }, { ...data, syncedAt: now });
    } else {
      const event = this.repo.create({ ...data, syncedAt: now });
      await this.repo.save(event);
    }
  }

  async markCancelledByConnectionId(
    connectionId: string,
    activeProviderEventIds: string[],
    syncedBefore: Date,
  ): Promise<void> {
    if (activeProviderEventIds.length > 0) {
      await this.repo
        .createQueryBuilder()
        .update(CalendarEvent)
        .set({ status: CalendarEventStatus.CANCELLED })
        .where('connection_id = :connectionId', { connectionId })
        .andWhere('provider_event_id NOT IN (:...ids)', { ids: activeProviderEventIds })
        .andWhere('synced_at < :syncedBefore', { syncedBefore })
        .execute();
    }
  }

  async deleteByConnectionId(connectionId: string): Promise<void> {
    await this.repo.delete({ connectionId });
  }

  /** Count events in a date range (for weekly review) */
  countInRange(userId: string, from: Date, to: Date): Promise<number> {
    return this.repo.count({
      where: {
        userId,
        startAt: Between(from, to),
      },
    });
  }
}
