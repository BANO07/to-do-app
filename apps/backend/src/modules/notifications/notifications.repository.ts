import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { ReminderChannel } from '../../common/enums/reminder-channel.enum';
import { NotificationStatus } from '../../common/enums/notification-status.enum';

@Injectable()
export class NotificationsRepository {
  constructor(
    @InjectRepository(Notification)
    private readonly repository: Repository<Notification>,
    private readonly dataSource: DataSource,
  ) {}

  create(data: Partial<Notification>): Notification {
    return this.repository.create(data);
  }

  save(notification: Notification): Promise<Notification> {
    return this.repository.save(notification);
  }

  findInboxForUser(
    userId: string,
    page: number,
    limit: number,
    unreadOnly: boolean,
  ): Promise<[Notification[], number]> {
    const query = this.repository
      .createQueryBuilder('notification')
      .where('notification.user_id = :userId', { userId })
      .andWhere('notification.channel = :channel', {
        channel: ReminderChannel.IN_APP,
      })
      .orderBy('notification.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (unreadOnly) {
      query.andWhere('notification.read_at IS NULL');
    }

    return query.getManyAndCount();
  }

  countUnreadInbox(userId: string): Promise<number> {
    return this.repository
      .createQueryBuilder('notification')
      .where('notification.user_id = :userId', { userId })
      .andWhere('notification.channel = :channel', {
        channel: ReminderChannel.IN_APP,
      })
      .andWhere('notification.read_at IS NULL')
      .getCount();
  }

  findInboxNotificationForUser(
    id: string,
    userId: string,
  ): Promise<Notification | null> {
    return this.repository.findOne({
      where: { id, userId, channel: ReminderChannel.IN_APP },
    });
  }

  async markAllInboxRead(userId: string, readAt: Date): Promise<number> {
    const result = await this.repository
      .createQueryBuilder()
      .update(Notification)
      .set({ readAt })
      .where('user_id = :userId', { userId })
      .andWhere('channel = :channel', { channel: ReminderChannel.IN_APP })
      .andWhere('read_at IS NULL')
      .execute();

    return result.affected ?? 0;
  }

  async findByIdempotencyKey(key: string): Promise<Notification | null> {
    return this.repository.findOne({ where: { idempotencyKey: key } });
  }

  async saveForReminderDelivery(
    notification: Partial<Notification>,
  ): Promise<Notification> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Notification);
      const existing = await repo.findOne({
        where: { idempotencyKey: notification.idempotencyKey! },
      });

      if (existing) {
        Object.assign(existing, notification);
        return repo.save(existing);
      }

      return repo.save(repo.create(notification));
    });
  }

  async markDeliveryResult(
    id: string,
    status: NotificationStatus,
    deliveredAt?: Date | null,
    lastError?: string | null,
  ): Promise<void> {
    await this.repository.update(
      { id },
      {
        status,
        deliveredAt: deliveredAt ?? null,
        lastError: lastError ?? null,
      },
    );
  }
}
