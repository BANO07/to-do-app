import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { PageInfo } from '../../common/dto/page-info.dto';
import { ReminderChannel } from '../../common/enums/reminder-channel.enum';
import { NotificationStatus } from '../../common/enums/notification-status.enum';
import { NotificationType } from '../../common/enums/notification-type.enum';
import { normalizeTimeZone } from '../../common/utils/date-time.util';
import { Reminder } from '../tasks/entities/reminder.entity';
import { NotificationConnection, NotificationsInput } from './dto/notification.dto';
import { Notification } from './entities/notification.entity';
import { NotificationPreference } from './entities/notification-preference.entity';
import { NotificationsRepository } from './notifications.repository';
import { NotificationPreferencesService } from './notification-preferences.service';
import { PushSubscriptionsService } from './push-subscriptions.service';
import { InAppNotificationChannel } from './channels/in-app-notification.channel';
import {
  EmailNotificationChannel,
  EmailNotificationContent,
} from './channels/email-notification.channel';
import { PushNotificationChannel } from './channels/push-notification.channel';
import { ReminderDeliveryRepository } from './reminder-delivery.repository';
import { EMAIL_PROVIDER, PUSH_PROVIDER } from './notification.tokens';
import { EmailProvider } from './providers/email-provider.interface';
import { PushProvider } from './providers/push-provider.interface';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly notificationsRepository: NotificationsRepository,
    private readonly preferencesService: NotificationPreferencesService,
    private readonly subscriptionsService: PushSubscriptionsService,
    private readonly reminderDeliveryRepository: ReminderDeliveryRepository,
    private readonly inAppChannel: InAppNotificationChannel,
    private readonly emailChannel: EmailNotificationChannel,
    private readonly pushChannel: PushNotificationChannel,
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
    @Inject(EMAIL_PROVIDER)
    private readonly emailProvider: EmailProvider,
    @Inject(PUSH_PROVIDER)
    private readonly pushProvider: PushProvider,
  ) {}

  async getNotificationsForUser(
    userId: string,
    input: NotificationsInput = {},
  ): Promise<NotificationConnection> {
    const page = input.page ?? 1;
    const limit = input.limit ?? 10;
    const unreadOnly = input.unreadOnly ?? false;
    const [items, total] = await this.notificationsRepository.findInboxForUser(
      userId,
      page,
      limit,
      unreadOnly,
    );

    const totalPages = Math.max(1, Math.ceil(total / limit));
    const pageInfo: PageInfo = {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    };

    return { items, pageInfo };
  }

  getUnreadCountForUser(userId: string): Promise<number> {
    return this.notificationsRepository.countUnreadInbox(userId);
  }

  async markRead(userId: string, id: string): Promise<Notification> {
    const notification =
      await this.notificationsRepository.findInboxNotificationForUser(id, userId);
    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    if (!notification.readAt) {
      notification.readAt = new Date();
      await this.notificationsRepository.save(notification);
    }

    return notification;
  }

  async markAllRead(userId: string): Promise<boolean> {
    await this.notificationsRepository.markAllInboxRead(userId, new Date());
    return true;
  }

  async getPreferencesForUser(userId: string): Promise<NotificationPreference> {
    const preferences = await this.preferencesService.getForUser(userId);
    return this.decoratePreferences(preferences);
  }

  async processDueReminders(batchSize = 20): Promise<void> {
    const dueReminders = await this.reminderDeliveryRepository.claimDueBatch(
      new Date(),
      batchSize,
    );

    for (const reminder of dueReminders) {
      try {
        await this.processReminder(reminder.id);
      } catch (error) {
        this.logger.warn(
          `Reminder ${reminder.id} processing failed: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`,
        );
      }
    }
  }

  private async processReminder(reminderId: string): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const now = new Date();
      const reminder = await this.reminderDeliveryRepository.findEligibleLockedById(
        queryRunner.manager,
        reminderId,
        now,
      );

      if (!reminder) {
        await queryRunner.rollbackTransaction();
        return;
      }
      const notificationRepo = queryRunner.manager.getRepository(Notification);
      const idempotencyKey = this.buildIdempotencyKey(reminder);
      let notification = await notificationRepo.findOne({
        where: { idempotencyKey },
      });

      if (!notification) {
        notification = notificationRepo.create({
          userId: reminder.userId,
          reminderId: reminder.id,
          taskId: reminder.taskId,
          type: NotificationType.REMINDER,
          channel: reminder.channel,
          status: NotificationStatus.PENDING,
          title: `Reminder: ${reminder.task.title}`,
          message: this.buildReminderMessage(reminder),
          scheduledAt: reminder.fireAt,
          idempotencyKey,
        });
      }

      if (notification.status === NotificationStatus.SENT) {
        if (!reminder.sentAt) {
          reminder.sentAt = notification.deliveredAt ?? now;
          await queryRunner.manager.save(reminder);
        }
        await queryRunner.commitTransaction();
        return;
      }

      await notificationRepo.save(notification);

      if (reminder.channel === ReminderChannel.IN_APP) {
        notification.status = NotificationStatus.SENT;
        notification.deliveredAt = now;
        notification.lastError = null;
        await notificationRepo.save(notification);
        reminder.sentAt = now;
        await queryRunner.manager.save(reminder);
        await queryRunner.commitTransaction();
        return;
      }

      try {
        if (reminder.channel === ReminderChannel.EMAIL) {
          if (!this.emailChannel.isAvailable()) {
            throw new Error('Email delivery is unavailable');
          }

          await this.emailChannel.deliver(
            this.buildReminderEmail(reminder, notification),
          );
        } else if (reminder.channel === ReminderChannel.PUSH) {
          if (!this.pushChannel.isAvailable()) {
            throw new Error('Push delivery is unavailable');
          }

          const subscriptions = await this.subscriptionsService.findForUser(
            reminder.userId,
          );
          if (subscriptions.length === 0) {
            throw new Error('No push subscription registered');
          }

          const taskUrl = this.buildTaskUrl(reminder.taskId);
          for (const subscription of subscriptions) {
            await this.pushChannel.deliver(notification, subscription, taskUrl);
          }
        }

        notification.status = NotificationStatus.SENT;
        notification.deliveredAt = new Date();
        notification.lastError = null;
        reminder.sentAt = notification.deliveredAt;
      } catch (error) {
        notification.status = NotificationStatus.FAILED;
        notification.lastError =
          error instanceof Error ? error.message : 'Unknown delivery error';
      }

      await notificationRepo.save(notification);
      await queryRunner.manager.save(reminder);
      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private decoratePreferences(
    preferences: NotificationPreference,
  ): NotificationPreference {
    return Object.assign(preferences, {
      emailAvailable: this.emailProvider.isAvailable(),
      pushAvailable: this.pushProvider.isAvailable(),
      pushPublicKey: this.pushProvider.getPublicKey(),
    });
  }

  private buildIdempotencyKey(reminder: Reminder): string {
    return `reminder:${reminder.id}:${reminder.channel}`;
  }

  private buildReminderMessage(reminder: Reminder): string {
    const scheduledFor = this.formatForUser(
      reminder.fireAt,
      reminder.user?.ianaTimezone,
    );
    return `You have a reminder for ${reminder.task.title}. Scheduled for ${scheduledFor}.`;
  }

  private buildReminderEmail(
    reminder: Reminder,
    notification: Notification,
  ): EmailNotificationContent {
    const scheduledFor = this.formatForUser(
      reminder.fireAt,
      reminder.user?.ianaTimezone,
    );
    const taskUrl = this.buildTaskUrl(reminder.taskId);
    const subject = notification.title;
    const text = [
      'You have a reminder for:',
      '',
      reminder.task.title,
      '',
      `Scheduled for: ${scheduledFor}`,
      '',
      `Open task: ${taskUrl}`,
    ].join('\n');
    const html = [
      '<p>You have a reminder for:</p>',
      `<p><strong>${escapeHtml(reminder.task.title)}</strong></p>`,
      `<p>Scheduled for: ${escapeHtml(scheduledFor)}</p>`,
      `<p><a href="${escapeAttribute(taskUrl)}">Open task</a></p>`,
    ].join('');

    return {
      to: reminder.user.email,
      subject,
      text,
      html,
    };
  }

  private buildTaskUrl(taskId?: string | null): string {
    const base = this.configService
      .getOrThrow<string>('FRONTEND_URL')
      .replace(/\/$/, '');
    if (!taskId) {
      return `${base}/tasks/all`;
    }
    return `${base}/tasks/all?taskId=${encodeURIComponent(taskId)}`;
  }

  private formatForUser(date: Date, timeZone?: string | null): string {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: normalizeTimeZone(timeZone),
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttribute(value: string): string {
  return value.replace(/"/g, '&quot;');
}
