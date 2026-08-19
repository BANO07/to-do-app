import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Brackets,
  EntityManager,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';
import { Reminder } from '../tasks/entities/reminder.entity';
import { TaskStatus } from '../../common/enums/task-status.enum';
import { NotificationPreference } from './entities/notification-preference.entity';
import { ReminderChannel } from '../../common/enums/reminder-channel.enum';

@Injectable()
export class ReminderDeliveryRepository {
  constructor(
    @InjectRepository(Reminder)
    private readonly repository: Repository<Reminder>,
  ) {}

  async claimDueBatch(now: Date, limit: number): Promise<Reminder[]> {
    return this.buildEligibleQuery(this.repository.createQueryBuilder('reminder'), now)
      .orderBy('reminder.fire_at', 'ASC')
      .limit(limit)
      .getMany();
  }

  findLockedPendingById(
    manager: EntityManager,
    id: string,
    now: Date,
  ): Promise<Reminder | null> {
    return manager
      .getRepository(Reminder)
      .createQueryBuilder('reminder')
      .where('reminder.id = :id', { id })
      .andWhere('reminder.sent_at IS NULL')
      .andWhere('reminder.fire_at <= :now', { now })
      .setLock('pessimistic_write')
      .setOnLocked('skip_locked')
      .getOne();
  }

  findEligibleById(
    manager: EntityManager,
    id: string,
    now: Date,
  ): Promise<Reminder | null> {
    return this.buildEligibleQuery(
      manager.getRepository(Reminder).createQueryBuilder('reminder'),
      now,
    )
      .andWhere('reminder.id = :id', { id })
      .getOne();
  }

  private buildEligibleQuery(
    query: SelectQueryBuilder<Reminder>,
    now: Date,
  ): SelectQueryBuilder<Reminder> {
    return query
      .leftJoinAndSelect('reminder.task', 'task')
      .leftJoinAndSelect('reminder.user', 'user')
      .leftJoin(
        NotificationPreference,
        'preferences',
        'preferences.user_id = reminder.user_id',
      )
      .where('reminder.sent_at IS NULL')
      .andWhere('reminder.fire_at <= :now', { now })
      .andWhere('user.is_active = true')
      .andWhere('task.status NOT IN (:...blockedStatuses)', {
        blockedStatuses: [TaskStatus.COMPLETED, TaskStatus.ARCHIVED],
      })
      .andWhere('COALESCE(preferences.reminder_enabled, true) = true')
      .andWhere(
        new Brackets((sub) => {
          sub
            .where(
              'reminder.channel = :inAppChannel AND COALESCE(preferences.in_app_enabled, true) = true',
              { inAppChannel: ReminderChannel.IN_APP },
            )
            .orWhere(
              'reminder.channel = :emailChannel AND COALESCE(preferences.email_enabled, true) = true',
              { emailChannel: ReminderChannel.EMAIL },
            )
            .orWhere(
              'reminder.channel = :pushChannel AND COALESCE(preferences.push_enabled, false) = true',
              { pushChannel: ReminderChannel.PUSH },
            );
        }),
      );
  }
}
